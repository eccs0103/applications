"use strict";

import "adaptive-extender/core";
import { Color, ColorFormats } from "adaptive-extender/core";

const patternDeclaration = /^([a-zA-Z][a-zA-Z0-9_]*)\s*:\s*([^;]+);\s*$/;

//#region Palette reader
/**
 * Parses the Desktop `.tdesktop-palette` text format: `name: value;` declarations, one per
 * line, with `//` line comments. A value is either a `#rrggbb` / `#rrggbbaa` literal, a
 * reference to a previously-declared name, or a `first | second` fallback pair - only ever
 * emitted by lib_ui's own source palette, never by an exported theme, but accepted here
 * regardless by resolving to the first alternative.
 */
export class PaletteReader {
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

	/**
	 * @param seed Colors treated as already declared before parsing begins - lets a partial
	 * override film (Desktop's built-in dark scheme, for instance) resolve references against
	 * a base palette it doesn't repeat itself.
	 * @throws {SyntaxError} If a non-empty, non-comment line does not match `name: value;`.
	 * @throws {ReferenceError} If a value references a name not yet declared.
	 */
	static read(text: string, seed: ReadonlyMap<string, Color> = new Map()): Map<string, Color> {
		const resolved = new Map<string, Color>(seed);
		for (const rawLine of text.split(/\r?\n/)) {
			const line = PaletteReader.#stripComment(rawLine).trim();
			if (line.length === 0) continue;

			const match = patternDeclaration.exec(line);
			if (match === null) throw new SyntaxError(`Invalid '${line}' line syntax`);
			const [, name, rawValue] = match;
			const alternative = rawValue.split("|")[0]!.trim();
			resolved.set(name, PaletteReader.#resolveValue(alternative, resolved));
		}
		return resolved;
	}
}
//#endregion
