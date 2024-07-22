import * as vscode from "vscode";
import { getViews } from "./../php/view";
import cf from "../cf";

class ViewRepository {
    private views: Array<any> = [];

    constructor() {
        const appCode = cf.getAppCode();
        if(appCode) {
            this.syncViews(appCode);
        }

    }

    async get(document:vscode.TextDocument = null) {
        const appCode = cf.getAppCode(document);
        if(appCode) {
            if (!this.views[appCode]) {
                await this.syncViews(appCode);
            }
            if(this.views[appCode]) {
                return this.views[appCode];

            }
        }

        return [];
    }

    async syncViews(appCode) {
        await getViews().then((views) => {
            if (!views) {
                return;
            }

            this.views[appCode] = JSON.parse(views);
        });
    }
}
const viewRepository = new ViewRepository();
export default viewRepository;
