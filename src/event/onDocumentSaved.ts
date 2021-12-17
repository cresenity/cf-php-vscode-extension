import * as vscode from 'vscode';
import * as path from "path";
import * as cp from "child_process";
import logger from '../logger';
import { showInformationMessage, showErrorMessage, showWarningMessage } from '../host';
import * as websocket from '../websocket';
import { getConfig, getConfigPath, check as configCheck } from '../config';


let buildProcess: cp.ChildProcess = null;

const uploadFile = async (uri: vscode.Uri) => {
    var sftpExt = vscode.extensions.getExtension('liximomo.sftp');
    if (sftpExt && sftpExt.isActive) {
        logger.info(`uploading : ${uri.fsPath}`);
        await vscode.commands.executeCommand('sftp.upload.file', uri);
        logger.info(`uploaded : ${uri.fsPath}`);
    } else {
        showWarningMessage(`liximomo.sftp extension is required to automatic upload files`);
    }
}

const uploadFileByPath = async (path: string) => {
    const uri = vscode.Uri.file(path);
    let doc = null;
    try {
        doc = await vscode.workspace.openTextDocument(uri);
    } catch (error) { }
    if (doc) {
        return await uploadFile(uri);
    } else {
        return null;
    }
}

export default async function (document: vscode.TextDocument) {
    if (document.uri.fsPath == getConfigPath()) {
        await configCheck();
        logger.info('config saved');
        return;
    }

    logger.info('file saved');
    let workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri).uri.fsPath;
    let relativePath = path.relative(workspaceFolder, document.uri.fsPath);
    let relativePathExploded = relativePath.split(path.sep);

    let isValid = false;
    isValid = relativePathExploded.length >= 4;

    if (isValid) {
        isValid = relativePathExploded[0] == 'application' && relativePathExploded[3] == 'js';
    }

    if (isValid) {
        const appPathRgx = new RegExp(/(.*[\/|\\]application[\/|\\](.*?)[\/|\\])/gm);
        const matches = appPathRgx.exec(document.uri.fsPath);

        let appPath = matches[0];
        let appCode = matches[2];

        if (!appCode || !appPath) return;
        showInformationMessage(`${appCode} : building...`);

        const rollupConfigUri = vscode.Uri.file(`${appPath}rollup.config.js`);
        let rollupConfDoc = null;
        try {
            rollupConfDoc = await vscode.workspace.openTextDocument(rollupConfigUri);
        } catch (error) { }

        if (rollupConfDoc) {
            const warcherPath = `**/*.{css,js,map}`;
            const watcher = vscode.workspace.createFileSystemWatcher(warcherPath);

            let fileToUpload: string[] = [];

            watcher.onDidChange(uri => {
                fileToUpload.push(uri.fsPath);
            });

            watcher.onDidCreate(uri => {
                fileToUpload.push(uri.fsPath);
            });

            if (buildProcess && !buildProcess.killed) {
                buildProcess.kill();
                logger.info('cancel previous build process');
            }

            logger.info(`${appCode} : building...`);
            buildProcess = cp.exec(`cd ${appPath} && npm run dev`, async (err, stdout, stderr) => {
                if (err) {
                    watcher.dispose();
                    console.log('error: ' + err);
                    return;
                }
                stdout && logger.info(stdout);
                stderr && logger.info(stderr);
                showInformationMessage(`Build completed on ${appCode} project`);

                if (getConfig().uploadOnSave) {
                    await sleep(1000);
                    const files = [...new Set(fileToUpload)];
                    await Promise.all(files.map(async (file) => {
                        await uploadFileByPath(file);
                    }))
                }
                if (getConfig().liveReload) {
                    websocket.reload();
                }
                watcher.dispose();
            });


        } else {
            showWarningMessage('rollup.config.js not found');
        }
    } else {
        if (getConfig().uploadOnSave) {
            await uploadFile(document.uri);
        }
        websocket.reload();
    }

}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
