import * as child_process from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as tmp from "tmp";
import {
    workspace,
    window,
    TextDocument,
    languages,
    DiagnosticCollection,
    StatusBarItem,
    StatusBarAlignment,
    Uri,
    Diagnostic,
    Range,
    commands,
    Disposable,
    DiagnosticSeverity
} from "vscode";
import cf from "../cf";
import { waitFor } from "../util";

interface ICheckResult {
    file: string;
    line: number;
    msg: string;
    type?: DiagnosticSeverity;
}
class Phpstan {
    private _current: { [key: string]: child_process.ChildProcess };
    private _timeouts: { [key: string]: NodeJS.Timer };
    private _errors: { [key: string]: any };
    private _documents: { [key: string]: TextDocument };
    private _statusBarItem: StatusBarItem;
    private _diagnosticCollection: DiagnosticCollection;
    private _numActive: number;
    private _numQueued: number;

    constructor() {
        this._current = {};
        this._timeouts = {};
        this._errors = {};
        this._documents = {};

        this._diagnosticCollection =
            languages.createDiagnosticCollection("error");
        this._statusBarItem = window.createStatusBarItem(
            StatusBarAlignment.Left
        );
        this._numActive = 0;
        this._numQueued = 0;
    }
    /**
     * This is where the magic happens. This method calls the PHPStan executable,
     * parses the errors and outputs them to VSCode.
     *
     * @param updatedDocument The document to re-scan
     */
    public async updateDocument(updatedDocument: TextDocument) {
        if (!cf.isPhpstanEnabled()) {
            this.hideStatusBar();
            return;
        }

        if (updatedDocument.languageId !== "php") {
            this.hideStatusBar();
            return;
        }

        const appRoot = this.appRoot(updatedDocument);


        if (appRoot == null) {
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
                result = tmp.fileSync();
                fs.writeSync(result.fd, updatedDocument.getText());

                filePath = result.name;
            }

            if (this._errors[updatedDocument.fileName] === undefined) {
                this._errors[updatedDocument.fileName] = [
                    {
                        file: updatedDocument.fileName,
                        line: 1,
                        msg: `[phpstan] queued for scanning`,
                        type: DiagnosticSeverity.Information,
                    },
                ];
                this._documents[updatedDocument.fileName] = updatedDocument;
            }

            this._numQueued++;

            // PHPStan doesn't like running parallel so just lock it to 1 instance now:
            // https://github.com/phpstan/phpstan/issues/934
            await waitFor(() => {
                if (this._numActive !== 0) {
                    return false;
                }

                this._numActive++;
                return true;
            });

            let options = {};

            options["cwd"] = appRoot;

            this._numQueued--;
            this._current[updatedDocument.fileName] = child_process.spawn(
                cf.getPhpcfPath(),
                ["phpstan", filePath, "--format=raw","--no-progress"],
                options
            );

            let results: string = "";
            this._current[updatedDocument.fileName].stdout.on(
                "data",
                (data) => {
                    if (data instanceof Buffer) {
                        data = data.toString("utf8");
                    }

                    results += data;
                }
            );

            this._current[updatedDocument.fileName].on("error", (err) => {
                if (err.message.indexOf("ENOENT") !== -1) {
                    window.showErrorMessage(
                        "[phpstan] Failed to find phpcf, the given path doesn't exist." + err.message
                    );
                }
            });

            this._statusBarItem.text = "[PHPStan] processing...";
            this._statusBarItem.show();

            this._current[updatedDocument.fileName].on("exit", (code) => {
                this._numActive--;

                if (result !== null) {
                    result.removeCallback();
                }

                if (code !== 1) {
                    const data: any[] = results
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(
                            (x) => !x.startsWith("!") && x.trim().length !== 0
                        )
                        // .filter(x => x.startsWith("Warning:") || x.startsWith("Fatal error:"))
                        .map((x) => {
                            if (x.startsWith("Warning:")) {
                                const message = x
                                    .substr("Warning:".length)
                                    .trim();

                                return {
                                    message,
                                    type: "warning",
                                };
                            }

                            if (x.startsWith("Fatal error:")) {
                                const message = x
                                    .substr("Fatal error:".length)
                                    .trim();

                                return {
                                    message,
                                    type: "error",
                                };
                            }

                            const message = x.trim();

                            return {
                                message,
                                type: "info",
                            };
                        });

                    for (const error of data) {
                        switch (error.type) {
                            case "warning":
                                window.showWarningMessage(
                                    `[phpstan] ${error.message}`
                                );
                                break;

                            case "error":
                                window.showErrorMessage(
                                    `[phpstan-error] ${error.message}`
                                );
                                break;

                            case "info":
                                window.showInformationMessage(
                                    `[phpstan-info] ${error.message}`
                                );
                                break;
                        }
                    }

                    delete this._current[updatedDocument.fileName];
                    this.hideStatusBar();


                }

                //console.log(results);
                let autoloadError = false;
                const data: ICheckResult[] = results
                    .split("\n")
                    .map((x) => x.substr(filePath.length + 1).trim())
                    .filter((x) => x.length > 0)
                    .map((x) => x.split(":"))
                    .map((x) => {
                        let line = Number(x[0]);
                        x.shift();

                        // line 0 is not allowed so we need to start at 1
                        if (line === 0) {
                            line++;
                        }

                        let error = x.join(":");

                        // Only show this error once
                        if (
                            error.indexOf(
                                "not found while trying to analyse it"
                            ) !== -1
                        ) {
                            if (autoloadError) {
                                return null;
                            }

                            error =
                                "File probably not autoloaded correctly, some analysis is unavailable.";
                            line = 1;

                            autoloadError = true;
                        }

                        return {
                            file: updatedDocument.fileName,
                            line: line,
                            msg: `${error}`,
                        };
                    })
                    .filter((x) => x !== null && !isNaN(x.line));

                this._errors[updatedDocument.fileName] = data;
                this._documents[updatedDocument.fileName] = updatedDocument;

                let documents = Object.values(this._documents);
                let errors = [].concat.apply([], Object.values(this._errors));


                this.diagnosticCollection.clear();
                this.handleDiagnosticErrors(
                    documents,
                    errors,
                    this._diagnosticCollection
                );
                this.hideStatusBar();
            });
        }, 300);
    }

    public appRoot(document: TextDocument) {
        let workspaceFolder = workspace.getWorkspaceFolder(document.uri).uri
            .fsPath;

        let relativePath = path.relative(workspaceFolder, document.uri.fsPath);
        let relativePathExploded = relativePath.split(path.sep);
        let appCode = null;
        if (relativePathExploded.length > 2) {
            if (relativePathExploded[0] == "application") {
                appCode = relativePathExploded[1];
                return (
                    cf.getDocRoot() +
                    path.sep +
                    "application" +
                    path.sep +
                    appCode
                );
            }
        }
        return null;
    }
    /**
     * Hides the statusbar if there are no active items
     */
    private hideStatusBar() {
        if (this._numActive === 0 && this._numQueued === 0) {
            this._statusBarItem.hide();
        }
    }

    private handleDiagnosticErrors(
        document: TextDocument[],
        errors: ICheckResult[],
        diagnosticCollection: DiagnosticCollection
    ) {
        diagnosticCollection.clear();

        let diagnosticMap: Map<string, Diagnostic[]> = new Map();
        errors.forEach((error) => {
            const canonicalFile = Uri.file(error.file).toString();
            const doc = document.find(
                (item) => item.uri.toString() === canonicalFile
            );
            let startColumn = 0;
            let endColumn = 1;

            if (doc !== undefined) {
                let range = new Range(
                    error.line - 1,
                    0,
                    error.line - 1,
                    doc.lineAt(error.line - 1).range.end.character + 1
                );
                let text = doc.getText(range);
                let [_, leading, trailing] = /^(\s*).*(\s*)$/.exec(text);
                startColumn = leading.length;
                endColumn = text.length - trailing.length;
            }

            let severity =
                error.type === undefined
                    ? DiagnosticSeverity.Error
                    : error.type;
            let range = new Range(
                error.line - 1,
                startColumn,
                error.line - 1,
                endColumn
            );
            let diagnostic = new Diagnostic(range, error.msg, severity);
            diagnostic.source = 'phpcf.phpstan';
            let diagnostics = diagnosticMap.get(canonicalFile);
            if (!diagnostics) {
                diagnostics = [];
            }
            diagnostics.push(diagnostic);
            diagnosticMap.set(canonicalFile, diagnostics);
        });

        diagnosticMap.forEach((diagMap, file) => {
            const fileUri = Uri.parse(file);
            const newErrors = diagMap;
            diagnosticCollection.set(fileUri, newErrors);
        });
    }

    get diagnosticCollection() {
        return this._diagnosticCollection;
    }
    /**
     * Cleans up everything this extension created
     */
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

const phpstan = new Phpstan();

export default phpstan;
