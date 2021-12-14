import * as vscode from 'vscode';
import * as path from "path";
import * as cp from "child_process";
import logger from '../logger';
import { showInformationMessage, showErrorMessage } from '../host';

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

            cp.exec(`cd ${appPath} && npm run dev`, (err, stdout, stderr) => {
                logger.info('stdout: ' + stdout);
                logger.info('stderr: ' + stderr);
                showInformationMessage(`Build completed on ${appCode} project`);
                if (err) {
                    logger.error('error: ' + err);
                    showErrorMessage(`${appCode} : ${err}`);
                }
            });
        }
    }
}
