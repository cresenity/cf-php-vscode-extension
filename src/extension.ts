import * as vscode from 'vscode';
import LinkProvider from './providers/linkProvider';
import HoverProvider from './providers/hoverProvider';
import * as path from "path";
import * as fs from "fs";
export function activate(context: vscode.ExtensionContext) {

    //check is cf project

    let isCF = false;
    if(vscode.workspace.workspaceFolders.length>0) {
        vscode.workspace.workspaceFolders.forEach(element => {
            let root = element.uri.fsPath;
            let cfFile = root + path.sep + 'cf';
            if (fs.existsSync(cfFile)) {
                isCF=true;
            }
        });
    }

    if(isCF) {
        vscode.window.showInformationMessage('PHP CF Activated');
        let hover = vscode.languages.registerHoverProvider(['php', 'blade'], new HoverProvider());
        let link = vscode.languages.registerDocumentLinkProvider(['php', 'blade'], new LinkProvider());

        let disposable = vscode.commands.registerCommand('phpcf.showTodo', () =>{
            vscode.window.showInformationMessage('Todo from phpcf');
        });

        context.subscriptions.push(hover, link);
    }
}

export function deactivate() {
    //
}