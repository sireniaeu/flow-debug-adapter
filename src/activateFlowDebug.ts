/*---------------------------------------------------------
* Copyright (C) Microsoft Corporation. All rights reserved.
*--------------------------------------------------------*/
/*
* activateFlowDebug.ts containes the shared extension code that can be executed both in node.js and the browser.
*/

'use strict';

import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { processFile } from './fileProcessor';

export function activateFlowDebug(context: vscode.ExtensionContext, factory?: vscode.DebugAdapterDescriptorFactory) {
	
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.flow-debug.runEditorContents', (resource: vscode.Uri) => {
			let targetResource = resource;
			if (!targetResource && vscode.window.activeTextEditor) {
				targetResource = vscode.window.activeTextEditor.document.uri;
			}
			if (targetResource) {
				vscode.debug.startDebugging(undefined, {
					type: 'flow',
					name: 'Run Manatee flow',
					request: 'launch',
					program: targetResource.fsPath
				},
				{ noDebug: true }
				);
			}
		}),
		vscode.commands.registerCommand('extension.flow-debug.debugEditorContents', (resource: vscode.Uri) => {
			let targetResource = resource;
			if (!targetResource && vscode.window.activeTextEditor) {
				targetResource = vscode.window.activeTextEditor.document.uri;
			}
			if (targetResource) {
				// preprocess file and write to new tmp file
				var contents = vscode.window.activeTextEditor?.document.getText();
				processFile(contents ?? "", (path) => {
					vscode.debug.startDebugging(undefined, {
						type: 'flow',
						name: 'Debug Manatee flow',
						request: 'launch',
						program: path,
						stopOnEntry: true
					});
				});
			}
		}),
		vscode.commands.registerCommand('extension.flow-debug.toggleFormatting', (variable) => {
			const ds = vscode.debug.activeDebugSession;
			if (ds) {
				ds.customRequest('toggleFormatting');
			}
		})
		);
		
		context.subscriptions.push(vscode.commands.registerCommand('extension.flow-debug.getProgramName', config => {
			return vscode.window.showInputBox({
				placeHolder: "Please enter the name of a flow (javascript) file in the workspace folder",
				value: "flow.js"
			});
		}));
		
		// register a configuration provider for 'flow' debug type
		const provider = new FlowConfigurationProvider();
		context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('flow', provider));
		
		// register a dynamic configuration provider for 'flow' debug type
		context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('flow', {
			provideDebugConfigurations(folder: WorkspaceFolder | undefined): ProviderResult<DebugConfiguration[]> {
				return [
					{
						name: "Dynamic Launch",
						request: "launch",
						type: "flow",
						program: "${file}"
					},
					{
						name: "Another Dynamic Launch",
						request: "launch",
						type: "flow",
						program: "${file}"
					},
					{
						name: "Flow Launch",
						request: "launch",
						type: "flow",
						program: "${file}"
					}
				];
			}
		}, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
		
		/*
		if (!factory) {
			factory = new InlineDebugAdapterFactory();
		}*/
		
		if (factory) {
			context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('flow', factory));
			if ('dispose' in factory) {
				context.subscriptions.push(factory);
			}
		}
		
		// override VS Code's default implementation of the debug hover
		// here we match only Flow "variables", that are words starting with an '$'
		if (false) {
			context.subscriptions.push(vscode.languages.registerEvaluatableExpressionProvider('markdown', {
				provideEvaluatableExpression(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.EvaluatableExpression> {
					
					const VARIABLE_REGEXP = /\$[a-z][a-z0-9]*/ig;
					const line = document.lineAt(position.line).text;
					
					let m: RegExpExecArray | null;
					while (m = VARIABLE_REGEXP.exec(line)) {
						const varRange = new vscode.Range(position.line, m.index, position.line, m.index + m[0].length);
						
						if (varRange.contains(position)) {
							return new vscode.EvaluatableExpression(varRange);
						}
					}
					return undefined;
				}
			}));
			
			// override VS Code's default implementation of the "inline values" feature"
			context.subscriptions.push(vscode.languages.registerInlineValuesProvider('markdown', {
				
				provideInlineValues(document: vscode.TextDocument, viewport: vscode.Range, context: vscode.InlineValueContext) : vscode.ProviderResult<vscode.InlineValue[]> {
					
					const allValues: vscode.InlineValue[] = [];
					
					for (let l = viewport.start.line; l <= context.stoppedLocation.end.line; l++) {
						const line = document.lineAt(l);
						var regExp = /\$([a-z][a-z0-9]*)/ig;	// variables are words starting with '$'
						do {
							var m = regExp.exec(line.text);
							if (m) {
								const varName = m[1];
								const varRange = new vscode.Range(l, m.index, l, m.index + varName.length);
								
								// some literal text
								//allValues.push(new vscode.InlineValueText(varRange, `${varName}: ${viewport.start.line}`));
								
								// value found via variable lookup
								allValues.push(new vscode.InlineValueVariableLookup(varRange, varName, false));
								
								// value determined via expression evaluation
								//allValues.push(new vscode.InlineValueEvaluatableExpression(varRange, varName));
							}
						} while (m);
					}
					
					return allValues;
				}
			}));
		}
	}
	
	class FlowConfigurationProvider implements vscode.DebugConfigurationProvider {
		
		/**
		* Massage a debug configuration just before a debug session is being launched,
		* e.g. add all missing attributes to the debug configuration.
		*/
		resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
			
			// if launch.json is missing or empty
			if (!config.type && !config.request && !config.name) {
				const editor = vscode.window.activeTextEditor;
				if (editor && editor.document.languageId === 'markdown') {
					config.type = 'flow';
					config.name = 'Launch';
					config.request = 'launch';
					config.program = '${file}';
					config.stopOnEntry = true;
				}
			}
			
			if (!config.program) {
				return vscode.window.showInformationMessage("Cannot find a program to debug").then(_ => {
					return undefined;	// abort launch
				});
			}
			
			return config;
		}
	}
	