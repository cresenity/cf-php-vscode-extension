import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import cf from '../cf';

const APP_CODE_REGEX = /['"]app_code['"]\s*=>\s*['"](.*?)['"]/;

export default async function dataDomainCommand(folderUri: vscode.Uri) {
    const docRoot = cf.getDocRoot();
    if (!docRoot) {
        vscode.window.showWarningMessage('CF project not detected.');
        return;
    }

    const folderName = path.basename(folderUri.fsPath);
    const appDir = path.join(docRoot, 'application');

    if (!folderUri.fsPath.startsWith(appDir)) {
        vscode.window.showWarningMessage('This folder is not an application folder.');
        return;
    }

    const domainDir = path.join(docRoot, 'data', 'domain');
    if (!fs.existsSync(domainDir)) {
        vscode.window.showWarningMessage('Domain directory not found: data/domain');
        return;
    }

    const domainFiles = fs.readdirSync(domainDir)
        .filter(f => f.endsWith('.php'))
        .sort();

    const matchingFiles: { label: string; filePath: string }[] = [];

    for (const file of domainFiles) {
        const filePath = path.join(domainDir, file);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const match = content.match(APP_CODE_REGEX);
            if (match && match[1] === folderName) {
                matchingFiles.push({
                    label: file.replace(/\.php$/, ''),
                    filePath,
                });
            }
        } catch {
            // skip unreadable files
        }
    }

    if (matchingFiles.length === 0) {
        vscode.window.showInformationMessage(`No domain files found for app: ${folderName}`);
        return;
    }

    const items = matchingFiles.map(f => ({
        label: f.label,
        detail: path.relative(docRoot, f.filePath),
        filePath: f.filePath,
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Domain files for "${folderName}" (${items.length} found)`,
    });

    if (selected) {
        const doc = await vscode.workspace.openTextDocument(selected.filePath);
        await vscode.window.showTextDocument(doc);
    }
}
