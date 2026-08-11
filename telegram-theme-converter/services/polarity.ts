"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";
import { ColorMetrics } from "./color-metrics.js";

//#region Polarity
export enum Polarity {
	light = "light",
	dark = "dark",
}

export class PolarityDetector {
	static #threshold: number = 0.5;

	/** Classifies a theme as light or dark from the relative luminance of its primary surface color. */
	static fromSurface(surface: Readonly<Color>): Polarity {
		return ColorMetrics.relativeLuminance(surface) >= PolarityDetector.#threshold ? Polarity.light : Polarity.dark;
	}
}
//#endregion
