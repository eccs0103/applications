"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";

//#region ARGB
/**
 * Conversion between Android's signed 32-bit ARGB integer color encoding and {@link Color}.
 */
export class Argb {
	static toColor(value: number): Color {
		const unsigned = value >>> 0;
		const alpha = (unsigned >>> 24) & 0xff;
		const red = (unsigned >>> 16) & 0xff;
		const green = (unsigned >>> 8) & 0xff;
		const blue = unsigned & 0xff;
		return Color.fromRGB(red, green, blue, alpha / 255);
	}

	static fromColor(color: Readonly<Color>): number {
		const alpha = Math.trunc(color.alpha * 255) & 0xff;
		const red = Math.trunc(color.red) & 0xff;
		const green = Math.trunc(color.green) & 0xff;
		const blue = Math.trunc(color.blue) & 0xff;
		const unsigned = ((alpha << 24) | (red << 16) | (green << 8) | blue) >>> 0;
		return unsigned | 0;
	}
}
//#endregion
