'use strict';

import {
    HoverProvider as vsHoverProvider,
    TextDocument,
    Position,
    ProviderResult,
    Hover,
    workspace,
    MarkdownString
} from "vscode";
import * as util from '../util';

import { CONTROLLER_URL_REGEX, VIEW_REGEX, PERMISSION_REGEX } from "../constant";

export default class HoverProvider implements vsHoverProvider {
    provideHover(doc: TextDocument, pos: Position): ProviderResult<Hover> {

        let reg = new RegExp(VIEW_REGEX);
        let linkRange = doc.getWordRangeAtPosition(pos, reg);

        if(linkRange) {

            let filePaths = util.getViewFilePaths(doc.getText(linkRange), doc);
            let workspaceFolder = workspace.getWorkspaceFolder(doc.uri);
            if (workspaceFolder && filePaths.length > 0) {
                let text: string = "";

                for (let i in filePaths) {
                    // text += config.viewFolderTip ? `\`${filePaths[i].name}\`` : '';
                    text += ` [${workspaceFolder.name + filePaths[i].showPath}](${filePaths[i].fileUri})  \r`;
                }

                return new Hover(new MarkdownString(text));
            }
        }
        reg = new RegExp(CONTROLLER_URL_REGEX);
        linkRange = doc.getWordRangeAtPosition(pos, reg);
        if(linkRange) {

            let routeData = util.getRouteData(doc.getText(linkRange), doc);
            if(routeData) {
                let text = ` [${routeData.path}](${routeData.fileUri})  \r`;
                return new Hover(new MarkdownString(text));
            }

        }

        reg = new RegExp(PERMISSION_REGEX);
        linkRange = doc.getWordRangeAtPosition(pos, reg);
        if (linkRange) {
            const permissionName = doc.getText(linkRange).replace(/['"]/g, '');
            const definition = util.findPermissionDefinition(permissionName, doc);
            if (definition) {
                const fileUri = `${definition.filePath}#${definition.line}`;
                const relativePath = workspace.asRelativePath(definition.filePath);
                const text = `**Permission:** \`${permissionName}\`\n\n[${relativePath}:${definition.line}](${fileUri})`;
                return new Hover(new MarkdownString(text));
            }
        }
    }

}
