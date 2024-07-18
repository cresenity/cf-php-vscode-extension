import { getPath } from "./../util";
import * as cp from "child_process";
import * as os from "os";
import cf from "./../cf";
import { workspace, window, TextDocument } from "vscode";

export default class PHP {
    static phpParser: any = null;

    static running: boolean = false;

    static async run(code: string, document:TextDocument = null): Promise<string> {
        //if (cf.hasAutoload() && cf.hasBootstrapApp()) {

        var script = this.getScript(code);
        const cwd = cf.getAppRoot();
        console.log('cwd:' + cwd);
        if(cwd!=null) {
            var out: string | null | RegExpExecArray = await this.execute(
                script, cwd
            );
            console.log('out:' + out);
            return out;
        }
        return "";
            // out = /___OUTPUT___(.*)___END_OUTPUT___/g.exec(out);

            // if (out) {
            //     return out[1];
            // }
        //}

        //return "";
    }

    static async execute(code: string, cwd: string): Promise<string> {
        if (this.running) {
            return "";
        }

        this.running = true;

        code = code.replace(/\"/g, '\\"');

        if (
            ["linux", "openbsd", "sunos", "darwin"].some((unixPlatforms) =>
                os.platform().includes(unixPlatforms)
            )
        ) {
            code = code.replace(/\$/g, "\\$");
            code = code.replace(/\\\\'/g, "\\\\\\\\'");
            code = code.replace(/\\\\"/g, '\\\\\\\\"');
        }

        var command = this.getCommand() + '"' + code + '"';

        return new Promise<string>((resolve, error) => {
            console.log('run command ' + command);
            cp.exec(command, {
                cwd: cwd
            },(err, stdout, stderr) => {
                this.running = false;

                if (stdout.length > 0) {
                    console.log('get response from command:' + stdout);
                    resolve(stdout);
                } else {
                    console.error(err);
                    error(stderr);
                }
            });
        });
    }

    static getScript(code: string): string {
        return `
        define('CFVSCODE', true);
        function __findCFPath($path) {
            if (!is_dir($path)) {
                return null;
            }
            if (file_exists($path . DIRECTORY_SEPARATOR . 'cf')) {
                return realpath($path);
            }

            return __findCFPath($path . DIRECTORY_SEPARATOR . '..');
        }
        function __findCFAppCode($cfPath) {
            $relativePath = trim(str_replace($cfPath, '', getcwd()), DIRECTORY_SEPARATOR);
            $relativePathExploded = explode(DIRECTORY_SEPARATOR, $relativePath);
            if (count($relativePathExploded) >= 2 && $relativePathExploded[0] == 'application') {
                return $relativePathExploded[1];
            }

            return null;
        }
        $cwdPath = getcwd();
        $cfPath = __findCFPath($cwdPath);
        $appCode = __findCFAppCode($cfPath);

        if ($appCode != null) {
            define('CF_APPCODE', $appCode);
            $appPath = $cfPath . DIRECTORY_SEPARATOR . 'application' . DIRECTORY_SEPARATOR . $appCode;
            if (file_exists($appPath . DIRECTORY_SEPARATOR . 'default' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'index.php')) {
                define('CFINDEX', $appPath . DIRECTORY_SEPARATOR . 'default' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'index.php');
            }
        } else {
            if (count($argv) < 2 && substr($argv[1], 0, 3) != 'cf:') {
                echo 'phpcf must run on cf app directory' . PHP_EOL;
                echo "example: DOCROOT.'application/cresenity/'" . PHP_EOL;

                return;
            }
        }
        require $cfPath . DIRECTORY_SEPARATOR . 'system/core/Bootstrap.php';
        if(floatval(CF_VERSION) >= 1.7) {
            `+ code +`
        }
    `;
    }

    static getCommand() {
        if (this.isDocker()) {
            return this.getDockerscript() + " php -r";
        }

        return "php -r";
    }

    static filePath(file: string) {
        if (this.isDocker()) {
            return `./${file}`;
        }

        return getPath(file);
    }

    static isDocker(): boolean {
        return !!this.getDockerscript();
    }

    static getDockerscript(): string | undefined {
        return workspace.getConfiguration("phpcf").get("docker");
    }
}
