import { COMMAND_MODEL_UPDATE } from "../constant";
import { checkCommand } from "./abstract/createCommand";
import * as vscode from "vscode";
import modelUpdate from "./phpcf/modelUpdate";

export default checkCommand({
    id: COMMAND_MODEL_UPDATE,

    handleCommand(uri: vscode.Uri) {
        modelUpdate(uri);
        //console.log('handleCommand:createClassFile',className, appRoot);
    },
});
