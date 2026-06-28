'use strict';

import {
    DocumentLinkProvider as vsDocumentLinkProvider,
    TextDocument,
    ProviderResult,
    DocumentLink,
    workspace,
    Position,
    Range,
    Uri
} from "vscode"
import * as path from 'path';
import * as util from '../util';
import cf from '../cf';

import { CONTROLLER_URL_REGEX, VIEW_REGEX, PERMISSION_REGEX } from "../constant";
export default class LinkProvider implements vsDocumentLinkProvider {
    public provideDocumentLinks(doc: TextDocument): ProviderResult<DocumentLink[]> {
        let documentLinks = [];
        let config = workspace.getConfiguration('phpcf');

        if (config.viewQuickJump) {
            let reg = new RegExp(VIEW_REGEX, 'g');
            let linesCount = doc.lineCount <= config.maxLineScanningCount ? doc.lineCount : config.maxLineScanningCount
            let index = 0;
            while (index < linesCount) {
                let line = doc.lineAt(index);
                let result = line.text.match(reg);

                if (result != null) {
                    for (let item of result) {
                        let file = util.getViewFilePath(item, doc);

                        if (file != null) {
                            let start = new Position(line.lineNumber, line.text.indexOf(item) + 1);
                            let end = start.translate(0, item.length - 2);
                            let documentlink = new DocumentLink(new Range(start, end), file.fileUri);
                            documentLinks.push(documentlink);
                        };
                    }
                }

                index++;
            }
        }
        if (config.uriControllerQuickJump) {
            let reg = new RegExp(CONTROLLER_URL_REGEX, 'g');
            let linesCount = doc.lineCount <= config.maxLineScanningCount ? doc.lineCount : config.maxLineScanningCount
            let index = 0;
            while (index < linesCount) {
                let line = doc.lineAt(index);
                let result = line.text.match(reg);

                if (result != null) {
                    for (let item of result) {
                        let routeData = util.getRouteData(item, doc);

                        if (routeData != null) {
                            let start = new Position(line.lineNumber, line.text.indexOf(item) + 1);
                            let end = start.translate(0, item.length - 2);
                            let documentlink = new DocumentLink(new Range(start, end), routeData.fileUri);
                            documentLinks.push(documentlink);
                        };
                    }
                }

                index++;
            }
        }
        if (config.viewQuickJump) {
            let permReg = new RegExp(PERMISSION_REGEX, 'g');
            let permLinesCount = doc.lineCount <= config.maxLineScanningCount ? doc.lineCount : config.maxLineScanningCount;
            let permIndex = 0;
            while (permIndex < permLinesCount) {
                let line = doc.lineAt(permIndex);
                let result = line.text.match(permReg);

                if (result != null) {
                    for (let item of result) {
                        let permissionName = item.replace(/['"]/g, '');
                        let definition = util.findPermissionDefinition(permissionName, doc);

                        if (definition != null) {
                            let start = new Position(line.lineNumber, line.text.indexOf(item) + 1);
                            let end = start.translate(0, item.length - 2);
                            let fileUri = Uri.file(definition.filePath).with({ fragment: definition.line.toString() });
                            let documentlink = new DocumentLink(new Range(start, end), fileUri);
                            documentLinks.push(documentlink);
                        }
                    }
                }

                permIndex++;
            }
        }
        const appRoot = cf.getAppRoot(doc);
        if (appRoot) {
            const themesDir = path.join(appRoot, 'default', 'themes');
            if (doc.uri.fsPath.startsWith(themesDir)) {
                this.addThemeLinks(doc, documentLinks);
            }
        }

        return documentLinks;
    }

    private addThemeLinks(doc: TextDocument, documentLinks: DocumentLink[]) {
        const assetRegex = /['"]([^'"]+\.(?:css|js)(?:\?[^'"]*)?)[']/g;
        const moduleRegex = /['"]([^'"]+)['"]/g;
        const lines = doc.getText().split('\n');

        let inCss = false;
        let inJs = false;
        let inModules = false;
        let depth = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.match(/['"]css['"]\s*=>/)) { inCss = true; inJs = false; inModules = false; depth = 0; }
            else if (line.match(/['"]js['"]\s*=>/)) { inJs = true; inCss = false; inModules = false; depth = 0; }
            else if (line.match(/['"]client_modules['"]\s*=>/)) { inModules = true; inCss = false; inJs = false; depth = 0; }
            else if (line.match(/['"](?:data|scss|client_modules|css|js)['"]\s*=>/) && !inCss && !inJs && !inModules) {
                continue;
            }

            for (const ch of line) {
                if (ch === '[') { depth++; }
                if (ch === ']') { depth--; }
            }
            if (depth <= 0 && (inCss || inJs || inModules)) {
                inCss = false; inJs = false; inModules = false;
                continue;
            }

            if (inCss || inJs) {
                const type = inCss ? 'css' : 'js';
                let match: RegExpExecArray | null;
                const regex = new RegExp(assetRegex.source, 'g');
                while ((match = regex.exec(line)) !== null) {
                    const fileName = match[1];
                    if (inCss && !fileName.includes('.css')) { continue; }
                    if (inJs && !fileName.includes('.js')) { continue; }
                    const resolved = util.resolveThemeAssetPath(fileName, type, doc);
                    if (resolved) {
                        const startCol = line.indexOf(fileName, match.index);
                        const start = new Position(i, startCol);
                        const end = start.translate(0, fileName.length);
                        documentLinks.push(new DocumentLink(new Range(start, end), Uri.file(resolved)));
                    }
                }
            }

            if (inModules) {
                let match: RegExpExecArray | null;
                const regex = new RegExp(moduleRegex.source, 'g');
                while ((match = regex.exec(line)) !== null) {
                    const moduleName = match[1];
                    const definition = util.resolveClientModuleDefinition(moduleName, doc);
                    if (definition) {
                        const startCol = line.indexOf(moduleName, match.index);
                        const start = new Position(i, startCol);
                        const end = start.translate(0, moduleName.length);
                        const fileUri = Uri.file(definition.filePath).with({ fragment: definition.line.toString() });
                        documentLinks.push(new DocumentLink(new Range(start, end), fileUri));
                    }
                }
            }
        }
    }
}
