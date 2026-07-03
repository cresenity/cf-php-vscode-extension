import * as vscode from 'vscode';
import { findPermissionDefinition } from '../util';

const REGEX = /(?:havePermission|hasPermission|checkPermission|permission)\(\s*(['"])([^'"]*)\1/g;

export function checkPermissions(line: string, lineIndex: number, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
    const regex = new RegExp(REGEX.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
        const permissionName = match[2];
        if (!permissionName) { continue; }
        if (findPermissionDefinition(permissionName, document)) { continue; }
        const startCol = line.indexOf(permissionName, match.index);
        const range = new vscode.Range(lineIndex, startCol, lineIndex, startCol + permissionName.length);
        const diagnostic = new vscode.Diagnostic(range, `Permission '${permissionName}' not found in nav files`, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = 'phpcf';
        diagnostic.code = 'permission-not-found';
        diagnostics.push(diagnostic);
    }
}
