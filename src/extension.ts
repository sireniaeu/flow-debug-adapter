'use strict';

import * as Net from 'net';
import * as vscode from 'vscode';
import { LoggingDebugSession } from '@vscode/debugadapter';
import { activateFlowDebug } from './activateFlowDebug';

/*
 * The compile time flag 'runMode' controls how the debug adapter is run.
 * Please note: the test suite only supports 'external' mode.
 */
const runMode: 'external' | 'server' | 'namedPipeServer' | 'inline' = 'server';

export function activate(context: vscode.ExtensionContext) {

	// debug adapters can be run in different ways by using a vscode.DebugAdapterDescriptorFactory:
	switch (runMode) {
		case 'server':
			// run the debug adapter as a server inside the extension and communicate via a socket
			activateFlowDebug(context, new ManateeDebugAdapterServerDescriptorFactory());
			break;
	}
}

export function deactivate() {
	// nothing to do
}

class ManateeDebugAdapterServerDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

	private server?: Net.Server;

	createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
		// TODO detect port
		return new vscode.DebugAdapterServer(50000);
	}

	dispose() {
		if (this.server) {
			this.server.close();
		}
	}
}
