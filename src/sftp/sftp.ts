import { getConfig } from "../config";
import * as vscode from "vscode";
import * as websocket from "../websocket";
import logger from "../logger";

class SFTP {
    public async updateDocument(document: vscode.TextDocument) {
        if (getConfig().uploadOnSave) {
            await this.uploadFile(document.uri);
        }
        websocket.reload();
    }

    private async uploadFile(uri: vscode.Uri) {
        logger.info(`uploading : ${uri.fsPath}`);
        await vscode.commands.executeCommand("sftp.upload.file", uri);
        logger.info(`uploaded : ${uri.fsPath}`);
    }
}

const sftp = new SFTP();

export default sftp;
