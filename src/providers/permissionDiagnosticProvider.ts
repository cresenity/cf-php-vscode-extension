import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { findPermissionDefinition, findDuplicatePermissions, getViewFilePath, getRouteData } from '../util';
import cf from '../cf';

const PERMISSION_LINE_REGEX = /(?:havePermission|hasPermission|checkPermission|permission)\(\s*(['"])([^'"]*)\1/g;
const VIEW_LINE_REGEX = /(?:view|addView|setView|setViewLoginName|CView::factory|Inertia::render|@include|@extends|@component)\(\s*(['"])([^'"]*)\1/g;
const CONTROLLER_URI_LINE_REGEX = /(?:curl::redirect|c::redirect|c::url)\(\s*(['"])([^'"]*)\1/g;
const ECHO_APP_RENDER_REGEX = /echo\s+\$app\s*->\s*render\s*\(/g;

export class PermissionDiagnosticProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('phpcf');
    }

    activate(context: vscode.ExtensionContext) {
        context.subscriptions.push(this.diagnosticCollection);

        if (vscode.window.activeTextEditor) {
            this.updateDiagnostics(vscode.window.activeTextEditor.document);
        }

        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) {
                    this.updateDiagnostics(editor.document);
                }
            }),
            vscode.workspace.onDidSaveTextDocument(document => {
                this.updateDiagnostics(document);
            }),
            vscode.workspace.onDidCloseTextDocument(document => {
                this.diagnosticCollection.delete(document.uri);
            })
        );
    }

    updateDiagnostics(document: vscode.TextDocument) {
        if (document.languageId !== 'php') {
            return;
        }

        if (!cf.isOnAppDirectory(document)) {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const lines = document.getText().split('\n');

        const isThemeFile = this.isThemeFile(document);

        if (isThemeFile) {
            this.checkThemeAssets(lines, document, diagnostics);
            this.checkThemeClientModules(lines, document, diagnostics);
        } else {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                this.checkPermissions(line, i, document, diagnostics);
                this.checkViews(line, i, document, diagnostics);
                this.checkControllerUri(line, i, document, diagnostics);
                this.checkDeprecatedRender(line, i, diagnostics);
            }
        }

        this.checkDuplicatePermissions(document, diagnostics);

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private checkPermissions(line: string, lineIndex: number, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const regex = new RegExp(PERMISSION_LINE_REGEX.source, 'g');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(line)) !== null) {
            const permissionName = match[2];
            if (!permissionName) { continue; }
            const definition = findPermissionDefinition(permissionName, document);

            if (!definition) {
                const startCol = line.indexOf(permissionName, match.index);
                const range = new vscode.Range(lineIndex, startCol, lineIndex, startCol + permissionName.length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Permission '${permissionName}' not found in nav files`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'phpcf';
                diagnostic.code = 'permission-not-found';
                diagnostics.push(diagnostic);
            }
        }
    }

    private checkViews(line: string, lineIndex: number, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const regex = new RegExp(VIEW_LINE_REGEX.source, 'g');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(line)) !== null) {
            const viewName = match[2];
            if (!viewName) { continue; }
            const quoted = match[0].substring(match[0].indexOf(match[1]));
            const file = getViewFilePath(quoted, document);

            if (!file) {
                const startCol = line.indexOf(viewName, match.index);
                const range = new vscode.Range(lineIndex, startCol, lineIndex, startCol + viewName.length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `View '${viewName}' not found`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'phpcf';
                diagnostic.code = 'view-not-found';
                diagnostics.push(diagnostic);
            }
        }
    }

    private checkControllerUri(line: string, lineIndex: number, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const regex = new RegExp(CONTROLLER_URI_LINE_REGEX.source, 'g');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(line)) !== null) {
            const uri = match[2];
            if (!uri) { continue; }
            if (uri.startsWith('http://') || uri.startsWith('https://')) { continue; }
            const quoted = match[0].substring(match[0].indexOf(match[1]));
            const routeData = getRouteData(quoted, document);

            if (!routeData) {
                const startCol = line.indexOf(uri, match.index);
                const range = new vscode.Range(lineIndex, startCol, lineIndex, startCol + uri.length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Controller for '${uri}' not found`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'phpcf';
                diagnostic.code = 'controller-not-found';
                diagnostics.push(diagnostic);
            }
        }
    }

    private checkDeprecatedRender(line: string, lineIndex: number, diagnostics: vscode.Diagnostic[]) {
        const regex = new RegExp(ECHO_APP_RENDER_REGEX.source, 'g');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(line)) !== null) {
            const range = new vscode.Range(lineIndex, match.index, lineIndex, match.index + match[0].length);
            const diagnostic = new vscode.Diagnostic(
                range,
                `'echo $app->render()' is deprecated, use 'return $app' instead`,
                vscode.DiagnosticSeverity.Hint
            );
            diagnostic.source = 'phpcf';
            diagnostic.code = 'deprecated-render';
            diagnostic.tags = [vscode.DiagnosticTag.Deprecated];
            diagnostics.push(diagnostic);
        }
    }

    private checkDuplicatePermissions(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const duplicates = findDuplicatePermissions(document);
        if (duplicates.length === 0) { return; }

        const appRoot = cf.getAppRoot(document);
        if (!appRoot) { return; }
        const navsDir = path.join(appRoot, 'default', 'navs');

        if (!document.uri.fsPath.startsWith(navsDir)) { return; }

        const lines = document.getText().split('\n');
        for (const dup of duplicates) {
            for (const loc of dup.locations) {
                if (loc.filePath !== document.uri.fsPath) { continue; }
                const otherLocations = dup.locations
                    .filter(l => l.filePath !== document.uri.fsPath || l.line !== loc.line)
                    .map(l => {
                        const relative = vscode.workspace.asRelativePath(l.filePath);
                        return `${relative}:${l.line}`;
                    });

                const lineText = lines[loc.line - 1];
                const nameMatch = lineText.match(/'name'\s*=>\s*['"](.*?)['"]/);
                if (!nameMatch) { continue; }

                const nameStart = lineText.indexOf(nameMatch[1]);
                const range = new vscode.Range(loc.line - 1, nameStart, loc.line - 1, nameStart + nameMatch[1].length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Duplicate permission '${dup.name}' also defined in: ${otherLocations.join(', ')}`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'phpcf';
                diagnostic.code = 'duplicate-permission';
                diagnostics.push(diagnostic);
            }
        }
    }

    private isThemeFile(document: vscode.TextDocument): boolean {
        const appRoot = cf.getAppRoot(document);
        if (!appRoot) { return false; }
        const themesDir = path.join(appRoot, 'default', 'themes');
        return document.uri.fsPath.startsWith(themesDir);
    }

    private getAssetSearchPaths(document: vscode.TextDocument, type: 'css' | 'js'): string[] {
        const docRoot = cf.getDocRoot();
        if (!docRoot) { return []; }
        const appRoot = cf.getAppRoot(document);
        const dirs: string[] = [];

        dirs.push(path.join(docRoot, 'media', type));
        dirs.push(path.join(docRoot, 'system', 'media', type));
        dirs.push(path.join(docRoot, 'modules', 'cresenity', 'media', type));
        if (appRoot) {
            dirs.push(path.join(appRoot, 'default', 'media', type));
        }

        return dirs.filter(d => fs.existsSync(d));
    }

    private assetExists(fileName: string, searchPaths: string[]): boolean {
        const cleanName = fileName.split('?')[0];
        for (const dir of searchPaths) {
            if (fs.existsSync(path.join(dir, cleanName))) {
                return true;
            }
        }
        return false;
    }

    private checkThemeAssets(lines: string[], document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        for (const type of ['css', 'js'] as const) {
            const section = this.findArraySection(lines, type);
            if (!section) { continue; }

            const searchPaths = this.getAssetSearchPaths(document, type);
            for (let i = section.start; i <= section.end; i++) {
                const regex = /['"]([^'"]+)[']/g;
                let match: RegExpExecArray | null;
                while ((match = regex.exec(lines[i])) !== null) {
                    const fileName = match[1];
                    if (!fileName.includes('.' + type)) { continue; }
                    if (!this.assetExists(fileName, searchPaths)) {
                        const startCol = lines[i].indexOf(fileName, match.index);
                        const range = new vscode.Range(i, startCol, i, startCol + fileName.length);
                        const diagnostic = new vscode.Diagnostic(
                            range,
                            `${type.toUpperCase()} file '${fileName.split('?')[0]}' not found`,
                            vscode.DiagnosticSeverity.Warning
                        );
                        diagnostic.source = 'phpcf';
                        diagnostic.code = `${type}-not-found`;
                        diagnostics.push(diagnostic);
                    }
                }
            }
        }
    }

    private checkThemeClientModules(lines: string[], document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const knownModules = this.collectClientModuleNames(document);
        const inClientModules = this.findArraySection(lines, 'client_modules');
        if (!inClientModules) { return; }

        for (let i = inClientModules.start; i <= inClientModules.end; i++) {
            const regex = /['"]([^'"]+)['"]/g;
            let match: RegExpExecArray | null;
            while ((match = regex.exec(lines[i])) !== null) {
                const moduleName = match[1];
                if (!knownModules.has(moduleName)) {
                    const startCol = lines[i].indexOf(moduleName, match.index);
                    const range = new vscode.Range(i, startCol, i, startCol + moduleName.length);
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Client module '${moduleName}' not found`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = 'phpcf';
                    diagnostic.code = 'client-module-not-found';
                    diagnostics.push(diagnostic);
                }
            }
        }
    }

    private findArraySection(lines: string[], key: string): { start: number; end: number } | null {
        const regex = new RegExp(`['"]${key}['"]\\s*=>\\s*\\[`);

        for (let i = 0; i < lines.length; i++) {
            if (!regex.test(lines[i])) { continue; }

            let depth = 0;
            let started = false;
            for (let j = i; j < lines.length; j++) {
                for (const ch of lines[j]) {
                    if (ch === '[') { depth++; started = true; }
                    if (ch === ']') { depth--; }
                }
                if (started && depth <= 0) {
                    return { start: i + 1, end: j - 1 };
                }
            }
        }
        return null;
    }

    private collectClientModuleNames(document: vscode.TextDocument): Set<string> {
        const docRoot = cf.getDocRoot();
        if (!docRoot) { return new Set(); }
        const appRoot = cf.getAppRoot(document);

        const files: string[] = [
            path.join(docRoot, 'system', 'data', 'assets-module.php'),
            path.join(docRoot, 'system', 'config', 'client_modules.php'),
            path.join(docRoot, 'modules', 'cresenity', 'config', 'client_modules.php'),
        ];

        if (appRoot) {
            files.push(path.join(appRoot, 'default', 'config', 'client_modules.php'));
        }

        const assetsFiles: string[] = [
            path.join(docRoot, 'system', 'config', 'assets.php'),
            path.join(docRoot, 'modules', 'cresenity', 'config', 'assets.php'),
        ];
        if (appRoot) {
            assetsFiles.push(path.join(appRoot, 'default', 'config', 'assets.php'));
        }

        const modules = new Set<string>();
        const keyRegex = /['"]([^'"]+)['"]\s*=>/g;

        for (const file of files) {
            if (!fs.existsSync(file)) { continue; }
            const content = fs.readFileSync(file, 'utf-8');
            if (content.match(/^\s*return\s+require\b/m)) { continue; }
            let match: RegExpExecArray | null;
            while ((match = keyRegex.exec(content)) !== null) {
                const key = match[1];
                if (!['js', 'css', 'requirements', 'scss'].includes(key)) {
                    modules.add(key);
                }
            }
        }

        for (const file of assetsFiles) {
            if (!fs.existsSync(file)) { continue; }
            const content = fs.readFileSync(file, 'utf-8');
            const modulesSection = this.findArraySection(content.split('\n'), 'modules');
            if (!modulesSection) { continue; }
            const lines = content.split('\n');
            for (let i = modulesSection.start; i <= modulesSection.end; i++) {
                let match: RegExpExecArray | null;
                while ((match = keyRegex.exec(lines[i])) !== null) {
                    const key = match[1];
                    if (!['js', 'css', 'requirements', 'scss'].includes(key)) {
                        modules.add(key);
                    }
                }
            }
        }

        return modules;
    }
}
