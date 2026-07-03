import * as vscode from 'vscode';
import * as path from 'path';
import cf from '../cf';
import PHPCF from '../phpcf';

function snakeCase(str: string) {
    return str.replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        .toLowerCase();
}

export default async function modelUpdateShortcut() {
    const document = vscode.window.activeTextEditor?.document;
    if (!document || document.languageId !== 'php') {
        vscode.window.showWarningMessage('No active PHP file');
        return;
    }

    const appRoot = cf.getAppRoot(document);
    if (!appRoot) {
        vscode.window.showWarningMessage('Not inside a CF application directory');
        return;
    }

    const librariesPath = path.join(appRoot, 'default', 'libraries');
    const fsPath = document.uri.fsPath;

    if (!fsPath.startsWith(librariesPath) || !fsPath.includes('Model' + path.sep)) {
        vscode.window.showWarningMessage('Current file is not a model file');
        return;
    }

    const fileName = path.basename(fsPath, '.php');
    const table = snakeCase(fileName);

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Running model:update ${table}...`,
            cancellable: false,
        }, () => PHPCF.run(`model:update ${table}`, document));

        vscode.window.showInformationMessage(`model:update ${table} completed`);
    } catch (err) {
        vscode.window.showErrorMessage(`model:update failed: ${err}`);
    }
}
