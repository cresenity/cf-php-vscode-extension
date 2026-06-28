import * as vscode from 'vscode';
import * as path from 'path';
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

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            this.checkPermissions(line, i, document, diagnostics);
            this.checkViews(line, i, document, diagnostics);
            this.checkControllerUri(line, i, document, diagnostics);
            this.checkDeprecatedRender(line, i, diagnostics);
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
}
