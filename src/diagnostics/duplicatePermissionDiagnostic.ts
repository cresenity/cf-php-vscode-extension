import * as vscode from 'vscode';
import * as path from 'path';
import { findDuplicatePermissions } from '../util';
import cf from '../cf';

export function checkDuplicatePermissions(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
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
                .map(l => `${vscode.workspace.asRelativePath(l.filePath)}:${l.line}`);

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
