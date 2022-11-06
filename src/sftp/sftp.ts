import { getConfig, getConfigPath, check as configCheck } from "../config";
import cf from "../cf";
import * as vscode from "vscode";
import * as websocket from "../websocket";
import * as cp from "child_process";
import {
    showInformationMessage,
    showErrorMessage,
    showWarningMessage,
} from "../host";
import logger from "../logger";
import * as path from "path";
import { sleep } from "../util";
class SFTP {
    private buildProcess: cp.ChildProcess = null;

    constructor() {
        this.buildProcess = null;
    }
    public updateDocument(document: vscode.TextDocument) {
        let workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
            .uri.fsPath;
        let relativePath = path.relative(workspaceFolder, document.uri.fsPath);
        let relativePathExploded = relativePath.split(path.sep);

        let isValid = false;
        isValid = relativePathExploded.length >= 4;

        if (isValid) {
            isValid =
                relativePathExploded[0] == "application" &&
                relativePathExploded[3] == "js";
        }

        if (isValid) {
            this.updateWithJsCompilation(document);
        } else {
           this.updateNormally(document);
        }
    }

    async updateWithJsCompilation(document: vscode.TextDocument) {
        const appPathRgx = new RegExp(
            /(.*[\/|\\]application[\/|\\](.*?)[\/|\\])/gm
        );
        const matches = appPathRgx.exec(document.uri.fsPath);

        let appPath = matches[0];
        let appCode = matches[2];

        if (!appCode || !appPath) return;
        showInformationMessage(`${appCode} : building...`);

        const rollupConfigUri = vscode.Uri.file(
            `${appPath}rollup.config.js`
        );
        let rollupConfDoc = null;
        try {
            rollupConfDoc = await vscode.workspace.openTextDocument(
                rollupConfigUri
            );
        } catch (error) {}

        if (rollupConfDoc) {
            const warcherPath = `**/*.{css,js,map}`;
            const watcher =
                vscode.workspace.createFileSystemWatcher(warcherPath);

            let fileToUpload: string[] = [];

            watcher.onDidChange((uri) => {
                fileToUpload.push(uri.fsPath);
            });

            watcher.onDidCreate((uri) => {
                fileToUpload.push(uri.fsPath);
            });

            if (this.buildProcess && !this.buildProcess.killed) {
                this.buildProcess.kill();
                logger.info("cancel previous build process");
            }

            logger.info(`${appCode} : building...`);
            this.buildProcess = cp.exec(
                `npm run dev -C ${appPath} `,
                async (err, stdout, stderr) => {
                    if (err) {
                        watcher.dispose();
                        console.log("error: " + err);
                        return;
                    }
                    stdout && logger.info(stdout);
                    stderr && logger.info(stderr);
                    showInformationMessage(
                        `Build completed on ${appCode} project`
                    );

                    if (getConfig().uploadOnSave) {
                        await sleep(1000);
                        const files = [...new Set(fileToUpload)];
                        await Promise.all(
                            files.map(async (file) => {
                                await this.uploadFileByPath(file);
                            })
                        );
                    }
                    if (getConfig().liveReload) {
                        websocket.reload();
                    }
                    watcher.dispose();
                }
            );
        } else {
            showWarningMessage("rollup.config.js not found");
        }
    }
    async updateNormally(document: vscode.TextDocument) {
        if (getConfig().uploadOnSave) {
            await this.uploadFile(document.uri);
        }
        websocket.reload();
    }
    private async uploadFile(uri: vscode.Uri) {
        var sftpExt = vscode.extensions.getExtension("liximomo.sftp");

        if (!sftpExt) {
            sftpExt = vscode.extensions.getExtension("natizyskunk.sftp");
        }

        if (sftpExt && sftpExt.isActive) {
            logger.info(`uploading : ${uri.fsPath}`);
            await vscode.commands.executeCommand("sftp.upload.file", uri);
            logger.info(`uploaded : ${uri.fsPath}`);
        } else {
            showWarningMessage(
                `liximomo.sftp/natizyskunk.sftp extension is required to automatic upload files`
            );
        }
    }

    private async uploadFileByPath(path: string) {
        const uri = vscode.Uri.file(path);
        let doc = null;
        try {
            doc = await vscode.workspace.openTextDocument(uri);
        } catch (error) { }
        if (doc) {
            return await this.uploadFile(uri);
        } else {
            return null;
        }
    }
}

const sftp = new SFTP();

export default sftp;
