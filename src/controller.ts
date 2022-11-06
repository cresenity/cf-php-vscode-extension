import {
    Disposable,
    workspace,
    window,
    TextDocument,
    TextEditor,
    TextDocumentChangeEvent,
} from "vscode";
import phpstan from "./phpstan/phpstan";
import onDocumentSaved from './event/onDocumentSaved';
import onDocumentOpen from './event/onDocumentOpen';
import onChangeActiveTextEditor from './event/onChangeActiveTextEditor';

export class CFController {
    private disposable: Disposable;
    private _item;

    constructor() {
        let subscriptions: Disposable[] = [];
        workspace.onDidSaveTextDocument(
            onDocumentSaved,
            this,
            subscriptions
        );
        workspace.onDidOpenTextDocument(
            onDocumentOpen,
            this,
            subscriptions
        );
        window.onDidChangeActiveTextEditor(
            onChangeActiveTextEditor,
            this,
            subscriptions
        );

        // Get the current text editor
        let editor = window.activeTextEditor;
        if (editor && editor.document) {
            phpstan.updateDocument(editor.document);
        }

        this.disposable = Disposable.from(...subscriptions);
    }


    dispose() {
        this.disposable.dispose();
    }
}
