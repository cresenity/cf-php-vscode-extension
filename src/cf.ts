import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import CFApp from "./cfapp";
class CF {
    private phpcfPath: string | null = null;
    private docRoot:string|null = null;
    private apps : Map<string, CFApp>;


    constructor() {
        this.apps = new Map();
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

    /**
     * A workspace folder is the CF framework root when its composer.json
     * declares "name": "cresenity/cf".
     */
    private detectCF() {
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const composerJsonPath = path.join(folder.uri.fsPath, "composer.json");
            if (!fs.existsSync(composerJsonPath)) {
                continue;
            }
            try {
                const composerJson = JSON.parse(fs.readFileSync(composerJsonPath, "utf-8"));
                if (composerJson.name === "cresenity/cf") {
                    this.docRoot = folder.uri.fsPath;
                    return;
                }
            } catch (exception) {
                continue;
            }
        }
    }


    public getCFApp(appCode: string) : CFApp|null {
        const appRoot = this.docRoot + path.sep + 'application' + path.sep + appCode;;
        if(!fs.existsSync(appRoot)) {
            return null;
        }
        if(!this.apps.has(appCode)) {
            this.apps.set(appCode, new CFApp(appCode));
        }
        return this.apps.get(appCode) ?? null;

    }
    public getCFAppFromDocument(document?: vscode.TextDocument)  : CFApp|null {
        const appCode = this.getAppCode(document);
        if(appCode) {
            return this.getCFApp(appCode);
        }
        return null;
    }

    public getAppRoot(document?: vscode.TextDocument) {
        const appCode = this.getAppCode(document);
        if(appCode) {
            return this.docRoot + path.sep + 'application' + path.sep + appCode;
        }
        return null;
    }
    public getAppCode(document?: vscode.TextDocument) {
        if(!document) {
            document = vscode.window.activeTextEditor?.document;
        }
        if(document) {
            return this.getAppCodeFromDocument(document);
        }
        return null;
    }
    public isOnAppDirectory(document?: vscode.TextDocument) {
        return this.getAppCode(document) != null;
    }

    public getAppCodeFromDocument(document : vscode.TextDocument) {
        if(!this.docRoot) {
            return null;
        }
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
     * Check if a candidate path is an executable phpcf binary, and if so remember it.
     */
    private tryUsePhpcf(candidatePath: string): boolean {
        if (!fs.existsSync(candidatePath)) {
            return false;
        }
        try {
            fs.accessSync(candidatePath, fs.constants.X_OK);
            this.phpcfPath = candidatePath;
            return true;
        } catch (exception) {
            return false;
        }
    }

    /**
     * Filesystem method to find phpcf. Looks for a project-local vendor/bin/phpcf
     * first (in each workspace folder), then falls back to a globally installed phpcf.
     */
    private findPhpcf() {
        const executableName =
            "phpcf" + (process.platform === "win32" ? ".bat" : "");
        const vendor = "vendor/bin/" + executableName;
        const { workspace } = vscode;

        for (const folder of workspace.workspaceFolders ?? []) {
            const vendorPath = path.join(folder.uri.fsPath, vendor);
            if (this.tryUsePhpcf(vendorPath)) {
                return;
            }
        }

        const paths = [];

        if (process.env.COMPOSER_HOME !== undefined) {
            paths.push(path.join(process.env.COMPOSER_HOME, vendor));
        } else {
            if (process.platform === "win32") {
                if (process.env.USERPROFILE) {
                    paths.push(
                        path.join(
                            process.env.USERPROFILE,
                            "AppData/Roaming/composer",
                            vendor
                        )
                    );
                }
            } else {
                if (process.env.HOME) {
                    paths.push(path.join(process.env.HOME, ".composer", vendor));
                }
            }
        }

        const globalPaths = (process.env.PATH ?? '').split(path.delimiter);
        for (const globalPath of globalPaths) {
            paths.push(globalPath + path.sep + executableName);
        }

        for (const candidatePath of paths) {
            if (this.tryUsePhpcf(candidatePath)) {
                return;
            }
        }
    }
}

const cf = new CF();

export default cf;
