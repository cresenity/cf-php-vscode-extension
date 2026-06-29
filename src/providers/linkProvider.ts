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
        const text = doc.getText();
        const lines = text.split('\n');

        const sections = this.findThemeSections(lines);

        for (const section of sections) {
            for (let i = section.start; i <= section.end; i++) {
                const line = lines[i];

                if (section.type === 'css' || section.type === 'js') {
                    const assetRegex = /['"]([^'"]+)[']/g;
                    let match: RegExpExecArray | null;
                    while ((match = assetRegex.exec(line)) !== null) {
                        const fileName = match[1];
                        if (!fileName.includes('.' + section.type)) { continue; }
                        const resolved = util.resolveThemeAssetPath(fileName, section.type, doc);
                        if (resolved) {
                            const startCol = line.indexOf(fileName, match.index);
                            const start = new Position(i, startCol);
                            const end = start.translate(0, fileName.length);
                            documentLinks.push(new DocumentLink(new Range(start, end), Uri.file(resolved)));
                        }
                    }
                } else if (section.type === 'client_modules') {
                    const moduleRegex = /['"]([^'"]+)[']/g;
                    let match: RegExpExecArray | null;
                    while ((match = moduleRegex.exec(line)) !== null) {
                        const moduleName = match[1];
                        if (moduleName === 'client_modules') { continue; }
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

    private findThemeSections(lines: string[]): { type: string; start: number; end: number }[] {
        const sections: { type: string; start: number; end: number }[] = [];
        const sectionKeys = ['css', 'js', 'client_modules'];

        for (let i = 0; i < lines.length; i++) {
            for (const key of sectionKeys) {
                const regex = new RegExp(`['"]${key}['"]\\s*=>\\s*\\[`);
                if (!regex.test(lines[i])) { continue; }

                let depth = 0;
                let started = false;
                for (let j = i; j < lines.length; j++) {
                    for (const ch of lines[j]) {
                        if (ch === '[') { depth++; started = true; }
                        if (ch === ']') { depth--; }
                    }
                    if (started && depth <= 0) {
                        sections.push({ type: key, start: i + 1, end: j - 1 });
                        break;
                    }
                }
            }
        }

        return sections;
    }
}
