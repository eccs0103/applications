"use strict";

import "adaptive-extender/core";
import { type Platform } from "../models/platform.js";
import { type RoleVocabulary } from "../models/role-vocabulary.js";
import { type ThemeDocument } from "../models/theme-document.js";
import { Report, KeyOutcome } from "../models/report.js";
import { Lifter } from "./lifter.js";
import { Projector } from "./projector.js";

//#region Converter
export interface ConversionResult<T extends ThemeDocument> {
	theme: T;
	report: Report;
}

/**
 * Converts a theme between any two {@link Platform}s through a platform-neutral role hub:
 * lift the source theme's authority keys into role values, then project those role values onto
 * the target platform's keys. Adding a platform costs one vocabulary and one binding table; this
 * class never branches on which platforms are involved.
 */
export class Converter {
	#roles: RoleVocabulary;

	constructor(roles: RoleVocabulary) {
		this.#roles = roles;
	}

	convert(source: Readonly<ThemeDocument>, from: Readonly<Platform>, to: Readonly<Platform>): ConversionResult<ThemeDocument> {
		const values = Lifter.lift(source, from);
		const report = new Report();

		for (const key of from.bindings.keys()) {
			if (from.bindings.isAuthority(key)) continue;
			report.record(key, KeyOutcome.unread);
		}

		const colors = Projector.project(values, to, this.#roles, report);
		const theme = to.create(colors, source.wallpaper);
		return { theme, report };
	}
}
//#endregion
