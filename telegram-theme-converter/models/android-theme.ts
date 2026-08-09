"use strict";

import "adaptive-extender/core";
import { ThemeDocument } from "./theme-document.js";
import { AtthemeReader } from "../services/attheme-reader.js";
import { AtthemeWriter } from "../services/attheme-writer.js";
import { BytesTool } from "../services/bytes.js";

//#region Android theme
export class AndroidTheme extends ThemeDocument {
	static #noWallpaperOffset: number = -1;
	static #maxOffsetIterations: number = 8;

	static parse(bytes: Readonly<Uint8Array>): AndroidTheme {
		const { colors, wallpaper } = AtthemeReader.read(bytes);
		return new AndroidTheme(colors, wallpaper);
	}

	async serialize(order: readonly string[]): Promise<Uint8Array> {
		const wallpaper = this.wallpaper;
		if (wallpaper === null) return AtthemeWriter.writeText(this.colors, order, AndroidTheme.#noWallpaperOffset);

		let offset = 0;
		for (let iteration = 0; iteration < AndroidTheme.#maxOffsetIterations; iteration++) {
			const text = AtthemeWriter.writeText(this.colors, order, offset);
			const measured = text.length + AtthemeReader.markerWallpaperStart.length;
			if (measured === offset) return BytesTool.concat([text, AtthemeReader.markerWallpaperStart, wallpaper, AtthemeReader.markerWallpaperEnd]);
			offset = measured;
		}
		throw new Error("Unable to converge on a stable offsetWallpaperFile");
	}
}
//#endregion
