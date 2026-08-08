import * as vscode from "vscode";
import cf from "../cf";
import phpstan from "../phpstan/phpstan";
import phpcs from "../phpcs/phpcs";

export default async function (document: vscode.TextDocument) {
    let appCode = cf.getAppCodeFromDocument(document);
    if (appCode!=null && cf.isPhpStanInstalledOnAppCode(appCode)) {
        phpstan.updateDocument(document);
    }
    if (cf.isPhpcsEnabled()) {
        phpcs.updateDocument(document);
    }
}
