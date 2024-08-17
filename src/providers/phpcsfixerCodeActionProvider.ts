
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig } from '../php/config';
import cf from '../cf';
import { COMMAND_CREATE_CLASS_FILE, COMMAND_MODEL_UPDATE, COMMAND_PHPCSFIXER } from '../constant';

export default class PhpcsfixerCodeActionProvider {
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
        // console.log(path.extname(document.fileName));
        if (path.extname(document.fileName) === '.php') {
            const action = new vscode.CodeAction('php-cs-fixer', vscode.CodeActionKind.Refactor);
            action.command = {
                command: COMMAND_PHPCSFIXER,
                title: 'Php Cs Fixer',
                arguments: [document.uri]
            };
            actions.push(action);
        }

        return actions;
    }
}
