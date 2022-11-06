import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
class CF {
    private phpcfPath: string | null = null;
    private docRoot:string|null = null;
    constructor() {
        this.detectCF();
        this.findPhpcf();
    }

    public getDocRoot() {
        return this.docRoot;
    }

    public isCF() {
        return this.docRoot!=null;
    }
    public detectCF() {
        if (vscode.workspace.workspaceFolders.length > 0) {
            vscode.workspace.workspaceFolders.forEach((element) => {
                let root = element.uri.fsPath;
                let cfFile = root + path.sep + "cf";
                if (fs.existsSync(cfFile)) {
                    this.docRoot = root;
                }
            });
        }
    }


    public appCode(relativePath: string): string {
        let relativePathExploded = relativePath.split(path.sep);
        let appCode = null;
        if (relativePathExploded.length > 2) {
            if (relativePathExploded[0] == "application") {
                appCode = relativePathExploded[1];
            }
        }
        return appCode;
    }

    public isPhpcfInstalled(): boolean {

        return this.phpcfPath != null;
    }
    public isPhpstanEnabled() : boolean {
        const config = vscode.workspace.getConfiguration('phpcf');
        return this.isPhpstanInstalled() && config.phpstan.enabled;
    }
    public isPhpstanInstalled(): boolean {
        const phpstanDir = this.docRoot + path.sep + '.bin' + path.sep + 'phpstan' + path.sep;
        const phpstanBinary = "phpstan" + (process.platform === "win32" ? ".bat" : "");
        const phpstanPath = phpstanDir + phpstanBinary;
        if (fs.existsSync(phpstanPath)) {
            // Check if we have permission to execute this file
            try {

                fs.accessSync(phpstanPath, fs.constants.X_OK);
                return true;
            } catch (exception) {
            }
        }
        return false;
    }

    public getPhpcfPath() {
        return this.phpcfPath;
    }
    /**
     * Filesystem method to find phpcf
     */
    private findPhpcf() {
        const executableName =
            "phpcf" + (process.platform === "win32" ? ".bat" : "");
        const vendor = "vendor/bin/" + executableName;
        const paths = [];
        const { workspace } = vscode;

        for (const folder of workspace.workspaceFolders) {
            paths.push(path.join(folder.uri.fsPath, vendor));
        }

        if (process.env.COMPOSER_HOME !== undefined) {
            paths.push(path.join(process.env.COMPOSER_HOME, vendor));
        } else {
            if (process.platform === "win32") {
                paths.push(
                    path.join(
                        process.env.USERPROFILE,
                        "AppData/Roaming/composer",
                        vendor
                    )
                );
            } else {
                paths.push(path.join(process.env.HOME, ".composer", vendor));
            }
        }

        const globalPaths = process.env.PATH.split(path.delimiter);
        for (const globalPath of globalPaths) {
            paths.push(globalPath + path.sep + executableName);
        }
        for (const path of paths) {
            if (fs.existsSync(path)) {
                // Check if we have permission to execute this file
                try {

                    fs.accessSync(path, fs.constants.X_OK);
                    this.phpcfPath = path;
                    break;
                } catch (exception) {
                    continue;
                }
            }
        }
    }
}

const cf = new CF();

export default cf;