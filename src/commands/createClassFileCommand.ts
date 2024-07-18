import { COMMAND_CREATE_CLASS_FILE } from "../constant";
import * as output from "../ui/output";
import { checkCommand } from "./abstract/createCommand";
import makeClass from "./make/makeClass";
import makeModel from "./make/makeModel";

export default checkCommand({
    id: COMMAND_CREATE_CLASS_FILE,

    handleCommand(className:string, appRoot:string, appPrefix:string) {
        if(className.endsWith('Model')) {
            return makeModel(className, appRoot, appPrefix);
        }
        return makeClass(className, appRoot, appPrefix);
        //console.log('handleCommand:createClassFile',className, appRoot);
    },
});
