import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import cf from "./cf";
export default class CFApp {
    private appCode:string|null = null;
    constructor(appCode:string) {
        this.appCode = appCode;
    }

    getPhpCsConfigurationPath() {
        const cfConfigurationPath = cf.getDocRoot() + path.sep + 'phpcs.xml';
        const appConfigurationPath = this.getAppRoot() + path.sep + 'phpcs.xml';
        return fs.existsSync(appConfigurationPath) ? appConfigurationPath : cfConfigurationPath;
    }
    getAppRoot() {
        if(this.appCode) {
            return cf.getDocRoot() + path.sep + 'application' + path.sep + this.appCode;
        }
        return null;
    }
}
