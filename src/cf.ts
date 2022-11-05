import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs";
class CF {


    isCF() : boolean {
        let isCF = false;
        if (vscode.workspace.workspaceFolders.length > 0) {
            vscode.workspace.workspaceFolders.forEach(element => {
                let root = element.uri.fsPath;
                let cfFile = root + path.sep + 'cf';
                if (fs.existsSync(cfFile)) {
                    isCF = true;
                }
            });
        }
        return isCF;
    }

    appCode(relativePath:string ) : string {
        let relativePathExploded = relativePath.split(path.sep);
        let appCode = null;
        if(relativePathExploded.length>2) {
            if(relativePathExploded[0]=='application') {
                appCode = relativePathExploded[1];
            }
        }
        return appCode;
    }
}

const cf = new CF();

export default cf;
