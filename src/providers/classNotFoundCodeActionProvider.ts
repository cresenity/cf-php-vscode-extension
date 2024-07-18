
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig } from '../php/config';
import cf from '../cf';
import { COMMAND_CREATE_CLASS_FILE } from '../constant';

export default class ClassNotFoundCodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];
    async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeAction[]> {
        const classNotFoundDiagnostics = context.diagnostics.filter((diagnostic) => {
            return diagnostic.source == 'intelephense' && diagnostic.message.includes('Undefined type ')
        });
        const actions: vscode.CodeAction[] = [];
        const appCode = cf.getAppCode(document);
        if(appCode) {
            for (const diagnostic of classNotFoundDiagnostics) {
                const action = await this.createFix(document, diagnostic);
                if (action) {
                    actions.push(action);
                }
            }
        }
        return actions;
    }
    async createFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic) {
        const className = this.extractClassName(diagnostic.message);
        const appPrefix = await this.getAppPrefix();
        const appRoot = cf.getAppRoot(document);
        if(className && appPrefix && className.startsWith(appPrefix)) {
            const fix = new vscode.CodeAction(`Create file for class ${className}`, vscode.CodeActionKind.QuickFix);
            fix.command = { command: COMMAND_CREATE_CLASS_FILE, title: 'Create Class File', arguments: [className, appRoot, appPrefix] };
            fix.diagnostics = [diagnostic];
            fix.isPreferred = true;
            return fix;
        }
        return null;
    }

    extractClassName(message: string): string | null {
        const regex = /Undefined type\s'([^']+)'/;
        const match = message.match(regex);
        return match ? match[1] : null;
    }
    async getAppPrefix() {
        return await getConfig('app.prefix');
    }
}
