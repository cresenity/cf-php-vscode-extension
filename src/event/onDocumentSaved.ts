import * as vscode from 'vscode';
import * as path from "path";
import * as cp from "child_process";
import logger from '../logger';
import { showInformationMessage, showErrorMessage, showWarningMessage } from '../host';

const uploadFile = async (document: vscode.TextDocument) => {
    var sftpExt = vscode.extensions.getExtension('liximomo.sftp');
    if (sftpExt.isActive) {
        logger.info(`uploading : ${document.uri.fsPath}`);
        await vscode.commands.executeCommand('sftp.upload.file', document.uri);
        logger.info(`uploaded : ${document.uri.fsPath}`);
    } else {
        showWarningMessage(`liximomo.sftp extension is required to automatic upload files`);
    }
}

export default function (document: vscode.TextDocument) {
    let workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri).uri.fsPath;
    let relativePath = path.relative(workspaceFolder, document.uri.fsPath);
    let relativePathExploded = relativePath.split(path.sep);

    if (relativePathExploded.length >= 4) {
        let isValid = relativePathExploded[0] == 'application' && relativePathExploded[3] == 'js';
        if (isValid) {
            const appPathRgx = new RegExp('(.*\/application\/(.*?)\/)');
            const matches = appPathRgx.exec(document.uri.fsPath);

            let appPath = matches[0];
            let appCode = matches[2];

            if (!appCode || !appPath) return;

            logger.info(`${appCode} : building...`);
            showInformationMessage(`${appCode} : building...`);

            cp.exec(`cd ${appPath} && npm run dev`, (err, stdout, stderr) => {
                stdout && logger.info(stdout);
                stderr && logger.info(stderr);
                showInformationMessage(`Build completed on ${appCode} project`);
                if (err) {
                    logger.error('error: ' + err);
                    showErrorMessage(`${appCode} : ${err}`);
                }
                uploadFile(document);
            });
        }
    }
}
