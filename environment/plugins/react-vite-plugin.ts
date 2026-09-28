"use strict";

import "adaptive-extender/node";
import { type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { VitePlugin } from "./vite-plugin.js";

//#region React Vite plugin
export class ReactVitePlugin extends VitePlugin {
	constructor() {
		super("react");
	}

	build(): PluginOption {
		return react({ include: /\.tsx$/ });
	}
}
//#endregion
