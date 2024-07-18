import * as vscode from "vscode";
import Parser from "./../parser/index";
import { getConfigElements } from "./../php/config";
import { isNull } from "util";
import cf from "../cf";

export default class ConfigItemProvider {
    private elements: Array<any> = [];

    constructor() {
        const appCode = cf.getAppCode();
        if(appCode) {
            this.syncConfig(appCode);
        }

    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<Array<vscode.CompletionItem>> {
        let items: Array<vscode.CompletionItem> = [];

        let hasConfig = new Parser(document, position).hasConfig();

        if (!hasConfig) {
            return items;
        }
        const appCode = cf.getAppCode(document);
        if(appCode) {
            if (!this.elements[appCode]) {
                await this.syncConfig(appCode);
            }
            if(this.elements[appCode]) {

                for (let element of this.elements[appCode]) {
                    const item = new vscode.CompletionItem(
                        element,
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

    async syncConfig(appCode) {
        await getConfigElements().then((elements) => {
            if (!elements) {
                return;
            }

            this.elements[appCode] = Object.values(JSON.parse(elements));
        });
    }
}
