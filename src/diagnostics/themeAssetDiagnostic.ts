import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { findArraySection } from '../util';
import cf from '../cf';

function getAssetSearchPaths(document: vscode.TextDocument, type: 'css' | 'js'): string[] {
    const docRoot = cf.getDocRoot();
    if (!docRoot) { return []; }
    const appRoot = cf.getAppRoot(document);
    const dirs: string[] = [
        path.join(docRoot, 'media', type),
        path.join(docRoot, 'system', 'media', type),
        path.join(docRoot, 'modules', 'cresenity', 'media', type),
    ];
    if (appRoot) { dirs.push(path.join(appRoot, 'default', 'media', type)); }
    return dirs.filter(d => fs.existsSync(d));
}

function assetExists(fileName: string, searchPaths: string[]): boolean {
    const cleanName = fileName.split('?')[0];
    return searchPaths.some(dir => fs.existsSync(path.join(dir, cleanName)));
}

export function checkThemeAssets(lines: string[], commentedLines: boolean[], document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
    for (const type of ['css', 'js'] as const) {
        const section = findArraySection(lines, type);
        if (!section) { continue; }
        const searchPaths = getAssetSearchPaths(document, type);
        for (let i = section.start; i <= section.end; i++) {
            if (commentedLines[i]) { continue; }
            const regex = /['"]([^'"]+)[']/g;
            let match: RegExpExecArray | null;
            while ((match = regex.exec(lines[i])) !== null) {
                const fileName = match[1];
                if (!fileName.includes('.' + type)) { continue; }
                if (assetExists(fileName, searchPaths)) { continue; }
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
