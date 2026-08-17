import * as vscode from "vscode";
import cf from "../cf";

/**
 * Formatter berkas Blade, memakai pustaka blade-formatter langsung.
 *
 * Mesinnya sama dengan yang dipakai shufo.vscode-blade-formatter, tetapi
 * berjalan di dalam proses ini - tidak ada phar atau biner yang perlu dipasang,
 * dan tidak ada ekstensi kedua yang ikut mendaftar sebagai formatter Blade.
 */
export class BladeFormattingEditProvider implements vscode.DocumentFormattingEditProvider {
    static runOnSave = false;

    public static async activate(context: vscode.ExtensionContext) {
        if (!cf.isBladeFormatterEnabled()) {
            return;
        }

        context.subscriptions.push(
            vscode.languages.registerDocumentFormattingEditProvider(
                "blade",
                new BladeFormattingEditProvider()
            )
        );

        BladeFormattingEditProvider.runOnSave = cf.isBladeFormatterRunOnSave();

        // Menyimpan tidak dapat ditunda, jadi berkasnya ditulis ulang sesudah
        // tersimpan - bukan lewat willSaveTextDocument, yang membatasi waktu
        // penyunting dan akan terlewat pada berkas besar.
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(async (document) => {
                if (!BladeFormattingEditProvider.runOnSave || document.languageId !== "blade") {
                    return;
                }
                if (cf.isBladeFormatterExcluded(document.uri.fsPath)) {
                    return;
                }

                const edits = await BladeFormattingEditProvider.buildEdits(document);
                if (edits.length === 0) {
                    return;
                }

                const edit = new vscode.WorkspaceEdit();
                edit.set(document.uri, edits);
                await vscode.workspace.applyEdit(edit);
                await document.save();
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration("phpcf.blade")) {
                    BladeFormattingEditProvider.runOnSave = cf.isBladeFormatterRunOnSave();
                }
            })
        );
    }

    /**
     * Hasil format sebagai satu penggantian utuh, atau kosong bila tidak berubah.
     *
     * Mengembalikan kosong saat hasilnya sama penting untuk jalur simpan:
     * applyEdit yang menulis isi yang identik tetap menandai berkasnya kotor,
     * sehingga menyimpan sekali memicu simpan berikutnya tanpa henti.
     */
    public static async buildEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        const original = document.getText();

        let formatted: string;
        try {
            // Diminta saat dipakai, bukan saat modul dimuat - pustakanya berat
            // dan tidak semua sesi menyentuh berkas Blade.
            const { Formatter } = require("blade-formatter");
            formatted = await new Formatter(cf.getBladeFormatterOptions()).formatContent(original);
        } catch (e) {
            vscode.window.showErrorMessage("[blade] " + (e instanceof Error ? e.message : String(e)));

            return [];
        }

        if (formatted === original) {
            return [];
        }

        const fullRange = new vscode.Range(
            document.lineAt(0).range.start,
            document.lineAt(document.lineCount - 1).range.end
        );

        return [vscode.TextEdit.replace(fullRange, formatted)];
    }

    public async provideDocumentFormattingEdits(
        document: vscode.TextDocument
    ): Promise<vscode.TextEdit[]> {
        if (cf.isBladeFormatterExcluded(document.uri.fsPath)) {
            return [];
        }

        return BladeFormattingEditProvider.buildEdits(document);
    }
}
