import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import cf from '../cf';
import { findMethodLine } from '../util';

const APP_CODE_REGEX = /['"]app_code['"]\s*=>\s*['"](.*?)['"]/;

function ucfirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.substring(1);
}

function resolveAppCodeFromDomain(docRoot: string, domain: string): string | null {
    const domainDir = path.join(docRoot, 'data', 'domain');
    if (!fs.existsSync(domainDir)) { return null; }

    const domainFile = path.join(domainDir, domain + '.php');
    if (fs.existsSync(domainFile)) {
        const content = fs.readFileSync(domainFile, 'utf-8');
        const match = content.match(APP_CODE_REGEX);
        if (match) { return match[1]; }
    }

    const files = fs.readdirSync(domainDir).filter(f => f.endsWith('.php'));
    for (const file of files) {
        const filePath = path.join(domainDir, file);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const domainMatch = content.match(/['"]domain['"]\s*=>\s*['"](.*?)['"]/);
            if (domainMatch && domainMatch[1] === domain) {
                const appMatch = content.match(APP_CODE_REGEX);
                if (appMatch) { return appMatch[1]; }
            }
        } catch { /* skip */ }
    }

    return null;
}

function scanControllerPaths(docRoot: string, appCode: string): string[] {
    const folders: string[] = [];

    const appDir = path.join(docRoot, 'application', appCode);
    const defaultControllers = path.join(appDir, 'default', 'controllers');
    if (fs.existsSync(defaultControllers)) { folders.push(defaultControllers); }
    const directControllers = path.join(appDir, 'controllers');
    if (fs.existsSync(directControllers)) { folders.push(directControllers); }

    const modulesControllers = path.join(docRoot, 'modules', 'cresenity', 'controllers');
    if (fs.existsSync(modulesControllers)) { folders.push(modulesControllers); }

    const systemControllers = path.join(docRoot, 'system', 'controllers');
    if (fs.existsSync(systemControllers)) { folders.push(systemControllers); }

    return folders;
}

function resolveControllerFromPath(docRoot: string, appCode: string, urlPath: string): { filePath: string; method: string } | null {
    const controllerDirs = scanControllerPaths(docRoot, appCode);
    const segments = urlPath.split('/').filter(s => s.length > 0);

    let resultControllerPath: string | null = null;
    let resultMethodSegmentIndex: number | null = null;

    let controllerPath = '';
    let found = false;

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        controllerPath += (i > 0 ? path.sep : '') + segment;

        found = false;
        for (const dir of controllerDirs) {
            const fullDir = path.join(dir, controllerPath);
            const fullFile = path.join(dir, controllerPath + '.php');

            if ((fs.existsSync(fullDir) && fs.statSync(fullDir).isDirectory()) ||
                (fs.existsSync(fullFile) && fs.statSync(fullFile).isFile())) {
                found = true;
                if (fs.existsSync(fullFile) && fs.statSync(fullFile).isFile()) {
                    resultControllerPath = fullFile;
                    resultMethodSegmentIndex = i + 1;
                }
                break;
            }
        }

        if (!found) { break; }
    }

    if (resultControllerPath) {
        let method = 'index';
        if (resultMethodSegmentIndex !== null && resultMethodSegmentIndex < segments.length) {
            method = segments[resultMethodSegmentIndex];
        }
        return { filePath: resultControllerPath, method };
    }

    return null;
}

export default async function resolveUrlCommand() {
    const docRoot = cf.getDocRoot();
    if (!docRoot) {
        vscode.window.showWarningMessage('CF project not detected.');
        return;
    }

    const clipboard = await vscode.env.clipboard.readText();
    let defaultValue = '';
    try {
        if (clipboard && (clipboard.startsWith('http://') || clipboard.startsWith('https://'))) {
            defaultValue = clipboard;
        }
    } catch { /* ignore */ }

    const urlInput = await vscode.window.showInputBox({
        prompt: 'Paste a URL to resolve to controller method',
        placeHolder: 'https://example.dev.cresenity.com/app/data/bank/manage/index',
        value: defaultValue,
    });

    if (!urlInput) { return; }

    const parsed = url.parse(urlInput);
    if (!parsed.hostname || !parsed.pathname) {
        vscode.window.showWarningMessage('Invalid URL format.');
        return;
    }

    const domain = parsed.hostname;
    const appCode = resolveAppCodeFromDomain(docRoot, domain);

    if (!appCode) {
        vscode.window.showWarningMessage(`No app found for domain: ${domain}`);
        return;
    }

    const urlPath = parsed.pathname.replace(/^\/+/, '');
    if (!urlPath) {
        vscode.window.showWarningMessage('URL has no path to resolve.');
        return;
    }

    const result = resolveControllerFromPath(docRoot, appCode, urlPath);

    if (!result) {
        vscode.window.showWarningMessage(`Could not resolve controller for: ${urlPath} (app: ${appCode})`);
        return;
    }

    const lineNumber = findMethodLine(result.filePath, result.method);
    const uri = vscode.Uri.file(result.filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    if (lineNumber > 0) {
        const position = new vscode.Position(lineNumber - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    }

    vscode.window.showInformationMessage(`${appCode} → ${path.basename(result.filePath, '.php')}::${result.method}()`);
}
