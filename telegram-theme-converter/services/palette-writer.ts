"use strict";

import "adaptive-extender/core";
import { Color, ColorFormats } from "adaptive-extender/core";
import { type Codec } from "./codec.js";

//#region Palette writer
export class PaletteWriter {
	static write(colors: ReadonlyMap<string, Color>, order: readonly string[], codec: Codec): Uint8Array {
		const lines: string[] = [];
		for (const name of order) {
			const color = ReferenceError.suppress(colors.get(name), `Missing color for key '${name}'`);
			lines.push(`${name}: ${color.toString({ format: ColorFormats.hex, deep: true })};`);
		}
		return codec.encode(`${lines.join("\n")}\n`);
	}
}
//#endregion
