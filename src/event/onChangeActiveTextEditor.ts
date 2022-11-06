import * as vscode from "vscode";
import cf from "../cf";
import phpstan from "../phpstan/phpstan";
export default async function (e: vscode.TextEditor | undefined) {
    if (e !== undefined) {
        let appCode = cf.getAppCodeFromDocument(e.document);
        if (appCode) {
            phpstan.updateDocument(e.document);
        }
    }
}
