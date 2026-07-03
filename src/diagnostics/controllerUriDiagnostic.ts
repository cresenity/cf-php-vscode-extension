import * as vscode from 'vscode';
import { getRouteData } from '../util';

const REGEX = /(?:curl::redirect|c::redirect|c::url)\(\s*(['"])([^'"]*)\1/g;

export function checkControllerUri(line: string, lineIndex: number, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
    const regex = new RegExp(REGEX.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
        const uri = match[2];
        if (!uri) { continue; }
        if (uri.startsWith('http://') || uri.startsWith('https://')) { continue; }
        const quoted = match[0].substring(match[0].indexOf(match[1]));
        if (getRouteData(quoted, document)) { continue; }
        const startCol = line.indexOf(uri, match.index);
        const range = new vscode.Range(lineIndex, startCol, lineIndex, startCol + uri.length);
        const diagnostic = new vscode.Diagnostic(range, `Controller for '${uri}' not found`, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = 'phpcf';
        diagnostic.code = 'controller-not-found';
        diagnostics.push(diagnostic);
    }
}
