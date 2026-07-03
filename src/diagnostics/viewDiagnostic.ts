import * as vscode from 'vscode';
import { getViewFilePath } from '../util';

const REGEX = /(?:view|addView|setView|setViewLoginName|CView::factory|Inertia::render|@include|@extends|@component)\(\s*(['"])([^'"]*)\1/g;

export function checkViews(line: string, lineIndex: number, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
    const regex = new RegExp(REGEX.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
        const viewName = match[2];
        if (!viewName) { continue; }
        const quoted = match[0].substring(match[0].indexOf(match[1]));
        if (getViewFilePath(quoted, document)) { continue; }
        const startCol = line.indexOf(viewName, match.index);
        const range = new vscode.Range(lineIndex, startCol, lineIndex, startCol + viewName.length);
        const diagnostic = new vscode.Diagnostic(range, `View '${viewName}' not found`, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = 'phpcf';
        diagnostic.code = 'view-not-found';
        diagnostics.push(diagnostic);
    }
}
