import * as path from 'path';
import { promises as fs } from 'fs';
import * as vscode from 'vscode';
const generateModelTemplate = (className: string, appPrefix:string): string => `
<?php

/**
 * @property
 */
class ${className} extends ${appPrefix}Model {
    // Add your properties and methods here
}
`;

export default async function(className , appRoot, appPrefix) {
    const librariesPath = appRoot + path.sep + 'default' + path.sep + 'libraries';
    const fileName = className.replace(/_/g, '/') + '.php';
    const filePath = path.join(librariesPath, fileName);
    const dir = path.dirname(filePath);
    try {
        if (!await exists(dir)) {
            await fs.mkdir(dir, { recursive: true });
        }
        let classTemplate = generateModelTemplate(className, appPrefix);

        await fs.writeFile(filePath, classTemplate);
        const document = await vscode.workspace.openTextDocument(filePath);
        vscode.window.showTextDocument(document);
    } catch (error) {
        vscode.window.showErrorMessage(`Error creating class file: ${error.message}`);
    }
}

async function exists(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}
