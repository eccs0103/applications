"use strict";

import { defineConfig } from "vite";
import { type ViteConfig } from "./environment/configs/vite-config.js";
import { MPAConfig } from "./environment/configs/mpa-config.js";
import { CloudflareVitePlugin } from "./environment/plugins/cloudflare-vite-plugin.js";
import { type VitePlugin } from "./environment/plugins/vite-plugin.js";

const root: URL = new URL(import.meta.url);
const inputs: URL[] = [
	new URL("./209-birthdays/index.html", root),
	new URL("./telegram-theme-converter/index.html", root),
];
const rootEntries: URL[] = [
	new URL("./209-birthdays/services/service-worker.ts", root),
];
const pathEntries: URL[] = [];
const output: URL = new URL("./dist", root);
const plugins: VitePlugin[] = [new CloudflareVitePlugin()];
const config: ViteConfig = await MPAConfig.construct(inputs, rootEntries, pathEntries, output, plugins);
export default defineConfig(config.build());
