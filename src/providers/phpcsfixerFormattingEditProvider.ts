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
        // Formatter hanya didaftarkan bila diminta - sekali terdaftar, ia ikut
        // dalam pilihan "Format Document" dan tidak bisa dicabut lagi.
        if (cf.isPhpcsfixerDocumentFormattingProvider()) {
            context.subscriptions.push(
                vscode.languages.registerDocumentFormattingEditProvider('php', new PhpcsfixerFormattingEditProvider())
            );
        }
        // Dibaca lewat cf, bukan getConfiguration().get('phpcf.phpcsfixer.runOnSave'):
        // setelannya berupa objek `phpcf.phpcsfixer`, dan jalur bertitik ke
        // dalamnya tidak mengambil nilai bawaan yang dideklarasikan package.json -
        // jadi bawaannya selalu terbaca sebagai argumen kedua, bukan `true`.
        PhpcsfixerFormattingEditProvider.runOnSave = cf.isPhpcsfixerRunOnSave();
        // Listener untuk menyimpan dokumen
        vscode.workspace.onDidSaveTextDocument(document => {
            if (PhpcsfixerFormattingEditProvider.runOnSave
                && document.languageId === 'php'
                && !cf.isPhpcsfixerExcluded(document.uri.fsPath)
            ) {
                phpcsfixer(document.uri);
            }
        });
        // Listener untuk perubahan pengaturan
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('phpcf.phpcsfixer')) {
                PhpcsfixerFormattingEditProvider.runOnSave = cf.isPhpcsfixerRunOnSave();
            }
        });

    }
    public async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        if (!cf.isPhpCsFixerInstalled()) {
            vscode.window.showErrorMessage('php-cs-fixer is not installed, please install with "phpcf php-cs-fixer:install" command!');
            return [];
        }
        if (cf.isPhpcsfixerExcluded(document.uri.fsPath)) {
            return [];
        }
        let originalText = document.getText();
        const tmpPath = this.getTmpPath();
        if (!tmpPath) {
            return [];
        }
        // Jalankan php-cs-fixer
        const fsPath = document.uri.fsPath;
        fs.writeFileSync(tmpPath, originalText);
        // Config ditentukan dari dokumen aslinya - berkas sementara ini berada
        // di direktori sementara, di luar aplikasi mana pun, sehingga phpcf
        // sendiri tidak dapat menyimpulkan config aplikasi darinya.
        const configPath = cf.getPhpcsfixerConfigPath(document);
        const configArg = configPath ? ' --config=' + configPath : '';
        const formattedText = await PHPCF.run('php-cs-fixer:format ' + tmpPath + configArg);
        if(formattedText) {
            // Replace entire document with formatted text
            const firstLine = document.lineAt(0);
            const lastLine = document.lineAt(document.lineCount - 1);
            const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
            return [vscode.TextEdit.replace(fullRange, formattedText)];

        }
        return [];
    }
    public getTmpPath() {
        let filePath = path.join(this.getTmpDir(), 'phpcf.php-cs-fixer', 'phpcf.php-cs-fixer-tmp' + Math.random());
        try {
          fs.mkdirSync(path.dirname(filePath), { recursive: true })
        } catch (err) {
          console.error(err)
          return null;
        }
        return filePath;
    }
    public getTmpDir() {
        return os.tmpdir();
    }
}
