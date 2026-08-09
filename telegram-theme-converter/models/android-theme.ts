"use strict";

import "adaptive-extender/core";
import { ThemeDocument } from "./theme-document.js";
import { AtthemeReader, markerWallpaperStart, markerWallpaperEnd } from "../services/attheme-reader.js";
import { AtthemeWriter } from "../services/attheme-writer.js";
import { concatBytes } from "../services/bytes.js";

const noWallpaperOffset = -1;
const maxOffsetIterations = 8;

//#region Android theme
/**
 * A parsed Android `.attheme` document.
 */
export class AndroidTheme extends ThemeDocument {
	static parse(bytes: Readonly<Uint8Array>): AndroidTheme {
		const { colors, wallpaper } = AtthemeReader.read(bytes);
		return new AndroidTheme(colors, wallpaper);
	}

	/**
	 * Serializes this theme, computing `wallpaperFileOffset` from where the wallpaper bytes
	 * actually land - never copying it from the source theme, since that offset is only ever
	 * valid for the exact byte layout it was measured against.
	 */
	async serialize(order: readonly string[]): Promise<Uint8Array> {
		const wallpaper = this.wallpaper;
		if (wallpaper === null) return AtthemeWriter.writeText(this.colors, order, noWallpaperOffset);

		let offset = 0;
		for (let iteration = 0; iteration < maxOffsetIterations; iteration++) {
			const text = AtthemeWriter.writeText(this.colors, order, offset);
			const measured = text.length + markerWallpaperStart.length;
			if (measured === offset) return concatBytes([text, markerWallpaperStart, wallpaper, markerWallpaperEnd]);
			offset = measured;
		}
		throw new Error("Unable to converge on a stable wallpaperFileOffset");
	}
}
//#endregion
