import { basename } from "path";
import * as vscode from "vscode";
import PHPCF from "../../phpcf";

function snakeCase(str) {
    // Replace all instances of an uppercase letter followed by a lowercase letter with an underscore and the lowercase letter
    return str.replace(/([a-z])([A-Z])/g, '$1_$2')
        // Replace all instances of an uppercase letter that is not preceded by a lowercase letter with an underscore and the lowercase letter
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        // Convert the entire string to lowercase
        .toLowerCase();
}

export default function modelUpdate(uri:vscode.Uri) {
    const fsPath = uri.fsPath;
    const fileName = basename(fsPath);
    const className = fileName.replace('.php','');
    const table = snakeCase(className);
    PHPCF.run('model:update ' + table);
}
