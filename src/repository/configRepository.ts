import * as vscode from "vscode";
import { getConfigElements } from "./../php/config";
import cf from "../cf";

class ConfigRepository {
    private elements: Array<any> = [];

    constructor() {
        const appCode = cf.getAppCode();
        if(appCode) {
            this.syncConfig(appCode);
        }

    }

    async get(document:vscode.TextDocument = null) {
        const appCode = cf.getAppCode(document);
        if(appCode) {
            if (!this.elements[appCode]) {
                await this.syncConfig(appCode);
            }
            if(this.elements[appCode]) {
                return this.elements[appCode];

            }
        }

        return [];
    }

    async syncConfig(appCode) {
        await getConfigElements().then((elements) => {
            if (!elements) {
                return;
            }

            this.elements[appCode] = Object.values(JSON.parse(elements));
        });
    }
}
const configRepository = new ConfigRepository();
export default configRepository;
