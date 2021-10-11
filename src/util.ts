'use strict';

import { workspace, TextDocument, Uri, ExtensionContext} from 'vscode';
import * as fs from "fs";
import * as path from "path";

const getDirectories = source =>
  fs.readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

export function getFilePath(text: string, document: TextDocument) {
    let paths = getFilePaths(text, document);
    return paths.length > 0 ? paths[0] : null;
}

export function getFilePaths(text: string, document: TextDocument) {
    let workspaceFolder = workspace.getWorkspaceFolder(document.uri).uri.fsPath;
    let config = workspace.getConfiguration('phpcf');
    let relativePath = path.relative(workspaceFolder,document.uri.fsPath);
    let relativePathExploded = relativePath.split(path.sep);
    let appCode = null;
    if(relativePathExploded.length>2) {
        if(relativePathExploded[0]=='application') {
            appCode = relativePathExploded[1];
        }
    }


    let paths = scanViewPaths(workspaceFolder, appCode);
    let file = text.replace(/\"|\'/g, '').replace(/\./g, '/').split('::');
    let result = [];

    for (let item in paths) {
        let filePath = paths[item] + `/${file[0]}`;

        if (file.length > 1) {
            if (item !== file[0]) {
                continue;
            } else {
                filePath = paths[item] + `/${file[1]}`;
            }
        }
        for (let extension of config.viewExtensions) {
            let fullFilePath = filePath + extension;
            let showPath = path.sep + path.relative(workspaceFolder,fullFilePath);

            if (fs.existsSync(fullFilePath)) {
                result.push({
                    "name": item,
                    "showPath": showPath,
                    "fileUri": Uri.file(fullFilePath)
                });
            }
        }
    }

    return result;
}

function scanViewPaths(workspaceFolder: string, appCode) {
    let folders = [];

    const applicationFolder = path.join(workspaceFolder , 'application');
    if(appCode!=null) {
        let viewFolder = path.join(applicationFolder,appCode,'views');
        let defaultViewFolder = path.join(applicationFolder,appCode,'default','views');
        if(fs.existsSync(viewFolder) && fs.statSync(viewFolder).isDirectory) {
            folders.push(viewFolder);
        }
        if(fs.existsSync(defaultViewFolder) && fs.statSync(defaultViewFolder).isDirectory) {
            folders.push(defaultViewFolder);
        }
    }

    // Modules
    let modulePath = path.join(workspaceFolder, 'modules','cresenity');
    if (fs.existsSync(modulePath) && fs.statSync(modulePath).isDirectory()) {
        let viewFolder = path.join(modulePath,'views');
        if (fs.existsSync(viewFolder) && fs.statSync(viewFolder).isDirectory()) {
            folders.push(viewFolder);
        }
    }



    // System
    let systemPath = path.join(workspaceFolder, 'system');
    if (fs.existsSync(systemPath) && fs.statSync(systemPath).isDirectory()) {
        let viewFolder = path.join(systemPath,'views');
        if (fs.existsSync(viewFolder) && fs.statSync(viewFolder).isDirectory()) {
            folders.push(viewFolder);
        }
    }


    return folders;
}