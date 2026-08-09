"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { AtthemeReader } from "./attheme-reader.js";
import { Argb } from "./argb.js";

//#region Attheme writer
export class AtthemeWriter {
	static writeText(colors: ReadonlyMap<string, Color>, order: readonly string[], wallpaperFileOffset: number): Uint8Array {
		const lines: string[] = [`${AtthemeReader.keyWallpaperOffset}=${wallpaperFileOffset}`];
		for (const name of order) {
			const color = colors.get(name);
			if (color === undefined) throw new ReferenceError(`Missing color for key '${name}'`);
			lines.push(`${name}=${Argb.fromColor(color)}`);
		}
		return new TextEncoder().encode(`${lines.join("\n")}\n`);
	}
}
//#endregion
