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

export default async function (document: vscode.TextDocument) {
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

            const rollupConfigUri = vscode.Uri.file(`${appPath}rollup.config.js`);
            const rollupConfDoc = await vscode.workspace.openTextDocument(rollupConfigUri);
            if (rollupConfDoc) {
                logger.info('Rollup config found.');
                let text = rollupConfDoc.getText();
                const rgx = new RegExp(/export default(.*)/s);
                const match = rgx.exec(text);
                const isProduction = false;
                const scss = (param:any) => {
                    return param;
                }

                const terser = (param:any) => {
                    return param;
                }

                const copy = (param:any) => {
                    return param;
                }

                const config = match[1] && eval(match[1]);

                console.log({ config });
                if(config){
                    console.log('JS', config[0].output.file);
                    console.log('CSS', config[0].plugins[0].output);
                }
            }
            console.log({ rollupConfigUri });
            return;

            cp.exec(`cd ${appPath}`, async (err, stdout, stderr) => {
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
