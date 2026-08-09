"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";
import { Color } from "adaptive-extender/core";

//#region Palette entry
/**
 * A single canonical vocabulary entry: a color key name together with the platform's own
 * official default value for that key in its light and dark built-in themes.
 */
export class PaletteEntry extends Model {
	@Field(String, { name: "name" })
	name: string;

	@Field(String, { name: "light" })
	light: string;

	@Field(String, { name: "dark" })
	dark: string;

	lightColor(): Color {
		return Color.parse(this.light, { deep: true });
	}

	darkColor(): Color {
		return Color.parse(this.dark, { deep: true });
	}
}
//#endregion
