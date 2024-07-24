import { getPath } from "./../util";
import * as cp from "child_process";
import * as os from "os";
import cf from "./../cf";
import { workspace, window, TextDocument } from "vscode";

export default class PHPCF {
    static phpParser: any = null;

    static running: boolean = false;

    static async run(command: string, document:TextDocument = null): Promise<string> {
        //if (cf.hasAutoload() && cf.hasBootstrapApp()) {

        const cwd = cf.getAppRoot(document);
        if(cwd!=null) {
            var out: string | null | RegExpExecArray = await this.execute(
                command, cwd
            );
            console.log('phpcf out:' + out);
            return out;
        }
        return "";
    }

    static async execute(command: string, cwd: string): Promise<string> {
        if (this.running) {
            return "";
        }
        const phpCfPath = cf.getPhpcfPath();
        if(!phpCfPath) {
            return '';
        }
        this.running = true;



        var fullCommand = '"' + phpCfPath + '"' + ' ' + command + '';

        return new Promise<string>((resolve, error) => {
            console.log('run phpcf command ' + fullCommand);
            cp.exec(fullCommand, {
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


}
