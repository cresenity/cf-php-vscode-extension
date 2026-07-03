import * as vscode from 'vscode';
import * as path from 'path';
import cf from '../cf';
import { buildCommentMap, stripInlineComment } from './commentHelper';
import { checkPermissions } from './permissionDiagnostic';
import { checkDuplicatePermissions } from './duplicatePermissionDiagnostic';
import { checkViews } from './viewDiagnostic';
import { checkControllerUri } from './controllerUriDiagnostic';
import { checkDeprecatedRender } from './deprecatedRenderDiagnostic';
import { checkThemeAssets } from './themeAssetDiagnostic';
import { checkThemeClientModules } from './themeClientModuleDiagnostic';
import { checkTranslations, buildTranslationContext } from './translationDiagnostic';

export class DiagnosticProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('phpcf');
    }

    activate(context: vscode.ExtensionContext) {
        context.subscriptions.push(this.diagnosticCollection);

        if (vscode.window.activeTextEditor) {
            this.updateDiagnostics(vscode.window.activeTextEditor.document);
        }

        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) { this.updateDiagnostics(editor.document); }
            }),
            vscode.workspace.onDidSaveTextDocument(document => {
                this.updateDiagnostics(document);
            }),
            vscode.workspace.onDidCloseTextDocument(document => {
                this.diagnosticCollection.delete(document.uri);
            })
        );
    }

    updateDiagnostics(document: vscode.TextDocument) {
        if (document.languageId !== 'php') { return; }
        if (!cf.isOnAppDirectory(document)) { return; }

        const diagnostics: vscode.Diagnostic[] = [];
        const lines = document.getText().split('\n');
        const commentedLines = buildCommentMap(lines);

        const appRoot = cf.getAppRoot(document);
        const isThemeFile = appRoot
            ? document.uri.fsPath.startsWith(path.join(appRoot, 'default', 'themes'))
            : false;

        if (isThemeFile) {
            checkThemeAssets(lines, commentedLines, document, diagnostics);
            checkThemeClientModules(lines, commentedLines, document, diagnostics);
        } else {
            const transCtx = buildTranslationContext(document);
            for (let i = 0; i < lines.length; i++) {
                if (commentedLines[i]) { continue; }
                const line = stripInlineComment(lines[i]);
                checkPermissions(line, i, document, diagnostics);
                checkViews(line, i, document, diagnostics);
                checkControllerUri(line, i, document, diagnostics);
                checkDeprecatedRender(line, i, diagnostics);
                if (transCtx) {
                    checkTranslations(lines[i], i, diagnostics, transCtx);
                }
            }
        }

        checkDuplicatePermissions(document, diagnostics);
        this.diagnosticCollection.set(document.uri, diagnostics);
    }
}

// backward-compatible alias for extension.ts
export { DiagnosticProvider as PermissionDiagnosticProvider };
