import {
    TextDocument,
    CompletionItemProvider,
    Position,
    CompletionItem,
    CompletionItemKind,
    RelativePattern,
    workspace,
} from "vscode";
import { getActiveWorkspace } from "./../util";
import { getViews } from "./../php/view";
import Parser from "./../parser/index";
import { isNull } from "util";
import cf from "../cf";

export default class ViewItemProvider implements CompletionItemProvider {
    private views: Array<any> = [];

    private watcher: any = null;

    constructor() {
        const appCode = cf.getAppCode();
        if(appCode) {
            this.syncViews(appCode);
        }
        this.watchViews();


    }

    async provideCompletionItems(
        document: TextDocument,
        position: Position
    ): Promise<Array<CompletionItem>> {
        let items: Array<CompletionItem> = [];

        let hasView = new Parser(document, position).hasView();

        if (!hasView) {
            return items;
        }

        const appCode = cf.getAppCode(document);
        if(appCode) {
            if (!this.views[appCode]) {
                await this.syncViews(appCode);
            }
            if(this.views[appCode]) {
                for (let view of this.views[appCode]) {
                    const item = new CompletionItem(view, CompletionItemKind.Constant);

                    item.range = document.getWordRangeAtPosition(
                        position,
                        /[\w\d\-_\.\:\\\/]+/g
                    );

                    items.push(item);
                }
            }


            return items;
        }
    }

    async syncViews(appCode) {
        const views = await getViews();
        if (!views) {
            return;
        }
        this.views[appCode] = JSON.parse(views);

    }

    watchViews() {
        this.watcher = workspace.createFileSystemWatcher(
            new RelativePattern(
                getActiveWorkspace(),
                "{,**/}{view,views}/{*,**/*}"
            )
        );

        this.watcher.onDidCreate(() => this.onChange());
        this.watcher.onDidDelete(() => this.onChange());
        this.watcher.onDidChange(() => this.onChange());
    }

    onChange() {
        const appCode = cf.getAppCode();
        if(appCode) {
            setInterval(() => {
                this.syncViews(appCode);
            }, 5000);
        }
    }
}
