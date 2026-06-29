import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import cf from '../cf';

const HTTP_VERB_PREFIXES = ['get', 'post', 'put', 'patch', 'delete', 'options', 'any'];
const BLOCKED_METHODS = ['__construct', '__call', '__get', '__set', '__isset', '__unset', '__toString', '__invoke', '__clone', '__debugInfo', '__destruct', '__sleep', '__wakeup', 'callAction', 'middleware', 'getMiddleware'];

interface ControllerMethod {
    name: string;
    line: number;
    verb: string | null;
    urlSegment: string;
}

interface ControllerInfo {
    filePath: string;
    urlPath: string;
    methods: ControllerMethod[];
}

export class RouteTreeProvider implements vscode.TreeDataProvider<RouteTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<RouteTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: RouteTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: RouteTreeItem): RouteTreeItem[] {
        if (!cf.isCF()) {
            return [];
        }

        if (!element) {
            return this.getAppItems();
        }

        if (element.contextValue === 'app') {
            return this.getControllerItems(element.appCode!);
        }

        if (element.contextValue === 'controller' && element.controllerInfo) {
            return this.getMethodItems(element.controllerInfo);
        }

        if (element.contextValue === 'folder') {
            return this.getControllerItemsFromDir(element.dirPath!, element.urlPrefix!);
        }

        return [];
    }

    private getAppItems(): RouteTreeItem[] {
        const docRoot = cf.getDocRoot();
        if (!docRoot) { return []; }

        const appDir = path.join(docRoot, 'application');
        if (!fs.existsSync(appDir)) { return []; }

        const activeAppCode = cf.getAppCode();
        const entries = fs.readdirSync(appDir, { withFileTypes: true });

        return entries
            .filter(entry => {
                if (!entry.isDirectory()) { return false; }
                const controllersDir = path.join(appDir, entry.name, 'default', 'controllers');
                const controllersDir2 = path.join(appDir, entry.name, 'controllers');
                return fs.existsSync(controllersDir) || fs.existsSync(controllersDir2);
            })
            .sort((a, b) => {
                if (a.name === activeAppCode) { return -1; }
                if (b.name === activeAppCode) { return 1; }
                return a.name.localeCompare(b.name);
            })
            .map(entry => {
                const isActive = entry.name === activeAppCode;
                const item = new RouteTreeItem(
                    entry.name,
                    isActive ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
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

    private getControllerItems(appCode: string): RouteTreeItem[] {
        const docRoot = cf.getDocRoot();
        if (!docRoot) { return []; }

        const controllersDirs = [
            path.join(docRoot, 'application', appCode, 'default', 'controllers'),
            path.join(docRoot, 'application', appCode, 'controllers'),
        ];

        const items: RouteTreeItem[] = [];
        for (const dir of controllersDirs) {
            if (fs.existsSync(dir)) {
                items.push(...this.getControllerItemsFromDir(dir, ''));
            }
        }

        return items;
    }

    private getControllerItemsFromDir(dir: string, urlPrefix: string): RouteTreeItem[] {
        if (!fs.existsSync(dir)) { return []; }

        const items: RouteTreeItem[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        entries.sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) { return -1; }
            if (!a.isDirectory() && b.isDirectory()) { return 1; }
            return a.name.localeCompare(b.name);
        });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const folderItem = new RouteTreeItem(
                    entry.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'folder'
                );
                folderItem.iconPath = new vscode.ThemeIcon('folder');
                folderItem.dirPath = path.join(dir, entry.name);
                folderItem.urlPrefix = urlPrefix ? urlPrefix + '/' + entry.name : entry.name;
                items.push(folderItem);
            } else if (entry.name.endsWith('.php')) {
                const filePath = path.join(dir, entry.name);
                const controllerName = entry.name.replace('.php', '');
                const urlPath = urlPrefix ? urlPrefix + '/' + controllerName : controllerName;
                const controllerInfo = this.parseController(filePath, urlPath);

                const item = new RouteTreeItem(
                    controllerName,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'controller'
                );
                item.description = '/' + urlPath;
                item.iconPath = new vscode.ThemeIcon('symbol-class');
                item.controllerInfo = controllerInfo;
                item.command = {
                    command: 'vscode.open',
                    title: 'Open Controller',
                    arguments: [vscode.Uri.file(filePath)]
                };
                items.push(item);
            }
        }

        return items;
    }

    private getMethodItems(info: ControllerInfo): RouteTreeItem[] {
        return info.methods.map(method => {
            const label = method.verb
                ? `${method.verb.toUpperCase()} ${method.urlSegment}`
                : method.name;

            const item = new RouteTreeItem(
                label,
                vscode.TreeItemCollapsibleState.None,
                'method'
            );

            const methodUrl = method.urlSegment === 'index'
                ? '/' + info.urlPath
                : '/' + info.urlPath + '/' + method.urlSegment;
            item.description = methodUrl;

            item.iconPath = method.verb
                ? new vscode.ThemeIcon('symbol-event')
                : new vscode.ThemeIcon('symbol-method');

            item.command = {
                command: 'vscode.open',
                title: 'Go to Method',
                arguments: [
                    vscode.Uri.file(info.filePath),
                    { selection: new vscode.Range(method.line - 1, 0, method.line - 1, 0) }
                ]
            };

            return item;
        });
    }

    private parseController(filePath: string, urlPath: string): ControllerInfo {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const methods: ControllerMethod[] = [];

        const methodRegex = /^\s*(public\s+)?function\s+(\w+)\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(methodRegex);
            if (!match) { continue; }

            const methodName = match[2];
            if (BLOCKED_METHODS.includes(methodName)) { continue; }
            if (!match[1] && lines[i].match(/\b(protected|private)\b/)) { continue; }

            let verb: string | null = null;
            let urlSegment = methodName;

            for (const prefix of HTTP_VERB_PREFIXES) {
                if (prefix && methodName.startsWith(prefix) && methodName.length > prefix.length) {
                    const afterPrefix = methodName.slice(prefix.length);
                    if (afterPrefix[0] === afterPrefix[0].toUpperCase()) {
                        verb = prefix;
                        urlSegment = afterPrefix[0].toLowerCase() + afterPrefix.slice(1);
                        break;
                    }
                }
            }

            methods.push({ name: methodName, line: i + 1, verb, urlSegment });
        }

        return { filePath, urlPath, methods };
    }
}

export class RouteTreeItem extends vscode.TreeItem {
    controllerInfo?: ControllerInfo;
    dirPath?: string;
    urlPrefix?: string;
    appCode?: string;

    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
    ) {
        super(label, collapsibleState);
    }
}
