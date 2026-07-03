import * as vscode from 'vscode';

const REGEX = /echo\s+\$app\s*->\s*render\s*\(/g;

export function checkDeprecatedRender(line: string, lineIndex: number, diagnostics: vscode.Diagnostic[]) {
    const regex = new RegExp(REGEX.source, 'g');
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
