"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";

const { trunc } = Math;

//#region ARGB
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
		const alpha = trunc(color.alpha * 255) & 0xff;
		const red = trunc(color.red) & 0xff;
		const green = trunc(color.green) & 0xff;
		const blue = trunc(color.blue) & 0xff;
		const unsigned = ((alpha << 24) | (red << 16) | (green << 8) | blue) >>> 0;
		return unsigned | 0;
	}
}
//#endregion
