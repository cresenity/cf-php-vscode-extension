import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os'
import PHPCF from '../phpcf';
import cf from '../cf';
import phpcsfixer from '../commands/phpcf/phpcsfixer';

const execAsync = promisify(exec);
export class PhpcsfixerFormattingEditProvider implements vscode.DocumentFormattingEditProvider {
    static runOnSave = false;
    public static async activate(context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.languages.registerDocumentFormattingEditProvider('php', new PhpcsfixerFormattingEditProvider())
        );
        PhpcsfixerFormattingEditProvider.runOnSave = vscode.workspace.getConfiguration().get('phpcf.phpcsfixer.runOnSave');
         // Listener untuk menyimpan dokumen
        vscode.workspace.onDidSaveTextDocument(document => {
            if (PhpcsfixerFormattingEditProvider.runOnSave && document.languageId === 'php') {
                phpcsfixer(document.uri);
            }
        });
        // Listener untuk perubahan pengaturan
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('phpcf.phpcsfixer.runOnSave')) {
                PhpcsfixerFormattingEditProvider.runOnSave = vscode.workspace.getConfiguration().get('phpcf.phpcsfixer.runOnSave');
            }
        });

    }
    public async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        if (!cf.isPhpCsFixerInstalled()) {
            vscode.window.showErrorMessage('php-cs-fixer is not installed, please install with "phpcf phpcs:install" command!');
            return [];
        }
        let originalText = document.getText();
        const tmpPath = this.getTmpPath();
        // Jalankan php-cs-fixer
        const fsPath = document.uri.fsPath;
        fs.writeFileSync(tmpPath, originalText);
        const formattedText = await PHPCF.run('php-cs-fixer:format ' + tmpPath);
        console.log('aaaa',fsPath, formattedText);
        if(formattedText) {
            // Replace entire document with formatted text
            const firstLine = document.lineAt(0);
            const lastLine = document.lineAt(document.lineCount - 1);
            const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
            return [vscode.TextEdit.replace(fullRange, formattedText)];

        }
    }
    public getTmpPath() {
        let filePath = path.join(this.getTmpDir(), 'phpcf.php-cs-fixer', 'phpcf.php-cs-fixer-tmp' + Math.random());
        try {
          fs.mkdirSync(path.dirname(filePath), { recursive: true })
        } catch (err) {
          console.error(err)
          filePath = null;
        }
        return filePath;
    }
    public getTmpDir() {
        return os.tmpdir();
    }
}
