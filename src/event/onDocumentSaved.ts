import * as vscode from "vscode";
import logger from "../logger";
import { getConfigPath, check as configCheck } from "../config";
import cf from "../cf";
import phpstan from "../phpstan/phpstan";
import sftp from "../sftp/sftp";

export default async function (document: vscode.TextDocument) {
    if (document.uri.fsPath == getConfigPath()) {
        await configCheck();
        logger.info("config saved");
        return;
    }

    logger.info("file saved");

    let appCode = cf.getAppCodeFromDocument(document);
    if (appCode!=null && cf.isPhpstanInstalledOnAppCode(appCode)) {
        phpstan.updateDocument(document);
    }

    sftp.updateDocument(document);
}
