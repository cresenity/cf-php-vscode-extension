import { basename } from "path";
import * as vscode from "vscode";
import PHPCF from "../../phpcf";
import cf from "../../cf";

function snakeCase(str) {
    // Replace all instances of an uppercase letter followed by a lowercase letter with an underscore and the lowercase letter
    return str.replace(/([a-z])([A-Z])/g, '$1_$2')
        // Replace all instances of an uppercase letter that is not preceded by a lowercase letter with an underscore and the lowercase letter
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        // Convert the entire string to lowercase
        .toLowerCase();
}

export default function phpcsfixer(uri?: vscode.Uri) {
    if (!uri) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage('No open active document');
            return;
        }
        uri = activeEditor.document.uri;
    }
    const fsPath = uri.fsPath;
    if(!cf.isPhpCsFixerInstalled()) {
        vscode.window.showErrorMessage('php-cs-fixer is not installed, please install with "phpcf phpcs:install" command!');
        return;
    }
    PHPCF.run('php-cs-fixer ' + fsPath);
}
