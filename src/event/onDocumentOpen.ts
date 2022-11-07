import * as vscode from "vscode";
import cf from "../cf";
import phpstan from "../phpstan/phpstan";

export default async function (document: vscode.TextDocument) {
    let appCode = cf.getAppCodeFromDocument(document);
    if (appCode!=null && cf.isPhpstanInstalledOnAppCode(appCode)) {
        phpstan.updateDocument(document);
    }
}
