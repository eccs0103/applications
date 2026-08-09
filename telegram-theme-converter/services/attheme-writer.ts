"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { keyWallpaperOffset } from "./attheme-reader.js";
import { Argb } from "./argb.js";

//#region Attheme writer
/**
 * Serializes colors back into the Android `.attheme` text format. Pure and stateless: it
 * only renders the text section. Placing the wallpaper image and computing the value of
 * `wallpaperFileOffset` are the responsibility of the caller, since only the caller knows
 * where the wallpaper bytes will ultimately sit.
 */
export class AtthemeWriter {
	/**
	 * Renders the text section: `wallpaperFileOffset` first, then every key in `order`.
	 * @throws {ReferenceError} If `colors` is missing a color for a key listed in `order`.
	 */
	static writeText(colors: ReadonlyMap<string, Color>, order: readonly string[], wallpaperFileOffset: number): Uint8Array {
		const lines: string[] = [`${keyWallpaperOffset}=${wallpaperFileOffset}`];
		for (const name of order) {
			const color = colors.get(name);
			if (color === undefined) throw new ReferenceError(`Missing color for key '${name}'`);
			lines.push(`${name}=${Argb.fromColor(color)}`);
		}
		return new TextEncoder().encode(`${lines.join("\n")}\n`);
	}
}
//#endregion
