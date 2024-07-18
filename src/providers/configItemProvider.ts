import * as vscode from "vscode";
import Parser from "./../parser/index";
import cf from "../cf";
import configRepository from "../repository/configRepository";

export default class ConfigItemProvider {

    constructor() {
        const appCode = cf.getAppCode();
        if(appCode) {
            configRepository.syncConfig(appCode);
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
            const elements = await configRepository.get(document);
            for (let element of elements) {
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

        return items;
    }

}
