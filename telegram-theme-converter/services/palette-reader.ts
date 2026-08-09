"use strict";

import "adaptive-extender/core";
import { Color, ColorFormats } from "adaptive-extender/core";

//#region Palette reader
export class PaletteReader {
	static #patternDeclaration: RegExp = /^([a-zA-Z][a-zA-Z0-9_]*)\s*:\s*([^;]+);\s*$/;

	static #stripComment(line: string): string {
		const index = line.indexOf("//");
		return index === -1 ? line : line.slice(0, index);
	}

	static #resolveValue(value: string, resolved: ReadonlyMap<string, Color>): Color {
		if (value.startsWith("#")) {
			const deep = value.length > 7;
			return Color.parse(value, { format: ColorFormats.hex, deep });
		}
		const referenced = resolved.get(value);
		if (referenced === undefined) throw new ReferenceError(`Unknown palette reference '${value}'`);
		return new Color(referenced);
	}

	static read(text: string): Map<string, Color>;
	static read(text: string, seed: ReadonlyMap<string, Color>): Map<string, Color>;
	static read(text: string, seed: ReadonlyMap<string, Color> = new Map()): Map<string, Color> {
		const resolved = new Map<string, Color>(seed);
		for (const rawLine of text.split(/\r?\n/)) {
			const line = PaletteReader.#stripComment(rawLine).trim();
			if (line.length === 0) continue;

			const match = PaletteReader.#patternDeclaration.exec(line);
			if (match === null) throw new SyntaxError(`Invalid '${line}' line syntax`);
			const [, name, rawValue] = match;
			const alternative = rawValue.split("|")[0].trim();
			resolved.set(name, PaletteReader.#resolveValue(alternative, resolved));
		}
		return resolved;
	}
}
//#endregion
