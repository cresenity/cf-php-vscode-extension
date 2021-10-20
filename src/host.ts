import * as vscode from 'vscode';

export function getUserSetting(section: string, resource?: vscode.Uri | null | undefined) {
  return vscode.workspace.getConfiguration(section, resource);
}

export function showErrorMessage(message: string, ...items: string[]) {
  return vscode.window.showErrorMessage(message, ...items);
}

export function showInformationMessage(message: string, ...items: string[]) {
  return vscode.window.showInformationMessage(message, ...items);
}

export function showWarningMessage(message: string, ...items: string[]) {
  return vscode.window.showWarningMessage(message, ...items);
}

export function registerCommand(
  context: vscode.ExtensionContext,
  name: string,
  callback: (...args: any[]) => any,
  thisArg?: any
) {
  const disposable = vscode.commands.registerCommand(name, callback, thisArg);
  context.subscriptions.push(disposable);
}