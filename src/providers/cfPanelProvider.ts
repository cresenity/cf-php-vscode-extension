import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import cf from '../cf';

const HTTP_VERB_PREFIXES = ['get', 'post', 'put', 'patch', 'delete', 'options', 'any'];
const BLOCKED_METHODS = ['__construct', '__call', '__get', '__set', '__isset', '__unset', '__toString', '__invoke', '__clone', '__debugInfo', '__destruct', '__sleep', '__wakeup', 'callAction', 'middleware', 'getMiddleware'];

interface TreeNode {
    label: string;
    description?: string;
    icon?: string;
    children?: TreeNode[];
    filePath?: string;
    line?: number;
    type: 'app' | 'folder' | 'controller' | 'method' | 'model' | 'table' | 'info';
    expanded?: boolean;
}

export class CFPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'phpcfPanel';
    private _view?: vscode.WebviewView;
    private modelCache: Map<string, any[]> = new Map();

    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
        };

        webviewView.webview.html = this.getHtml();

        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'openFile':
                    const uri = vscode.Uri.file(message.filePath);
                    if (message.line && message.line > 0) {
                        const pos = new vscode.Position(message.line - 1, 0);
                        vscode.window.showTextDocument(uri, { selection: new vscode.Range(pos, pos), preserveFocus: false });
                    } else {
                        vscode.window.showTextDocument(uri);
                    }
                    break;
                case 'getRoutes':
                    const routes = this.getRoutesData();
                    webviewView.webview.postMessage({ command: 'routes', data: routes });
                    break;
                case 'getModels':
                    const models = await this.getModelsData(message.appCode);
                    webviewView.webview.postMessage({ command: 'models', data: models, appCode: message.appCode });
                    break;
                case 'createModel':
                    this.createModel(message.table, message.appCode);
                    break;
                case 'refresh':
                    this.modelCache.clear();
                    const refreshedRoutes = this.getRoutesData();
                    const activeApp = cf.getAppCode();
                    webviewView.webview.postMessage({ command: 'routes', data: refreshedRoutes, activeAppCode: activeApp });
                    break;
            }
        });

        const phpcfInstalled = cf.isPhpcfInstalled();
        const activeAppCode = cf.getAppCode();
        if (!phpcfInstalled) {
            webviewView.webview.postMessage({ command: 'phpcfNotInstalled' });
        } else {
            const routes = this.getRoutesData();
            webviewView.webview.postMessage({ command: 'routes', data: routes, activeAppCode });
        }

        let lastAppCode = activeAppCode;
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (!editor || !this._view) { return; }
            const newAppCode = cf.getAppCode(editor.document);
            if (newAppCode && newAppCode !== lastAppCode) {
                lastAppCode = newAppCode;
                this._view.webview.postMessage({ command: 'activeAppChanged', activeAppCode: newAppCode });
            }
        });
    }

    private createModel(table: string, appCode: string) {
        const docRoot = cf.getDocRoot();
        if (!docRoot) { return; }
        const cwd = path.join(docRoot, 'application', appCode);
        const terminal = vscode.window.createTerminal({
            name: `phpcf make:model ${table}`,
            cwd,
        });
        terminal.show();
        terminal.sendText(`phpcf make:model ${table}`);
    }

    private getRoutesData(): TreeNode[] {
        const docRoot = cf.getDocRoot();
        if (!docRoot) { return []; }

        const appDir = path.join(docRoot, 'application');
        if (!fs.existsSync(appDir)) { return []; }

        const activeAppCode = cf.getAppCode();
        const entries = fs.readdirSync(appDir, { withFileTypes: true });

        return entries
            .filter(entry => {
                if (!entry.isDirectory()) { return false; }
                return fs.existsSync(path.join(appDir, entry.name, 'default', 'controllers'))
                    || fs.existsSync(path.join(appDir, entry.name, 'controllers'));
            })
            .sort((a, b) => {
                if (a.name === activeAppCode) { return -1; }
                if (b.name === activeAppCode) { return 1; }
                return a.name.localeCompare(b.name);
            })
            .map(entry => {
                const isActive = entry.name === activeAppCode;
                return {
                    label: entry.name,
                    description: isActive ? '(active)' : undefined,
                    icon: isActive ? 'folder-opened' : 'folder',
                    type: 'app' as const,
                    expanded: isActive,
                    children: this.getControllerNodes(docRoot, entry.name),
                };
            });
    }

    private getControllerNodes(docRoot: string, appCode: string): TreeNode[] {
        const dirs = [
            path.join(docRoot, 'application', appCode, 'default', 'controllers'),
            path.join(docRoot, 'application', appCode, 'controllers'),
        ];

        const items: TreeNode[] = [];
        for (const dir of dirs) {
            if (fs.existsSync(dir)) {
                items.push(...this.scanControllerDir(dir, ''));
            }
        }
        return items;
    }

    private scanControllerDir(dir: string, urlPrefix: string): TreeNode[] {
        if (!fs.existsSync(dir)) { return []; }

        const items: TreeNode[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        entries.sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) { return -1; }
            if (!a.isDirectory() && b.isDirectory()) { return 1; }
            return a.name.localeCompare(b.name);
        });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subPrefix = urlPrefix ? urlPrefix + '/' + entry.name : entry.name;
                items.push({
                    label: entry.name,
                    icon: 'folder',
                    type: 'folder',
                    children: this.scanControllerDir(path.join(dir, entry.name), subPrefix),
                });
            } else if (entry.name.endsWith('.php')) {
                const filePath = path.join(dir, entry.name);
                const controllerName = entry.name.replace('.php', '');
                const urlPath = urlPrefix ? urlPrefix + '/' + controllerName : controllerName;
                const methods = this.parseControllerMethods(filePath, urlPath);

                items.push({
                    label: controllerName,
                    description: '/' + urlPath,
                    icon: 'symbol-class',
                    type: 'controller',
                    filePath: filePath,
                    children: methods,
                });
            }
        }
        return items;
    }

    private parseControllerMethods(filePath: string, urlPath: string): TreeNode[] {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const methods: TreeNode[] = [];
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

            const label = verb ? `${verb.toUpperCase()} ${urlSegment}` : methodName;
            const methodUrl = urlSegment === 'index' ? '/' + urlPath : '/' + urlPath + '/' + urlSegment;

            methods.push({
                label,
                description: methodUrl,
                icon: verb ? 'symbol-event' : 'symbol-method',
                type: 'method',
                filePath: filePath,
                line: i + 1,
            });
        }
        return methods;
    }

    private async getModelsData(appCode: string): Promise<TreeNode[]> {
        let cached = this.modelCache.get(appCode);
        if (cached) { return cached; }

        const models = await this.fetchModels(appCode);
        this.modelCache.set(appCode, models);
        return models;
    }

    private fetchModels(appCode: string): Promise<TreeNode[]> {
        const phpcfPath = cf.getPhpcfPath();
        const docRoot = cf.getDocRoot();
        if (!phpcfPath || !docRoot) { return Promise.resolve([]); }

        const cwd = path.join(docRoot, 'application', appCode);
        if (!fs.existsSync(cwd)) { return Promise.resolve([]); }

        return new Promise(resolve => {
            cp.exec(`"${phpcfPath}" model:tables`, { cwd, timeout: 30000 }, (err, stdout) => {
                if (err || !stdout) {
                    resolve([{ label: 'Failed to load models', type: 'info', icon: 'warning' }]);
                    return;
                }
                resolve(this.parseModelsOutput(stdout, docRoot, appCode));
            });
        });
    }

    private parseModelsOutput(output: string, docRoot: string, appCode: string): TreeNode[] {
        const nodes: TreeNode[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            if (!line.startsWith('|') || line.includes('---') || line.includes('table')) { continue; }
            const parts = line.split('|').map(p => p.trim()).filter(p => p.length > 0);
            if (parts.length < 2) { continue; }

            const table = parts[0];
            const model = parts[1] || '';
            const hasModel = model.length > 0;

            const node: TreeNode = {
                label: table,
                description: hasModel ? model : '(no model)',
                icon: hasModel ? 'symbol-class' : 'symbol-field',
                type: hasModel ? 'model' : 'table',
            };

            if (hasModel) {
                const modelFile = this.findModelFile(docRoot, appCode, model);
                if (modelFile) {
                    node.filePath = modelFile;
                }
            }

            nodes.push(node);
        }
        return nodes;
    }

    private findModelFile(docRoot: string, appCode: string, modelName: string): string | null {
        const appRoot = path.join(docRoot, 'application', appCode);
        const libDirs = [
            path.join(appRoot, 'default', 'libraries'),
            path.join(appRoot, 'libraries'),
        ];

        for (const libDir of libDirs) {
            if (!fs.existsSync(libDir)) { continue; }
            const prefixDirs = fs.readdirSync(libDir, { withFileTypes: true })
                .filter(d => d.isDirectory() && d.name.endsWith('Model'));

            for (const prefixDir of prefixDirs) {
                const dirPath = path.join(libDir, prefixDir.name);
                const result = this.findFileRecursive(dirPath, modelName + '.php');
                if (result) { return result; }
            }
        }
        return null;
    }

    private findFileRecursive(dir: string, fileName: string): string | null {
        if (!fs.existsSync(dir)) { return null; }
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isFile() && entry.name === fileName) { return fullPath; }
            if (entry.isDirectory()) {
                const result = this.findFileRecursive(fullPath, fileName);
                if (result) { return result; }
            }
        }
        return null;
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-sideBar-background); overflow: hidden; }

    .tabs {
        display: flex;
        border-bottom: 1px solid var(--vscode-panel-border);
        background: var(--vscode-editor-background);
        position: sticky;
        top: 0;
        z-index: 10;
    }
    .tab {
        padding: 8px 16px;
        cursor: pointer;
        border: none;
        background: none;
        color: var(--vscode-foreground);
        font-size: 11px;
        font-family: var(--vscode-font-family);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.7;
        border-bottom: 2px solid transparent;
    }
    .tab:hover { opacity: 1; }
    .tab.active {
        opacity: 1;
        border-bottom-color: var(--vscode-focusBorder);
    }

    .toolbar {
        display: flex;
        justify-content: flex-end;
        padding: 4px 8px;
        border-bottom: 1px solid var(--vscode-panel-border);
    }
    .toolbar button {
        background: none;
        border: none;
        color: var(--vscode-foreground);
        cursor: pointer;
        padding: 2px 6px;
        opacity: 0.7;
        font-family: var(--vscode-font-family);
        font-size: 12px;
    }
    .toolbar button:hover { opacity: 1; }

    .panel { display: none; overflow-y: auto; height: calc(100vh - 70px); }
    .panel.active { display: block; }

    .tree-item {
        display: flex;
        align-items: center;
        padding: 2px 0;
        padding-left: calc(var(--depth, 0) * 16px + 4px);
        cursor: pointer;
        white-space: nowrap;
        min-height: 22px;
    }
    .tree-item:hover { background: var(--vscode-list-hoverBackground); }
    .tree-item .chevron {
        width: 16px;
        text-align: center;
        font-size: 10px;
        flex-shrink: 0;
        opacity: 0.7;
    }
    .tree-item .icon {
        width: 16px;
        text-align: center;
        margin-right: 4px;
        flex-shrink: 0;
    }
    .tree-item .label { flex-shrink: 0; }
    .tree-item .desc {
        opacity: 0.6;
        margin-left: 8px;
        font-size: 0.9em;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .tree-children { display: none; }
    .tree-children.expanded { display: block; }

    .loading {
        padding: 12px;
        opacity: 0.6;
        font-style: italic;
    }

    .info-banner {
        padding: 12px;
        background: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        margin: 8px;
        border-radius: 4px;
        font-size: 12px;
        line-height: 1.5;
    }
    .info-banner code {
        background: var(--vscode-textCodeBlock-background);
        padding: 1px 4px;
        border-radius: 2px;
    }

    .action-btn {
        background: none;
        border: none;
        color: var(--vscode-textLink-foreground);
        cursor: pointer;
        font-size: 11px;
        padding: 0 4px;
        margin-left: 4px;
        font-family: var(--vscode-font-family);
    }
    .action-btn:hover { text-decoration: underline; }

    .no-model { opacity: 0.5; }
</style>
</head>
<body>
    <div class="tabs">
        <button class="tab active" data-tab="routes">Routes</button>
        <button class="tab" data-tab="models">Models</button>
    </div>
    <div class="toolbar">
        <button id="refreshBtn" title="Refresh">↻ Refresh</button>
    </div>
    <div id="routes" class="panel active"></div>
    <div id="models" class="panel"></div>

<script>
    const vscode = acquireVsCodeApi();
    let allRoutesData = [];
    let modelsAppList = [];
    let modelsCache = {};
    let currentTab = 'routes';
    let activeAppCode = null;

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            document.getElementById(currentTab).classList.add('active');

            if (currentTab === 'models') {
                renderModelsAppList();
            }
        });
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
        if (currentTab === 'routes') {
            vscode.postMessage({ command: 'refresh' });
        } else {
            modelsCache = {};
            renderModelsAppList();
        }
    });

    function getFilteredData(data) {
        if (activeAppCode) {
            return data.filter(a => a.label === activeAppCode);
        }
        return data;
    }

    function renderRoutes() {
        const filtered = getFilteredData(allRoutesData);
        filtered.forEach(a => { a.expanded = true; });
        renderTree(document.getElementById('routes'), filtered, 0);
    }

    window.addEventListener('message', e => {
        const msg = e.data;
        if (msg.command === 'phpcfNotInstalled') {
            document.getElementById('routes').innerHTML =
                '<div class="info-banner">⚠️ <code>phpcf</code> is not installed.<br><br>Install via composer:<br><code>composer global require cresenity/phpcf</code></div>';
            document.getElementById('models').innerHTML =
                '<div class="info-banner">⚠️ <code>phpcf</code> is not installed.<br><br>Install via composer:<br><code>composer global require cresenity/phpcf</code></div>';
        }
        if (msg.command === 'routes') {
            allRoutesData = msg.data || [];
            if (msg.activeAppCode) { activeAppCode = msg.activeAppCode; }
            modelsAppList = allRoutesData.map(a => ({ label: a.label, description: a.description }));
            renderRoutes();
        }
        if (msg.command === 'models') {
            modelsCache[msg.appCode] = msg.data;
            const container = document.getElementById('models-' + msg.appCode);
            if (container) {
                container.innerHTML = '';
                renderModelNodes(container, msg.data, msg.appCode);
                container.classList.add('expanded');
            }
        }
        if (msg.command === 'activeAppChanged') {
            activeAppCode = msg.activeAppCode;
            renderRoutes();
            if (currentTab === 'models') {
                renderModelsAppList();
            }
        }
    });

    function renderTree(container, nodes, depth) {
        container.innerHTML = '';
        renderNodes(container, nodes, depth);
    }

    function renderNodes(container, nodes, depth) {
        if (!nodes) return;
        nodes.forEach(node => {
            const hasChildren = node.children && node.children.length > 0;

            const item = document.createElement('div');
            item.className = 'tree-item';
            item.style.setProperty('--depth', depth);

            const chevron = document.createElement('span');
            chevron.className = 'chevron';
            chevron.textContent = hasChildren ? (node.expanded ? '▼' : '▶') : ' ';
            item.appendChild(chevron);

            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.textContent = getIcon(node.icon);
            item.appendChild(icon);

            const label = document.createElement('span');
            label.className = 'label';
            label.textContent = node.label;
            item.appendChild(label);

            if (node.description) {
                const desc = document.createElement('span');
                desc.className = 'desc';
                desc.textContent = node.description;
                item.appendChild(desc);
            }

            container.appendChild(item);

            let childContainer;
            if (hasChildren) {
                childContainer = document.createElement('div');
                childContainer.className = 'tree-children' + (node.expanded ? ' expanded' : '');
                renderNodes(childContainer, node.children, depth + 1);
                container.appendChild(childContainer);
            }

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (hasChildren) {
                    const isExpanded = childContainer.classList.contains('expanded');
                    childContainer.classList.toggle('expanded');
                    chevron.textContent = isExpanded ? '▶' : '▼';
                }
                if (node.filePath) {
                    vscode.postMessage({ command: 'openFile', filePath: node.filePath, line: node.line || 0 });
                }
            });
        });
    }

    function renderModelNodes(container, nodes, appCode) {
        if (!nodes) return;
        nodes.forEach(node => {
            const item = document.createElement('div');
            item.className = 'tree-item' + (node.type === 'table' ? ' no-model' : '');
            item.style.setProperty('--depth', 1);

            const chevron = document.createElement('span');
            chevron.className = 'chevron';
            chevron.textContent = ' ';
            item.appendChild(chevron);

            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.textContent = getIcon(node.icon);
            item.appendChild(icon);

            const label = document.createElement('span');
            label.className = 'label';
            label.textContent = node.label;
            item.appendChild(label);

            if (node.description) {
                const desc = document.createElement('span');
                desc.className = 'desc';
                desc.textContent = node.description;
                item.appendChild(desc);
            }

            if (node.type === 'table') {
                const btn = document.createElement('button');
                btn.className = 'action-btn';
                btn.textContent = '[create model]';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    vscode.postMessage({ command: 'createModel', table: node.label, appCode: appCode });
                });
                item.appendChild(btn);
            }

            container.appendChild(item);

            if (node.filePath) {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    vscode.postMessage({ command: 'openFile', filePath: node.filePath, line: 0 });
                });
            }
        });
    }

    function renderModelsAppList() {
        const container = document.getElementById('models');
        container.innerHTML = '';

        const filtered = getFilteredData(modelsAppList);
        if (filtered.length === 0) {
            if (allRoutesData.length === 0) {
                container.innerHTML = '<div class="loading">No apps found. Try refreshing.</div>';
            } else {
                container.innerHTML = '<div class="loading">No active app detected.</div>';
            }
            return;
        }

        filtered.forEach(app => {
            const item = document.createElement('div');
            item.className = 'tree-item';
            item.style.setProperty('--depth', 0);

            const chevron = document.createElement('span');
            chevron.className = 'chevron';
            chevron.textContent = '▶';
            item.appendChild(chevron);

            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.textContent = '📁';
            item.appendChild(icon);

            const label = document.createElement('span');
            label.className = 'label';
            label.textContent = app.label;
            item.appendChild(label);

            container.appendChild(item);

            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children';
            childContainer.id = 'models-' + app.label;
            container.appendChild(childContainer);

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const isExpanded = childContainer.classList.contains('expanded');
                childContainer.classList.toggle('expanded');
                chevron.textContent = isExpanded ? '▶' : '▼';

                if (!isExpanded && !modelsCache[app.label]) {
                    childContainer.innerHTML = '<div class="loading">Loading models...</div>';
                    vscode.postMessage({ command: 'getModels', appCode: app.label });
                }
            });
        });
    }

    function getIcon(name) {
        const icons = {
            'folder': '📁', 'folder-opened': '📂',
            'symbol-class': '🔷', 'symbol-method': '⚡',
            'symbol-event': '🔸', 'symbol-field': '◽',
            'warning': '⚠️',
        };
        return icons[name] || '•';
    }

    vscode.postMessage({ command: 'getRoutes' });
</script>
</body>
</html>`;
    }
}
