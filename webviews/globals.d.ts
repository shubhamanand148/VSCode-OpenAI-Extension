import * as _vscode from "vscode";

declare global{
    const vscodeApi: {
        postMessage: ({ type: string, value: any }) => void;
    };
}