import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getAppDefaultLocale, translationKeyExistsInLocale } from '../util';
import cf from '../cf';

export interface TranslationContext {
    defaultLocale: string;
    nonDefaultLocales: string[];
    appI18nDir: string;
    systemI18nDir: string;
}

export function buildTranslationContext(document: vscode.TextDocument): TranslationContext | null {
    const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    if (!wsFolder) { return null; }
    const appRoot = cf.getAppRoot(document);
    if (!appRoot) { return null; }

    const defaultLocale = getAppDefaultLocale(document);
    if (!defaultLocale) { return null; }

    const appI18nDir = path.join(appRoot, 'default', 'i18n');
    if (!fs.existsSync(appI18nDir)) { return null; }

    const allLocales = fs.readdirSync(appI18nDir).filter(d =>
        fs.statSync(path.join(appI18nDir, d)).isDirectory()
    );
    if (allLocales.length <= 1) { return null; }

    const nonDefaultLocales = allLocales.filter(l => l !== defaultLocale);
    if (nonDefaultLocales.length === 0) { return null; }

    return { defaultLocale, nonDefaultLocales, appI18nDir, systemI18nDir: path.join(wsFolder, 'system', 'i18n') };
}

function checkTransKey(transKey: string, matchIndex: number, line: string, lineIndex: number, diagnostics: vscode.Diagnostic[], ctx: TranslationContext) {
    if (!transKey) { return; }
    const missingLocales = ctx.nonDefaultLocales.filter(locale =>
        !translationKeyExistsInLocale(transKey, locale, ctx.appI18nDir, ctx.systemI18nDir)
    );
    if (missingLocales.length === 0) { return; }
    const startCol = line.indexOf(transKey, matchIndex);
    const range = new vscode.Range(lineIndex, startCol, lineIndex, startCol + transKey.length);
    const diagnostic = new vscode.Diagnostic(
        range,
        `Translation '${transKey}' missing in: ${missingLocales.join(', ')}`,
        vscode.DiagnosticSeverity.Warning
    );
    diagnostic.source = 'phpcf';
    diagnostic.code = 'translation-missing-locale';
    diagnostics.push(diagnostic);
}

export function checkTranslations(line: string, lineIndex: number, diagnostics: vscode.Diagnostic[], ctx: TranslationContext) {
    const transRegex = /(?:c::trans|c::__|\@lang)\(\s*(['"])([^'"]*)\1/g;
    let match: RegExpExecArray | null;
    while ((match = transRegex.exec(line)) !== null) {
        checkTransKey(match[2], match.index, line, lineIndex, diagnostics, ctx);
    }

    // setLabel/setTitle: skip when second param is explicitly false
    const setLangRegex = /->(?:setLabel|setTitle)\s*\(\s*(['"])([^'"]*)\1\s*(?:,\s*(true|false))?\s*\)/g;
    while ((match = setLangRegex.exec(line)) !== null) {
        if (match[3] === 'false') { continue; }
        checkTransKey(match[2], match.index, line, lineIndex, diagnostics, ctx);
    }
}
