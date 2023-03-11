import { fstat, writeFile, writeFileSync } from 'fs';
import * as path from 'path';
import { config } from 'process';
import * as vscode from 'vscode';
import logger from '../logger';
import * as websocket from '../websocket';


type cfConfigType = {
    "liveReload": null | boolean,
    "uploadOnSave": null | boolean,
    "port": null | number
}

const defaultConfig = {
    "liveReload": true,
    "uploadOnSave": true,
    "port": 3717
}

let cfConfig: cfConfigType = defaultConfig;
let configPath: string = null;

export const check = async () => {
    await Promise.all(vscode.workspace.workspaceFolders.map(async workspace => {
        configPath = workspace.uri.fsPath + path.sep + '.vscode/cf.json';
        let config: vscode.TextDocument = null;

        try {
            config = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
        } catch (e) { }

        if (config) {
            const configBefore = cfConfig;
            cfConfig = JSON.parse(config.getText());

            if ((!configBefore.liveReload && cfConfig.liveReload)) {
                websocket.start();
            }

            if (configBefore.port != cfConfig.port && cfConfig.liveReload) {
                websocket.restart();
            }

            if (configBefore.liveReload && !cfConfig.liveReload) {
                websocket.disconnect();
            }
        } else {
            console.log('create cf.json config');
            const wsedit = new vscode.WorkspaceEdit();
            wsedit.createFile(vscode.Uri.file(configPath), { ignoreIfExists: true });
            vscode.workspace.applyEdit(wsedit);
            writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4), 'utf8');
            logger.log('cf.json config file created');
        }
    }));
}

export const getConfig = (): cfConfigType => {
    return cfConfig;
};

export const getConfigPath = (): string => {
    return configPath;
}
