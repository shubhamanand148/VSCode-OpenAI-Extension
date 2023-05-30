import * as vscode from 'vscode';
import { SidebarProvider, response } from "./sidebarProvider";

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "openaiextension" is now active!');


	//Hello World Message display
	context.subscriptions.push(vscode.commands.registerCommand('openaiextension.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from OpenAIExtension!');
	}));

	const sidebarProvider = new SidebarProvider(context.extensionUri);
	
	context.subscriptions.push(vscode.window.registerWebviewViewProvider("OpenAI-sidebar", sidebarProvider));

	// //Open AI Sidepanel creator
	// context.subscriptions.push(vscode.commands.registerCommand('openaiextension.response', () => {
	// 	sidebarProvider._view?.webview.postMessage({
	// 		type: "openai-response",
	// 		value: response
	// 	});
	// 	console.log("Inside Open AI Sidepanel creator");
	// }));
}

export function deactivate() {}
