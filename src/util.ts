"use strict";

import { workspace, TextDocument, Uri, ExtensionContext } from "vscode";
import * as fs from "fs";
import * as path from "path";
import { isArray, isUndefined } from "util";

const getDirectories = (source: string) =>
    fs
        .readdirSync(source, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
function ucfirst(str: string) {
    str += "";
    const f = str.charAt(0).toUpperCase();
    return f + str.substring(1);
}

export function getActiveWorkspace(): any {
    if (!(workspace.workspaceFolders instanceof Array)) {
        return;
    }

    if (workspace.workspaceFolders.length === 0) {
        return;
    }

    return workspace.workspaceFolders[0];
}
function scanPaths(
    workspaceFolder: string,
    folder: string,
    appCode: string | null
) {
    let folders = [];

    const applicationFolder = path.join(workspaceFolder, "application");
    if (appCode != null) {
        let targetFolder = path.join(applicationFolder, appCode, folder);

        let defaultTargetFolder = path.join(
            applicationFolder,
            appCode,
            "default",
            folder
        );
        if (
            fs.existsSync(defaultTargetFolder) &&
            fs.statSync(defaultTargetFolder).isDirectory()
        ) {
            folders.push(defaultTargetFolder);
        }
        if (
            fs.existsSync(targetFolder) &&
            fs.statSync(targetFolder).isDirectory()
        ) {
            folders.push(targetFolder);
        }
    }

    // Modules
    let modulePath = path.join(workspaceFolder, "modules", "cresenity");
    if (fs.existsSync(modulePath) && fs.statSync(modulePath).isDirectory()) {
        let targetFolder = path.join(modulePath, folder);
        if (
            fs.existsSync(targetFolder) &&
            fs.statSync(targetFolder).isDirectory()
        ) {
            folders.push(targetFolder);
        }
    }

    // System
    let systemPath = path.join(workspaceFolder, "system");
    if (fs.existsSync(systemPath) && fs.statSync(systemPath).isDirectory()) {
        let targetFolder = path.join(systemPath, folder);
        if (
            fs.existsSync(targetFolder) &&
            fs.statSync(targetFolder).isDirectory()
        ) {
            folders.push(targetFolder);
        }
    }

    return folders.reverse();
}
function getAppCodeFromDocument(document: TextDocument) {
    const wsFolder = workspace.getWorkspaceFolder(document.uri);
    if (!wsFolder) {
        return null;
    }
    let workspaceFolder = wsFolder.uri.fsPath;

    let relativePath = path.relative(workspaceFolder, document.uri.fsPath);
    let relativePathExploded = relativePath.split(path.sep);
    let appCode = null;
    if (relativePathExploded.length > 2) {
        if (relativePathExploded[0] == "application") {
            appCode = relativePathExploded[1];
        }
    }
    return appCode;
}
export function getViewFilePath(text: string, document: TextDocument) {
    let paths = getViewFilePaths(text, document);
    return paths.length > 0 ? paths[0] : null;
}

export function getViewFilePaths(text: string, document: TextDocument) {
    const wsFolder = workspace.getWorkspaceFolder(document.uri);
    if (!wsFolder) {
        return [];
    }
    const workspaceFolder = wsFolder.uri.fsPath;
    const appCode = getAppCodeFromDocument(document);
    const config = workspace.getConfiguration("phpcf");

    let paths = scanPaths(workspaceFolder, "views", appCode);
    let file = text.replace(/\"|\'/g, "").replace(/\./g, "/").split("::");
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
            let showPath =
                path.sep + path.relative(workspaceFolder, fullFilePath);

            if (fs.existsSync(fullFilePath)) {
                result.push({
                    name: item,
                    showPath: showPath,
                    fileUri: Uri.file(fullFilePath),
                });
            }
        }
    }

    return result;
}
export function getPath(path: string): string {
    let workspace = getActiveWorkspace();

    if ("uri" in workspace) {
        return workspace.uri.fsPath + "/" + path;
    }

    return "";
}
function findMethodLine(filePath: string, methodName: string): number {
    if (!fs.existsSync(filePath)) {
        return 0;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const verbPrefixes = ['', 'get', 'post', 'put', 'patch', 'delete', 'options', 'any'];
    const candidates = verbPrefixes.map(prefix => {
        if (prefix === '') {
            return methodName;
        }
        return prefix + methodName.charAt(0).toUpperCase() + methodName.slice(1);
    });

    for (let i = 0; i < lines.length; i++) {
        for (const candidate of candidates) {
            if (lines[i].match(new RegExp(`function\\s+${candidate}\\s*\\(`))) {
                return i + 1;
            }
        }
    }
    return 0;
}

export function getRouteData(text: string, document: TextDocument) {
    const wsFolder = workspace.getWorkspaceFolder(document.uri);
    if (!wsFolder) {
        return null;
    }
    const workspaceFolder = wsFolder.uri.fsPath;
    const appCode = getAppCodeFromDocument(document);
    const config = workspace.getConfiguration("phpcf");
    const paths = scanPaths(workspaceFolder, "controllers", appCode);

    let uri = text.replace(/\"|\'/g, "");

    let resultController = null;
    let resultControllerDir = null;
    let resultControllerClass = null;
    let resultControllerPath = null;
    let resultMethodSegmentIndex = null;

    let segments = uri.split("/");
    let controllerPath = "";
    let controllerClass = "";
    let searchdir = "";
    let found = false;
    let i = -1;
    for (let segment of segments) {
        i++;
        searchdir = controllerPath;
        controllerPath += segment;

        controllerClass += ucfirst(segment);
        found = false;
        for (let dir of paths) {
            // Search within controllers only
            dir += path.sep;

            if (
                (fs.existsSync(dir + controllerPath) &&
                    fs.statSync(dir + controllerPath).isDirectory()) ||
                (fs.existsSync(dir + controllerPath + ".php") &&
                    fs.statSync(dir + controllerPath + ".php").isFile())
            ) {
                // Valid path
                found = true;
                // The controller must be a file that exists with the search path
                if (
                    fs.existsSync(dir + controllerPath + ".php") &&
                    fs.statSync(dir + controllerPath + ".php").isFile()
                ) {
                    // Set controller name
                    resultController = segment;

                    // Set controller dir
                    resultControllerDir = dir + searchdir;
                    resultControllerClass = "Controller_" + controllerClass;
                    // Change controller path
                    resultControllerPath = dir + controllerPath + ".php";
                    resultMethodSegmentIndex = i + 1;
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
        controllerClass += "_";
    }

    if (resultControllerPath != null) {
        let methodName = "index";
        if (resultMethodSegmentIndex !== null && resultMethodSegmentIndex < segments.length) {
            methodName = segments[resultMethodSegmentIndex];
        }

        let lineNumber = findMethodLine(resultControllerPath, methodName);
        let fileUri = Uri.file(resultControllerPath);
        if (lineNumber > 0) {
            fileUri = fileUri.with({ fragment: lineNumber.toString() });
        }

        return {
            path: resultControllerPath,
            dir: resultControllerDir,
            controller: resultControllerClass,
            fileUri: fileUri,
        };
    }
    return null;
}
export function findPermissionDefinition(permissionName: string, document: TextDocument) {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    if (!workspaceFolder) {
        return null;
    }
    const appCode = getAppCodeFromDocument(document);
    if (!appCode) {
        return null;
    }

    const navsDir = path.join(workspaceFolder, 'application', appCode, 'default', 'navs');
    if (!fs.existsSync(navsDir)) {
        return null;
    }

    return searchNavFiles(navsDir, permissionName);
}

function searchNavFiles(dir: string, permissionName: string): { filePath: string; line: number } | null {
    if (!fs.existsSync(dir)) {
        return null;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const result = searchNavFiles(fullPath, permissionName);
            if (result) {
                return result;
            }
        } else if (entry.name.endsWith('.php')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const nameMatch = lines[i].match(/'name'\s*=>\s*['"](.*?)['"]/);
                if (nameMatch && nameMatch[1] === permissionName) {
                    return { filePath: fullPath, line: i + 1 };
                }
            }
        }
    }
    return null;
}

export function resolveThemeAssetPath(fileName: string, type: 'css' | 'js', document: TextDocument): string | null {
    const wsFolder = workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    if (!wsFolder) { return null; }
    const appCode = getAppCodeFromDocument(document);
    const cleanName = fileName.split('?')[0];

    const dirs = [
        path.join(wsFolder, 'media', type),
        path.join(wsFolder, 'system', 'media', type),
        path.join(wsFolder, 'modules', 'cresenity', 'media', type),
    ];
    if (appCode) {
        dirs.push(path.join(wsFolder, 'application', appCode, 'default', 'media', type));
    }

    for (const dir of dirs) {
        const fullPath = path.join(dir, cleanName);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    return null;
}

export function resolveClientModuleDefinition(moduleName: string, document: TextDocument): { filePath: string; line: number } | null {
    const wsFolder = workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    if (!wsFolder) { return null; }
    const appCode = getAppCodeFromDocument(document);

    const files = [
        path.join(wsFolder, 'system', 'data', 'assets-module.php'),
        path.join(wsFolder, 'modules', 'cresenity', 'config', 'client_modules.php'),
    ];
    if (appCode) {
        files.push(path.join(wsFolder, 'application', appCode, 'default', 'config', 'client_modules.php'));
    }

    const keyRegex = new RegExp(`['"]${moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*=>`);
    for (const file of files) {
        if (!fs.existsSync(file)) { continue; }
        const content = fs.readFileSync(file, 'utf-8');
        if (content.includes('require') && !content.includes('=>')) { continue; }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (keyRegex.test(lines[i])) {
                return { filePath: file, line: i + 1 };
            }
        }
    }
    return null;
}

export function findDuplicatePermissions(document: TextDocument): { name: string; locations: { filePath: string; line: number }[] }[] {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    if (!workspaceFolder) {
        return [];
    }
    const appCode = getAppCodeFromDocument(document);
    if (!appCode) {
        return [];
    }

    const navsDir = path.join(workspaceFolder, 'application', appCode, 'default', 'navs');
    if (!fs.existsSync(navsDir)) {
        return [];
    }

    const allPermissions: Map<string, { filePath: string; line: number }[]> = new Map();
    collectAllPermissions(navsDir, allPermissions);

    const duplicates: { name: string; locations: { filePath: string; line: number }[] }[] = [];
    allPermissions.forEach((locations, name) => {
        if (locations.length > 1) {
            duplicates.push({ name, locations });
        }
    });

    return duplicates;
}

function collectAllPermissions(dir: string, result: Map<string, { filePath: string; line: number }[]>) {
    if (!fs.existsSync(dir)) {
        return;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectAllPermissions(fullPath, result);
        } else if (entry.name.endsWith('.php')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const nameMatch = lines[i].match(/'name'\s*=>\s*['"](.*?)['"]/);
                if (nameMatch) {
                    const name = nameMatch[1];
                    if (!result.has(name)) {
                        result.set(name, []);
                    }
                    result.get(name)!.push({ filePath: fullPath, line: i + 1 });
                }
            }
        }
    }
}

export function waitFor(callback: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
        const tmp = () => {
            if (callback()) {
                resolve();
                return;
            }

            setTimeout(tmp, 100);
        };

        tmp();
    });
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function getDefaultModelNamespace() {
    return "";
}
export function phpParserTokens(document: string) {
    const engine = require("php-parser");

    const parser = new engine({
        parser: {
            extractDoc: true,
            php7: true,
        },
        ast: {
            withPositions: true,
        },
    });

    return parser
        .tokenGetAll(document)
        .filter((token: Array<any>) => {
            return (
                token[0] !== "T_WHITESPACE" &&
                token[0] !== "T_COMMENT" &&
                token[0] !== "T_INLINE_HTML"
            );
        })
        .map((token: Array<any>, index: number) => {
            if (isArray(token)) {
                return [...token, index];
            }

            return token;
        });
}
