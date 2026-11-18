"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { AtthemeReader } from "./attheme-reader.js";
import { Argb } from "./argb.js";
import { type Codec } from "./codec.js";

//#region Attheme writer
export class AtthemeWriter {
	static writeText(colors: ReadonlyMap<string, Color>, order: readonly string[], wallpaperFileOffset: number, codec: Codec): Uint8Array {
		const lines: string[] = [`${AtthemeReader.keyWallpaperOffset}=${wallpaperFileOffset}`];
		for (const name of order) {
			const color = ReferenceError.suppress(colors.get(name), `Missing color for key '${name}'`);
			lines.push(`${name}=${Argb.fromColor(color)}`);
		}
		return codec.encode(`${lines.join("\n")}\n`);
	}
}
//#endregion
