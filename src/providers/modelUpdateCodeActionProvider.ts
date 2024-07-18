
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig } from '../php/config';
import cf from '../cf';
import { COMMAND_CREATE_CLASS_FILE, COMMAND_MODEL_UPDATE } from '../constant';

export default class ModelUpdateCodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.Refactor
    ];
    async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeAction[]> {

        const actions: vscode.CodeAction[] = [];
        const appCode = cf.getAppCode(document);
        const appPrefix = await this.getAppPrefix();
        const appRoot = cf.getAppRoot(document);
        const librariesPath = appRoot + path.sep + 'default' + path.sep + 'libraries';
        const modelPath = librariesPath + path.sep + appPrefix+'Model';
        if(document.uri.fsPath.startsWith(modelPath)) {
            const action = new vscode.CodeAction('Update Model', vscode.CodeActionKind.Refactor);
            action.command = {
                command: COMMAND_MODEL_UPDATE,
                title: 'Update Model File',
                arguments: [document.uri]
            };
            actions.push(action);
        }
        console.log(actions);

        return actions;
    }

    async getAppPrefix() {
        return await getConfig('app.prefix');
    }
}
