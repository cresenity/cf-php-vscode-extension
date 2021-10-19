import * as vscode from 'vscode';
import LinkProvider from './providers/linkProvider';
import HoverProvider from './providers/hoverProvider';
import * as path from "path";
import * as fs from "fs";
import { AppModel } from './live/appModel';
import { checkNewAnnouncement } from './announcement';
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
        const appModel = new AppModel();
        checkNewAnnouncement(context.globalState);
        vscode.window.showInformationMessage('PHP CF Activated');
        let hover = vscode.languages.registerHoverProvider(['php', 'blade'], new HoverProvider());
        let link = vscode.languages.registerDocumentLinkProvider(['php', 'blade'], new LinkProvider());

        let disposable = vscode.commands.registerCommand('phpcf.showTodo', () =>{
            vscode.window.showInformationMessage('Todo from phpcf');
        });


        context.subscriptions.push(vscode.commands
            .registerCommand('extension.phpcf.goOnline', async (fileUri) => {
                await vscode.workspace.saveAll();
                appModel.Golive(fileUri ? fileUri.fsPath : null);
            })
        );

        context.subscriptions.push(vscode.commands
            .registerCommand('extension.phpcf.goOffline', () => {
                appModel.GoOffline();
            })
        );

        context.subscriptions.push(vscode.commands
            .registerCommand('extension.phpcf.changeWorkspace', () => {
                appModel.changeWorkspaceRoot();
            })
        );

        // context.subscriptions.push(window
        //     .onDidChangeActiveTextEditor(() => {
        //         if (window.activeTextEditor === undefined) return;
        //         if (workspace.rootPath === undefined && Helper.IsSupportedFile(window.activeTextEditor.document.fileName)) {
        //             StatusbarUi.Init();
        //         }
        //     })
        // );

        context.subscriptions.push(hover, link, appModel);
    }
}

export function deactivate() {
    //
}