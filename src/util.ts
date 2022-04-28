'use strict';

import { workspace, TextDocument, Uri, ExtensionContext} from 'vscode';
import * as fs from "fs";
import * as path from "path";

const getDirectories = (source:string) =>
  fs.readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
function ucfirst (str:string) {
    str += '';
    const f = str.charAt(0).toUpperCase();
    return f + str.substring(1);
}

function scanPaths(workspaceFolder: string, folder : string, appCode:string|null) {
    let folders = [];

    const applicationFolder = path.join(workspaceFolder , 'application');
    if(appCode!=null) {
        let targetFolder = path.join(applicationFolder,appCode,folder);

        let defaultTargetFolder = path.join(applicationFolder,appCode,'default',folder);
        if(fs.existsSync(defaultTargetFolder) && fs.statSync(defaultTargetFolder).isDirectory) {
            folders.push(defaultTargetFolder);
        }
        if(fs.existsSync(targetFolder) && fs.statSync(targetFolder).isDirectory) {
            folders.push(targetFolder);
        }

    }

    // Modules
    let modulePath = path.join(workspaceFolder, 'modules','cresenity');
    if (fs.existsSync(modulePath) && fs.statSync(modulePath).isDirectory()) {
        let targetFolder = path.join(modulePath,folder);
        if (fs.existsSync(targetFolder) && fs.statSync(targetFolder).isDirectory()) {
            folders.push(targetFolder);
        }
    }

    // System
    let systemPath = path.join(workspaceFolder, 'system');
    if (fs.existsSync(systemPath) && fs.statSync(systemPath).isDirectory()) {
        let targetFolder = path.join(systemPath,folder);
        if (fs.existsSync(targetFolder) && fs.statSync(targetFolder).isDirectory()) {
            folders.push(targetFolder);
        }
    }


    return folders.reverse();
}
function getAppCodeFromDocument(document: TextDocument) {
    let workspaceFolder = workspace.getWorkspaceFolder(document.uri).uri.fsPath;

    let relativePath = path.relative(workspaceFolder,document.uri.fsPath);
    let relativePathExploded = relativePath.split(path.sep);
    let appCode = null;
    if(relativePathExploded.length>2) {
        if(relativePathExploded[0]=='application') {
            appCode = relativePathExploded[1];
        }
    }
    return appCode;
}
export function getFilePath(text: string, document: TextDocument) {
    let paths = getFilePaths(text, document);
    return paths.length > 0 ? paths[0] : null;
}

export function getFilePaths(text: string, document: TextDocument) {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri).uri.fsPath;
    const appCode = getAppCodeFromDocument(document);
    const config = workspace.getConfiguration('phpcf');

    let paths = scanPaths(workspaceFolder,'views', appCode);
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

export function getRouteData(text: string, document: TextDocument) {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri).uri.fsPath;
    const appCode = getAppCodeFromDocument(document);
    const config = workspace.getConfiguration('phpcf');
    const paths = scanPaths(workspaceFolder,'controllers', appCode);

    let uri = text.replace(/\"|\'/g, '');

    let resultController = null;
    let resultControllerDir = null;
    let resultControllerClass = null;
    let resultControllerPath = null;
    let resultMethodSegmentIndex = null;

    let segments = uri.split('/');
    let controllerPath = '';
    let controllerClass = '';
    let searchdir = '';
    let found = false;
    let i = -1;
    for(let segment of segments) {
        i++;
        searchdir = controllerPath;
        controllerPath += segment;

        controllerClass += ucfirst(segment);
        found = false;
        for(let dir of paths) {
            // Search within controllers only
            dir += path.sep;

            if ((fs.existsSync(dir+controllerPath) && fs.statSync(dir+controllerPath).isDirectory()) || (fs.existsSync(dir+controllerPath + '.php') && fs.statSync(dir+controllerPath + '.php').isFile())) {
                // Valid path
                found = true;
                // The controller must be a file that exists with the search path
                if (fs.existsSync(dir+controllerPath + '.php') && fs.statSync(dir+controllerPath + '.php').isFile()) {

                    // Set controller name
                    resultController = segment;

                    // Set controller dir
                    resultControllerDir = dir + searchdir;
                    resultControllerClass = 'Controller_' + controllerClass;
                    // Change controller path
                    resultControllerPath = dir+controllerPath + '.php';
                    resultMethodSegmentIndex = i+1;
                    break;

                }
            }
        }

        if (found === false) {
            // Maximum depth has been reached, stop searching
            break;
        }

        // Add another slash
        controllerPath += path.sep;
        controllerClass += '_';
    }

    if(resultControllerPath!=null) {
        return {
            "path":resultControllerPath,
            "dir":resultControllerDir,
            "controller":resultControllerClass,
            "fileUri":Uri.file(resultControllerPath)
        };
    }
    return null;
}
