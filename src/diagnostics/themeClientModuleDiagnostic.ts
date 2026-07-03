import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { findArraySection } from '../util';
import cf from '../cf';

const EXCLUDED_KEYS = ['js', 'css', 'requirements', 'scss'];

function collectClientModuleNames(document: vscode.TextDocument): Set<string> {
    const docRoot = cf.getDocRoot();
    if (!docRoot) { return new Set(); }
    const appRoot = cf.getAppRoot(document);

    // client_modules.php / assets-module.php: modules at top level
    const clientModulesFiles: string[] = [
        path.join(docRoot, 'system', 'data', 'assets-module.php'),
        path.join(docRoot, 'system', 'config', 'client_modules.php'),
        path.join(docRoot, 'modules', 'cresenity', 'config', 'client_modules.php'),
    ];
    if (appRoot) {
        clientModulesFiles.push(path.join(appRoot, 'default', 'config', 'client_modules.php'));
    }

    // assets.php: modules nested under 'modules' key
    const assetsFiles: string[] = [
        path.join(docRoot, 'system', 'config', 'assets.php'),
        path.join(docRoot, 'modules', 'cresenity', 'config', 'assets.php'),
    ];
    if (appRoot) {
        assetsFiles.push(path.join(appRoot, 'default', 'config', 'assets.php'));
    }

    const modules = new Set<string>();
    const keyRegex = /['"]([^'"]+)['"]\s*=>/g;

    for (const file of clientModulesFiles) {
        if (!fs.existsSync(file)) { continue; }
        const content = fs.readFileSync(file, 'utf-8');
        if (content.match(/^\s*return\s+require\b/m)) { continue; }
        let match: RegExpExecArray | null;
        keyRegex.lastIndex = 0;
        while ((match = keyRegex.exec(content)) !== null) {
            const key = match[1];
            if (!EXCLUDED_KEYS.includes(key)) { modules.add(key); }
        }
    }

    for (const file of assetsFiles) {
        if (!fs.existsSync(file)) { continue; }
        const lines = fs.readFileSync(file, 'utf-8').split('\n');
        const section = findArraySection(lines, 'modules');
        if (!section) { continue; }
        for (let i = section.start; i <= section.end; i++) {
            let match: RegExpExecArray | null;
            keyRegex.lastIndex = 0;
            while ((match = keyRegex.exec(lines[i])) !== null) {
                const key = match[1];
                if (!EXCLUDED_KEYS.includes(key)) { modules.add(key); }
            }
        }
    }

    return modules;
}

export function checkThemeClientModules(lines: string[], commentedLines: boolean[], document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
    const knownModules = collectClientModuleNames(document);
    const section = findArraySection(lines, 'client_modules');
    if (!section) { return; }

    for (let i = section.start; i <= section.end; i++) {
        if (commentedLines[i]) { continue; }
        const regex = /['"]([^'"]+)['"]/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(lines[i])) !== null) {
            const moduleName = match[1];
            if (knownModules.has(moduleName)) { continue; }
            const startCol = lines[i].indexOf(moduleName, match.index);
            const range = new vscode.Range(i, startCol, i, startCol + moduleName.length);
            const diagnostic = new vscode.Diagnostic(range, `Client module '${moduleName}' not found`, vscode.DiagnosticSeverity.Warning);
            diagnostic.source = 'phpcf';
            diagnostic.code = 'client-module-not-found';
            diagnostics.push(diagnostic);
        }
    }
}
