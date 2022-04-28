'use strict';

import {
    DocumentLinkProvider as vsDocumentLinkProvider,
    TextDocument,
    ProviderResult,
    DocumentLink,
    workspace,
    Position,
    Range
} from "vscode"
import * as util from '../util';

import { CONTROLLER_URL_REGEX, VIEW_REGEX } from "../constant";
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
                        let file = util.getFilePath(item, doc);

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
                            console.log(routeData);
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
        return documentLinks;
    }
}
