import * as vscode from 'vscode';
import * as path from "path";
import * as cp from "child_process";
import logger from '../logger';
import { showInformationMessage, showErrorMessage, showWarningMessage } from '../host';

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

const uploadFileByPath = async (path:string) => {
    const uri = vscode.Uri.file(path);
    let doc = null;
    try {
        doc = await vscode.workspace.openTextDocument(uri);
    } catch (error) {}
    if(doc){
        return await uploadFile(uri);
    }else{
        return null;
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
            let rollupConfDoc = null;
            try {
                rollupConfDoc = await vscode.workspace.openTextDocument(rollupConfigUri);
            } catch (error) {}

            if (rollupConfDoc) {
                logger.info('Rollup config found.');
                let text = rollupConfDoc.getText();
                const rgx = new RegExp(/export default(.*)/s);
                const match = rgx.exec(text);
                const isProduction = false;
                const scss = (param: any) => param;
                const terser = (param: any) => param;
                const copy = (param: any) => param;
                const config = match[1] && eval(match[1]);

                let jsPath:string = null;
                let cssPath:string = null;
                if (config) {
                    jsPath = config[0]?.output?.file;
                    cssPath = config[0]?.plugins[0]?.output;
                }

                jsPath = jsPath?.replace(/.+?(?=default)/, '');
                cssPath = cssPath?.replace(/.+?(?=default)/, '');

                jsPath = `${appPath}${jsPath}`;
                cssPath = `${appPath}${cssPath}`;

                cp.exec(`cd ${appPath} && npm run dev`, async (err, stdout, stderr) => {
                    stdout && logger.info(stdout);
                    stderr && logger.info(stderr);
                    showInformationMessage(`Build completed on ${appCode} project`);
                    if (err) {
                        logger.error('error: ' + err);
                        showErrorMessage(`${appCode} : ${err}`);
                    }

                    if(jsPath){
                        uploadFileByPath(jsPath);
                    }

                    if(cssPath){
                        uploadFileByPath(cssPath);
                    }
                });
            } else {
                showWarningMessage('rollup.config.js not found');
            }
        }
    }
}
