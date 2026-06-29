import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import cf from '../cf';

interface ModelEntry {
    table: string;
    model: string;
    lastUpdate: string;
}

export class ModelTreeProvider implements vscode.TreeDataProvider<ModelTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ModelTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private cache: Map<string, ModelEntry[]> = new Map();

    refresh() {
        this.cache.clear();
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: ModelTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ModelTreeItem): Promise<ModelTreeItem[]> | ModelTreeItem[] {
        if (!cf.isCF()) {
            return [];
        }

        if (!element) {
            return this.getAppItems();
        }

        if (element.contextValue === 'app') {
            return this.getModelItems(element.appCode!);
        }

        return [];
    }

    private getAppItems(): ModelTreeItem[] {
        const docRoot = cf.getDocRoot();
        if (!docRoot) { return []; }

        const appDir = path.join(docRoot, 'application');
        if (!fs.existsSync(appDir)) { return []; }

        const activeAppCode = cf.getAppCode();
        const entries = fs.readdirSync(appDir, { withFileTypes: true });

        return entries
            .filter(entry => {
                if (!entry.isDirectory()) { return false; }
                const appRoot = path.join(appDir, entry.name);
                return fs.existsSync(path.join(appRoot, 'default', 'libraries'))
                    || fs.existsSync(path.join(appRoot, 'libraries'));
            })
            .sort((a, b) => {
                if (a.name === activeAppCode) { return -1; }
                if (b.name === activeAppCode) { return 1; }
                return a.name.localeCompare(b.name);
            })
            .map(entry => {
                const isActive = entry.name === activeAppCode;
                const item = new ModelTreeItem(
                    entry.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'app'
                );
                item.appCode = entry.name;
                item.iconPath = new vscode.ThemeIcon(isActive ? 'folder-opened' : 'folder');
                if (isActive) {
                    item.description = '(active)';
                }
                return item;
            });
    }

    private async getModelItems(appCode: string): Promise<ModelTreeItem[]> {
        let models = this.cache.get(appCode);
        if (!models) {
            models = await this.fetchModels(appCode);
            if (models) {
                this.cache.set(appCode, models);
            }
        }

        if (!models || models.length === 0) {
            return [new ModelTreeItem('No models found', vscode.TreeItemCollapsibleState.None, 'info')];
        }

        const docRoot = cf.getDocRoot();

        return models.map(entry => {
            const hasModel = entry.model.length > 0;
            const item = new ModelTreeItem(
                entry.table,
                vscode.TreeItemCollapsibleState.None,
                hasModel ? 'model' : 'table'
            );

            if (hasModel) {
                item.description = entry.model;
                item.iconPath = new vscode.ThemeIcon('symbol-class');

                if (docRoot) {
                    const modelFile = this.findModelFile(docRoot, appCode, entry.model);
                    if (modelFile) {
                        item.command = {
                            command: 'vscode.open',
                            title: 'Open Model',
                            arguments: [vscode.Uri.file(modelFile)]
                        };
                        item.tooltip = modelFile;
                    }
                }
            } else {
                item.iconPath = new vscode.ThemeIcon('symbol-field');
                item.description = '(no model)';
            }

            if (entry.lastUpdate) {
                item.tooltip = (item.tooltip || entry.table) + `\nLast update: ${entry.lastUpdate}`;
            }

            return item;
        });
    }

    private findModelFile(docRoot: string, appCode: string, modelName: string): string | null {
        const appRoot = path.join(docRoot, 'application', appCode);
        const librariesDirs = [
            path.join(appRoot, 'default', 'libraries'),
            path.join(appRoot, 'libraries'),
        ];

        for (const libDir of librariesDirs) {
            if (!fs.existsSync(libDir)) { continue; }
            const prefixDirs = fs.readdirSync(libDir, { withFileTypes: true })
                .filter(d => d.isDirectory() && d.name.endsWith('Model'));

            for (const prefixDir of prefixDirs) {
                const modelFile = path.join(libDir, prefixDir.name, modelName + '.php');
                if (fs.existsSync(modelFile)) {
                    return modelFile;
                }
                const nested = this.findFileRecursive(path.join(libDir, prefixDir.name), modelName + '.php');
                if (nested) { return nested; }
            }
        }
        return null;
    }

    private findFileRecursive(dir: string, fileName: string): string | null {
        if (!fs.existsSync(dir)) { return null; }
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isFile() && entry.name === fileName) {
                return fullPath;
            }
            if (entry.isDirectory()) {
                const result = this.findFileRecursive(fullPath, fileName);
                if (result) { return result; }
            }
        }
        return null;
    }

    private fetchModels(appCode: string): Promise<ModelEntry[]> {
        const phpcfPath = cf.getPhpcfPath();
        if (!phpcfPath) { return Promise.resolve([]); }

        const docRoot = cf.getDocRoot();
        if (!docRoot) { return Promise.resolve([]); }

        const cwd = path.join(docRoot, 'application', appCode);
        if (!fs.existsSync(cwd)) { return Promise.resolve([]); }

        return new Promise(resolve => {
            cp.exec(`"${phpcfPath}" model:tables`, { cwd, timeout: 30000 }, (err, stdout) => {
                if (err || !stdout) {
                    resolve([]);
                    return;
                }
                resolve(this.parseTableOutput(stdout));
            });
        });
    }

    private parseTableOutput(output: string): ModelEntry[] {
        const models: ModelEntry[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            if (!line.startsWith('|') || line.includes('---') || line.includes('table')) { continue; }
            const parts = line.split('|').map(p => p.trim()).filter(p => p.length > 0);
            if (parts.length >= 2) {
                models.push({
                    table: parts[0],
                    model: parts[1] || '',
                    lastUpdate: parts[2] || '',
                });
            }
        }

        return models;
    }
}

export class ModelTreeItem extends vscode.TreeItem {
    appCode?: string;

    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
    ) {
        super(label, collapsibleState);
    }
}
