import * as vscode from "vscode";
import LinkProvider from "./providers/linkProvider";
import HoverProvider from "./providers/hoverProvider";
import ViewItemProvider from "./providers/viewItemProvider";
import initCommands from "./initCommands";
import { checkNewAnnouncement } from "./announcement";
import app from "./app";
import { reportError } from "./helper";
import { showInformationMessage } from "./host";
import logger from "./logger";
import onDocumentSaved from "./event/onDocumentSaved";
import * as websocket from "./websocket";
import * as config from "./config";
import cf from "./cf";
import phpstan from "./phpstan/phpstan";
import { CFController } from "./controller";
import ConfigItemProvider from "./providers/configItemProvider";
import TranslationItemProvider from "./providers/translationItemProvider";
import PermissionItemProvider from "./providers/permissionItemProvider";
import classNotFoundSolutionProvider from "./providers/classNotFoundCodeActionProvider";
import ClassNotFoundCodeActionProvider from "./providers/classNotFoundCodeActionProvider";
import ModelUpdateCodeActionProvider from "./providers/modelUpdateCodeActionProvider";

export const DOCUMENT_SELECTOR = [
    { scheme: "file", language: "php" },
    { scheme: "untitled", language: "php" },
    { scheme: "file", language: "blade" },
    { scheme: "file", language: "laravel-blade" },
];

export const TRIGGER_CHARACTERS = ['"', "'", ">"];
export async function activate(context: vscode.ExtensionContext) {
    //check is cf project

    if (cf.isCF()) {
        //register command
        try {
            initCommands(context);
        } catch (error) {
            reportError(error, "initCommands");
        }

        await config.check();
        let controller = new CFController();

        if (config.getConfig().liveReload) {
            websocket.start();
        }

        checkNewAnnouncement(context.globalState);

        app.statusBar.show();

        const title = "PHP CF VSCODE is Activated";
        logger.info(title);
        let infoItems: string[] = [];
        infoItems.push("phpcf " + (cf.isPhpcfInstalled() ? "✅" : "⛔"));

        const isPhpstanEnabled = cf.isPhpstanEnabled();
        infoItems.push("phpstan " + (cf.isPhpstanInstalled() ? "✅" : "⛔"));
        showInformationMessage(title, ...infoItems);

        let hover = vscode.languages.registerHoverProvider(
            ["php", "blade"],
            new HoverProvider()
        );
        let link = vscode.languages.registerDocumentLinkProvider(
            ["php", "blade"],
            new LinkProvider()
        );

        context.subscriptions.push(controller);
        context.subscriptions.push(hover, link);
        if (isPhpstanEnabled) {
            context.subscriptions.push(phpstan);
            context.subscriptions.push(phpstan.diagnosticCollection);
        }

        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                DOCUMENT_SELECTOR,
                new ViewItemProvider(),
                ...TRIGGER_CHARACTERS
            )
        );
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                DOCUMENT_SELECTOR,
                new ConfigItemProvider(),
                ...TRIGGER_CHARACTERS
            )
        );

        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                DOCUMENT_SELECTOR,
                new TranslationItemProvider(),
                ...TRIGGER_CHARACTERS
            )
        );
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                DOCUMENT_SELECTOR,
                new PermissionItemProvider(),
                ...TRIGGER_CHARACTERS
            )
        );
        // action provider
        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(
                'php',
                new ClassNotFoundCodeActionProvider(),
                {
                    providedCodeActionKinds: ClassNotFoundCodeActionProvider.providedCodeActionKinds
                }
            )
        );

        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(
                'php',
                new ModelUpdateCodeActionProvider(),
                {
                    providedCodeActionKinds: ModelUpdateCodeActionProvider.providedCodeActionKinds
                }
            )
        );

    }
}

export function deactivate() {}
