import * as vscode from 'vscode';
import LinkProvider from './providers/linkProvider';
import HoverProvider from './providers/hoverProvider';
import * as path from "path";
import * as fs from "fs";
import initCommands from "./initCommands";
import { checkNewAnnouncement } from './announcement';
import app from './app';
import { reportError } from './helper';
import { showErrorMessage, showInformationMessage } from './host';
import logger from './logger';
import onDocumentSaved from './event/onDocumentSaved';

export function activate(context: vscode.ExtensionContext) {

    //check is cf project

    let isCF = false;
    if (vscode.workspace.workspaceFolders.length > 0) {
        vscode.workspace.workspaceFolders.forEach(element => {
            let root = element.uri.fsPath;
            let cfFile = root + path.sep + 'cf';
            if (fs.existsSync(cfFile)) {
                isCF = true;
            }
        });
    }

    if (isCF) {

        //register command
        try {
            initCommands(context);
        } catch (error) {
            reportError(error, 'initCommands');
        }

        vscode.workspace.onDidSaveTextDocument(onDocumentSaved);

        checkNewAnnouncement(context.globalState);

        app.statusBar.show();

        showInformationMessage('PHP CF is Activated');
        logger.info('PHP CF Activated');
        let hover = vscode.languages.registerHoverProvider(['php', 'blade'], new HoverProvider());
        let link = vscode.languages.registerDocumentLinkProvider(['php', 'blade'], new LinkProvider());

        context.subscriptions.push(hover, link);
    }
}

export function deactivate() {

}
