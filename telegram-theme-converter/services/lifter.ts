"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";
import { type ThemeDocument } from "../models/theme-document.js";
import { type Platform } from "../models/platform.js";

//#region Lifter
/**
 * Lifts a source theme's native keys into platform-neutral role values.
 * Reads only from each role's authority key on the source platform - every other key bound to
 * that role is write-only and is never consulted here, which is what makes the many-to-one
 * binding unambiguous. A role whose authority key the source theme does not declare is simply
 * absent from the result; the projector's inheritance walk is what decides whether that matters.
 */
export class Lifter {
	static lift(theme: Readonly<ThemeDocument>, platform: Readonly<Platform>): Map<string, Color> {
		const values = new Map<string, Color>();
		for (const role of platform.bindings.roles()) {
			const authorityKey = platform.bindings.authorityKeyFor(role);
			if (authorityKey === null) continue;
			const color = theme.colors.get(authorityKey);
			if (color === undefined) continue;
			values.set(role, color);
		}
		return values;
	}
}
//#endregion
