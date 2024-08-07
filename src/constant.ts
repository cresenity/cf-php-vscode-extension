export const VIEW_REGEX = "(?<=view\\(|@include\\(|@extends\\(|@component\\(|addView\\(|setView\\(|setViewLoginName\\(|CView::factory\\(|Inertia::render\\()(['\"])[^'\"]*\\1";
export const CONTROLLER_URL_REGEX = "(?<=curl::redirect\\(|c::redirect\\(|c::url\\()(['\"])[^'\"]*\\1";
export const EXTENSION_NAME = 'phpcf';


// command not in package.json
export const COMMAND_TOGGLE_OUTPUT = 'phpcf.toggleOutput';



// commands in package.json
export const COMMAND_CREATE_CLASS_FILE = 'phpcf.createClassFile';
export const COMMAND_MODEL_UPDATE = 'phpcf.modelUpdate';
export const COMMAND_PHPCSFIXER = 'phpcf.phpcsfixer';
