import * as child_process from "child_process";
import * as fs from "fs";
import * as tmp from "tmp";
import {
    window,
    TextDocument,
    languages,
    DiagnosticCollection,
    StatusBarItem,
    StatusBarAlignment,
    Diagnostic,
    Range,
    DiagnosticSeverity
} from "vscode";
import cf from "../cf";
import { waitFor } from "../util";

/** One entry of phpcs' `--report=json` output, under `files[path].messages`. */
interface IPhpcsMessage {
    message: string;
    source: string;
    severity: number;
    fixable: boolean;
    type: "ERROR" | "WARNING";
    line: number;
    column: number;
}

interface IPhpcsReport {
    totals: { errors: number; warnings: number; fixable: number };
    files: {
        [filePath: string]: {
            errors: number;
            warnings: number;
            messages: IPhpcsMessage[];
        };
    };
}

/**
 * Runs `phpcf phpcs` (PHP_CodeSniffer, via `--report=json`) and publishes the
 * result as diagnostics - the built-in equivalent of the `ikappas.phpcs`
 * Marketplace extension, following the same run-as-child-process pattern as
 * `../phpstan/phpstan.ts`.
 */
class Phpcs {
    private _current: { [key: string]: child_process.ChildProcess };
    private _timeouts: { [key: string]: NodeJS.Timer };
    private _diagnostics: { [key: string]: Diagnostic[] };
    private _statusBarItem: StatusBarItem;
    private _diagnosticCollection: DiagnosticCollection;
    private _numActive: number;
    private _numQueued: number;

    constructor() {
        this._current = {};
        this._timeouts = {};
        this._diagnostics = {};

        this._diagnosticCollection = languages.createDiagnosticCollection("phpcs");
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
        this._numActive = 0;
        this._numQueued = 0;
    }

    public async updateDocument(updatedDocument: TextDocument) {
        if (!cf.isPhpcfInstalled() || !cf.isPhpcsEnabled()) {
            // Same reasoning as phpstan.ts: nothing else will run to clear
            // stale diagnostics once this bails out every time, so clear now.
            this._diagnostics = {};
            this._diagnosticCollection.clear();
            this.hideStatusBar();
            return;
        }

        if (updatedDocument.languageId !== "php") {
            this.hideStatusBar();
            return;
        }

        // Diagnostik yang tertinggal dari sebelum berkasnya masuk daftar abaikan
        // akan menetap selamanya kalau hanya di-return.
        if (cf.isPhpcsIgnored(updatedDocument.fileName)) {
            this._diagnosticCollection.delete(updatedDocument.uri);
            delete this._diagnostics[updatedDocument.fileName];
            this.hideStatusBar();
            return;
        }

        if (this._current[updatedDocument.fileName] !== undefined) {
            this._current[updatedDocument.fileName].kill();
            delete this._current[updatedDocument.fileName];
        }

        if (this._timeouts[updatedDocument.fileName] !== undefined) {
            clearTimeout(this._timeouts[updatedDocument.fileName]);
        }

        this._timeouts[updatedDocument.fileName] = setTimeout(async () => {
            delete this._timeouts[updatedDocument.fileName];

            let result: tmp.SynchrounousResult = null;
            let filePath: string = updatedDocument.fileName;

            if (updatedDocument.isDirty) {
                result = tmp.fileSync({ postfix: ".php" });
                fs.writeSync(result.fd, updatedDocument.getText());

                filePath = result.name;
            }

            this._numQueued++;

            // phpcs can run several at once fine, but keep one-in-flight-per-file
            // like phpstan.ts so a fast typist doesn't pile up processes for the
            // same document.
            await waitFor(() => {
                if (this._numActive !== 0) {
                    return false;
                }

                this._numActive++;
                return true;
            });

            this._numQueued--;

            const args = ["phpcs", filePath, "--format=json", "--no-progress"];

            // Dokumen aslinya yang menentukan ruleset, bukan salinan sementara
            // yang dibuat untuk berkas belum tersimpan - salinan itu ada di
            // direktori sementara, di luar aplikasi mana pun.
            const standard = cf.getPhpcsConfigPath(updatedDocument);
            if (standard) {
                args.push("--standard=" + standard);
            }
            if (cf.isPhpcsShowSources()) {
                args.push("--show-sources");
            }

            this._current[updatedDocument.fileName] = child_process.spawn(
                cf.getPhpcfPath(),
                args,
                {}
            );

            let results = "";
            this._current[updatedDocument.fileName].stdout.on("data", (data) => {
                if (data instanceof Buffer) {
                    data = data.toString("utf8");
                }

                results += data;
            });

            this._current[updatedDocument.fileName].on("error", (err) => {
                if (err.message.indexOf("ENOENT") !== -1) {
                    window.showErrorMessage(
                        "[phpcs] Failed to find phpcf, the given path doesn't exist." + err.message
                    );
                }
            });

            this._statusBarItem.text = "[PHPCS] processing...";
            this._statusBarItem.show();

            this._current[updatedDocument.fileName].on("exit", () => {
                this._numActive--;

                if (result !== null) {
                    result.removeCallback();
                }

                delete this._current[updatedDocument.fileName];

                const jsonStart = results.indexOf("{");
                if (jsonStart === -1) {
                    // Nothing that looks like the JSON report - most likely phpcs
                    // itself failed to run (missing standard, syntax error in the
                    // ruleset, etc). Surface it instead of silently clearing.
                    if (results.trim().length > 0) {
                        window.showErrorMessage(`[phpcs] ${results.trim()}`);
                    }
                    this.hideStatusBar();
                    return;
                }

                let report: IPhpcsReport;
                try {
                    report = JSON.parse(results.slice(jsonStart));
                } catch (e) {
                    window.showErrorMessage(`[phpcs] Failed to parse phpcs output: ${e.message}`);
                    this.hideStatusBar();
                    return;
                }

                const fileReport = report.files[filePath];
                const messages = fileReport ? fileReport.messages : [];

                this._diagnostics[updatedDocument.fileName] = messages.map((message) =>
                    this.toDiagnostic(updatedDocument, message)
                );

                this._diagnosticCollection.set(updatedDocument.uri, this._diagnostics[updatedDocument.fileName]);
                this.hideStatusBar();
            });
        }, 300);
    }

    private toDiagnostic(document: TextDocument, message: IPhpcsMessage): Diagnostic {
        const line = Math.max(0, message.line - 1);
        const lineText = line < document.lineCount ? document.lineAt(line).text : "";
        const startColumn = Math.max(0, message.column - 1);
        const endColumn = Math.max(startColumn + 1, lineText.length);

        const severity =
            message.type === "ERROR" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning;

        const diagnostic = new Diagnostic(
            new Range(line, startColumn, line, endColumn),
            `${message.message} (${message.source})`,
            severity
        );
        diagnostic.source = "phpcf.phpcs";
        diagnostic.code = message.source;

        return diagnostic;
    }

    /**
     * Hides the statusbar if there are no active items
     */
    private hideStatusBar() {
        if (this._numActive === 0 && this._numQueued === 0) {
            this._statusBarItem.hide();
        }
    }

    get diagnosticCollection() {
        return this._diagnosticCollection;
    }

    dispose() {
        for (let key in this._current) {
            if (this._current[key].killed) {
                continue;
            }

            this._current[key].kill();
        }

        this._diagnosticCollection.dispose();
    }
}

const phpcs = new Phpcs();

export default phpcs;
