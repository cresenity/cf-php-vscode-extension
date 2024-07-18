import * as vscode from "vscode";
import Parser from "./../parser/index";
import { getPermissions } from "./../php/permission";
import cf from "../cf";

export default class PermissionItemProvider {
    private permissions: Array<any> = [];

    constructor() {
        const appCode = cf.getAppCode();
        if(appCode) {
            this.syncPermissions(appCode);
        }

    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<Array<vscode.CompletionItem>> {
        let items: Array<vscode.CompletionItem> = [];

        let hasTranslation = new Parser(document, position).hasPermission();

        if (!hasTranslation) {
            return items;
        }
        const appCode = cf.getAppCode(document);
        if(appCode) {
            if (!this.permissions[appCode]) {
                await this.syncPermissions(appCode);
            }
            if(this.permissions[appCode]) {
                for (let translation of this.permissions[appCode]) {
                    const item = new vscode.CompletionItem(
                        translation,
                        vscode.CompletionItemKind.Constant
                    );

                    item.range = document.getWordRangeAtPosition(
                        position,
                        /[\w\d\-_\.\:\\\/]+/g
                    );

                    items.push(item);
                }
            }
        }

        return items;
    }

    async syncPermissions(appCode) {
        const permissions = await getPermissions();
        if (!permissions) {
            return;
        }

        this.permissions[appCode] = Object.values(JSON.parse(permissions));
    }
}
