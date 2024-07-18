import * as vscode from "vscode";
import Parser from "./../parser/index";
import { getTranslations } from "./../php/translation";
import { isNull } from "util";
import cf from "../cf";

export default class TranslationItemProvider {
    private translations: Array<any> = [];

    constructor() {
        const appCode = cf.getAppCode();
        if(appCode) {
            this.syncTranslations(appCode);
        }

    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<Array<vscode.CompletionItem>> {
        let items: Array<vscode.CompletionItem> = [];

        let hasTranslation = new Parser(document, position).hasTranslation();

        if (!hasTranslation) {
            return items;
        }
        const appCode = cf.getAppCode(document);
        if(appCode) {
            if (!this.translations[appCode]) {
                await this.syncTranslations(appCode);
            }
            if(this.translations[appCode]) {
                for (let translation of this.translations[appCode]) {
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

    async syncTranslations(appCode) {
        const translations = await getTranslations();
        if (!translations) {
            return;
        }

        this.translations[appCode] = Object.values(JSON.parse(translations));
    }
}
