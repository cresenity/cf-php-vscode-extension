import * as vscode from 'vscode';
import LinkProvider from './providers/linkProvider';
import HoverProvider from './providers/hoverProvider';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('PHP CF Activated');
    console.log('PHP CF Activated');
    let hover = vscode.languages.registerHoverProvider(['php', 'blade'], new HoverProvider());
    let link = vscode.languages.registerDocumentLinkProvider(['php', 'blade'], new LinkProvider());

    let disposable = vscode.commands.registerCommand('phpcf.showTodo', () =>{
        vscode.window.showInformationMessage('Todo from phpcf');
    });

    context.subscriptions.push(hover, link);
}

export function deactivate() {
    //
}