import * as vscode from "vscode";
import LinkProvider from "./providers/linkProvider";
import HoverProvider from "./providers/hoverProvider";
import ViewItemProvider from "./providers/viewItemProvider";
import initCommands from "./initCommands";
import { checkNewAnnouncement } from "./announcement";
import app from "./app";
import { reportError } from "./helper";
import { showInformationMessage } from "./host";
import {
    checkRedundantExtension,
    checkStaleFormatterSetting,
    installedRedundantExtension,
} from "./redundantExtension";
import { ensureToolOnActivate } from "./toolInstaller";
import { BladeFormattingEditProvider } from "./blade/bladeFormatter";
import { BladeDirectiveCompletionProvider } from "./blade/directiveCompletionProvider";
import logger from "./logger";
import onDocumentSaved from "./event/onDocumentSaved";
import * as websocket from "./websocket";
import * as config from "./config";
import cf from "./cf";
import phpstan from "./phpstan/phpstan";
import phpcs from "./phpcs/phpcs";
import { CFController } from "./controller";
import ConfigItemProvider from "./providers/configItemProvider";
import TranslationItemProvider from "./providers/translationItemProvider";
import PermissionItemProvider from "./providers/permissionItemProvider";
import classNotFoundSolutionProvider from "./providers/classNotFoundCodeActionProvider";
import ClassNotFoundCodeActionProvider from "./providers/classNotFoundCodeActionProvider";
import ModelUpdateCodeActionProvider from "./providers/modelUpdateCodeActionProvider";
import PhpcsfixerCodeActionProvider from "./providers/phpcsfixerCodeActionProvider";
import PHPCF from "./phpcf";
import modelUpdateShortcut from "./commands/modelUpdateShortcutCommand";
import dataDomainCommand from "./commands/dataDomainCommand";
import resolveUrlCommand from "./commands/resolveUrlCommand";
import generateIdeHelperCommand from "./commands/generateIdeHelperCommand";
import { PhpcsfixerFormattingEditProvider } from "./providers/phpcsfixerFormattingEditProvider";
import { CFPanelProvider } from "./providers/cfPanelProvider";
import { DiagnosticProvider as PermissionDiagnosticProvider } from "./diagnostics";
import { checkDevcloudInstalled, checkDevcloudUpdate, installDevcloud } from "./devcloud/installDevcloud";
import { activate as activateSftp, deactivate as deactivateSftp } from "./sftp-vendor/extension";

export const DOCUMENT_SELECTOR = [
    { scheme: "file", language: "php" },
    { scheme: "untitled", language: "php" },
    { scheme: "file", language: "blade" },
    { scheme: "file", language: "laravel-blade" },
];

export const TRIGGER_CHARACTERS = ['"', "'", ">"];
export async function activate(context: vscode.ExtensionContext) {
    try {
        await activateSftp(context);
    } catch (error) {
        reportError(error instanceof Error ? error : String(error), "sftp.activate");
    }


    //check is cf project
    if (cf.isCF()) {
        //register command
        try {
            initCommands(context);
        } catch (error) {
            reportError(error instanceof Error ? error : String(error), "initCommands");
        }

        context.subscriptions.push(
            vscode.commands.registerCommand('phpcf.modelUpdateShortcut', modelUpdateShortcut)
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('phpcf.dataDomain', dataDomainCommand)
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('phpcf.resolveUrl', resolveUrlCommand)
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('phpcf.generateIdeHelper', generateIdeHelperCommand)
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('phpcf.installDevcloud', installDevcloud)
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('phpcf.checkDevcloudUpdate', checkDevcloudUpdate)
        );

        void checkDevcloudInstalled();

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
        infoItems.push("phpstan " + (cf.isPhpStanInstalled() ? "✅" : "⛔"));

        const isPhpcsEnabled = cf.isPhpcsEnabled();
        infoItems.push("phpcs " + (cf.isPhpCsInstalled() ? "✅" : "⛔"));
        infoItems.push("php-cs-fixer " + (cf.isPhpCsFixerInstalled() ? "✅" : "⛔"));

        const redundant = installedRedundantExtension();
        if (redundant.length > 0) {
            infoItems.push("ekstensi mubazir: " + redundant.join(", "));
        }
        showInformationMessage(title, ...infoItems);

        checkRedundantExtension(context.globalState);
        checkStaleFormatterSetting();
        ensureToolOnActivate();
        BladeFormattingEditProvider.activate(context);
        BladeDirectiveCompletionProvider.activate(context);

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
        if (isPhpcsEnabled) {
            context.subscriptions.push(phpcs);
            context.subscriptions.push(phpcs.diagnosticCollection);
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

        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(
                'php',
                new PhpcsfixerCodeActionProvider(),
                {
                    providedCodeActionKinds: PhpcsfixerCodeActionProvider.providedCodeActionKinds
                }
            )
        );

        PhpcsfixerFormattingEditProvider.activate(context);

        const cfPanelProvider = new CFPanelProvider(context.extensionUri);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('phpcfPanel', cfPanelProvider)
        );

        const permissionDiagnostic = new PermissionDiagnosticProvider();
        permissionDiagnostic.activate(context);
    }
}

export function deactivate() {
    deactivateSftp();
}
