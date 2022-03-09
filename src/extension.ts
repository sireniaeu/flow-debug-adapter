'use strict';

import * as Net from 'net';
import * as vscode from 'vscode';
import Registry from 'winreg';
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

async function readPort():Promise<number> {
	return new Promise(function(resolve, reject) {
	let key = new Registry({                                     
		hive: Registry.HKCU,                                       
		key:  '\\Software\\Sirenia\\Manatee\\Ports' 
	  });
	  key.get("websocketserver",function (err, item /* array of RegistryItem */) {
		if (err) { reject(err); }
		else { resolve(Number.parseInt(item.value)); }
	  });
	});
}

class ManateeDebugAdapterServerDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

	private server?: Net.Server;

	async createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): Promise<vscode.ProviderResult<vscode.DebugAdapterDescriptor>> {
		// TODO detect port, prefer configured port
		var port = await readPort();
		return new vscode.DebugAdapterServer(port);
	}

	dispose() {
		if (this.server) {
			this.server.close();
		}
	}
}
