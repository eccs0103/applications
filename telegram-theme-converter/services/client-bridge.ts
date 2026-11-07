"use strict";

import "adaptive-extender/web";
import { type URI } from "adaptive-extender/web";
import { type Bridge } from "./bridge.js";

//#region Client bridge
export class ClientBridge implements Bridge {
	async read(path: Readonly<URI>): Promise<string | null> {
		const response = await fetch(path.href);
		if (response.status === 404) return null;
		if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
		return response.text();
	}
}
//#endregion
