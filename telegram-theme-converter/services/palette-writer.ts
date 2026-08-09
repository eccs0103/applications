"use strict";

import "adaptive-extender/core";
import { Color, ColorFormats } from "adaptive-extender/core";

//#region Palette writer
/**
 * Serializes colors back into the Desktop `.tdesktop-palette` text format, always in
 * canonical key order and always as an explicit `#rrggbbaa` literal - never a reference and
 * never the `|` fallback syntax, which this project's own output never produces.
 */
export class PaletteWriter {
	/**
	 * @throws {ReferenceError} If `colors` is missing a color for a key listed in `order`.
	 */
	static write(colors: ReadonlyMap<string, Color>, order: readonly string[]): Uint8Array {
		const lines: string[] = [];
		for (const name of order) {
			const color = colors.get(name);
			if (color === undefined) throw new ReferenceError(`Missing color for key '${name}'`);
			lines.push(`${name}: ${color.toString({ format: ColorFormats.hex, deep: true })};`);
		}
		return new TextEncoder().encode(`${lines.join("\n")}\n`);
	}
}
//#endregion
