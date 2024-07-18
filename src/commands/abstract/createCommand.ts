import { Uri } from "vscode";
import Command from "./command";

interface BaseCommandOption {
    id: string;
    name?: string;
}

interface CommandOption extends BaseCommandOption {
    handleCommand: (
        this: Command,
        ...args: any[]
    ) => unknown | Promise<unknown>;
}

function checkType<T>() {
    return (a: T) => a;
}

export const checkCommand = checkType<CommandOption>();

export function createCommand(commandOption: CommandOption & { name: string }) {
    return class NormalCommand extends Command {
        constructor() {
            super();
            this.id = commandOption.id;
            this.name = commandOption.name;
        }

        doCommandRun(...args) {
            commandOption.handleCommand.apply(this, args);
        }
    };
}
