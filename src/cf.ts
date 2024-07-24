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
    public getTriggerCharacters() {
        return ['"', "'", ">"];
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

    public getAppRoot(document : vscode.TextDocument = null) {
        const appCode = this.getAppCode(document);
        if(appCode) {
            return this.docRoot + path.sep + 'application' + path.sep + appCode;
        }
        return null;
    }
    public getAppCode(document : vscode.TextDocument = null) {
        if(document==null) {
            document = vscode.window.activeTextEditor?.document ?? null;
        }
        if(document) {
            return this.getAppCodeFromDocument(document);
        }
        return null;
    }
    public isOnAppDirectory(document : vscode.TextDocument = null) {
        return this.getAppCode(document) != null;
    }

    public getAppCodeFromDocument(document : vscode.TextDocument) {
        let relativePath = path.relative(this.docRoot, document.uri.fsPath);

        return this.appCode(relativePath);
    }
    public appCode(relativePath: string): string|null {
        let relativePathExploded = relativePath.split(path.sep);
        let appCode = null;
        if (relativePathExploded.length > 2) {
            if (relativePathExploded[0] == "application") {
                appCode = relativePathExploded[1];
            }
        }
        return appCode;
    }
    public hasAutoload(): boolean {
        return fs.existsSync(this.docRoot + path.sep + "vendor/autoload.php");
    }
    public hasBootstrapApp(): boolean {
        return fs.existsSync(this.docRoot + path.sep + "bootstrap/app.php");
    }
    public isPhpcfInstalled(): boolean {

        return this.phpcfPath != null;
    }
    public isPhpstanEnabled() : boolean {
        const config = vscode.workspace.getConfiguration('phpcf');
        return this.isPhpStanInstalled() && config.phpstan.enabled;
    }
    public isPhpStanInstalledOnAppCode(appCode:string): boolean {
        const phpstanDir = this.docRoot + path.sep + 'application' + path.sep + appCode + path.sep;
        const phpstanConfig = "phpstan.neon";
        const phpstanConfigPath = phpstanDir + phpstanConfig;
        if (fs.existsSync(phpstanConfigPath)) {
            return true;

        }
        return false;
    }
    public getPhpStanPath() {
        const phpstanDir = this.docRoot + path.sep + '.bin' + path.sep + 'phpstan' + path.sep;
        const phpstanBinary = "phpstan" + (process.platform === "win32" ? ".bat" : "");
        const phpstanPath = phpstanDir + phpstanBinary;
        return phpstanPath;
    }
    public isPhpStanInstalled(): boolean {
        const phpstanPath = this.getPhpStanPath();
        if (fs.existsSync(phpstanPath)) {
            return true;
        }
        return false;
    }
    public getPhpCsFixerPath() {
        const phpCsFixerDir = this.docRoot + path.sep + '.bin' + path.sep + 'php-cs-fixer' + path.sep;
        const phpCsFixerPhar = "php-cs-fixer.phar";
        const phpCsFixerPath = phpCsFixerDir + phpCsFixerPhar;
        return phpCsFixerPath;
    }
    public isPhpCsFixerInstalled() {
        const phpCsFixerPath = this.getPhpCsFixerPath();
        if (fs.existsSync(phpCsFixerPath)) {
            return true;
        }
        return false;
    }

    public getPhpCsPath() {
        const phpCsDir = this.docRoot + path.sep + '.bin' + path.sep + 'phpcs' + path.sep;
        const phpCsPhar = "phpcs.phar";
        const phpCsPath = phpCsDir + phpCsPhar;
        return phpCsPath;
    }
    public isPhpCsInstalled() {
        const phpCsPath = this.getPhpCsPath();

        if (fs.existsSync(phpCsPath)) {
            return true;
        }
        return false;
    }
    public getPhpCbfPath() {
        const phpCbfDir = this.docRoot + path.sep + '.bin' + path.sep + 'phpcs' + path.sep;
        const phpCbfPhar = "phpcbf.phar";
        const phpCbfPath = phpCbfDir + phpCbfPhar;
        return phpCbfPath;
    }
    public isPhpCbfInstalled() {
        const phpCbfPath = this.getPhpCbfPath();
        if (fs.existsSync(phpCbfPath)) {
            return true;
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
        console.log(paths)
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
