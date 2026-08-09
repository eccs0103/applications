"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { Vocabulary } from "../models/vocabulary.js";
import { RuleTable } from "../models/rule-table.js";
import { AndroidTheme } from "../models/android-theme.js";
import { DesktopTheme } from "../models/desktop-theme.js";
import { Report, KeyOutcome } from "../models/report.js";

export interface ConversionResult<T> {
	theme: T;
	report: Report;
}

//#region Converter
/**
 * Applies the rule table in either direction.
 *
 * Android -> Desktop: every one of the Desktop vocabulary's 586 keys is produced from its
 * paired Android key (the bijective core); the ~173 Android-only keys are dropped. Zero
 * fabrication in this direction - every emitted color is a value the source theme genuinely
 * declared, or the source platform's own default where the theme left a key unspecified.
 *
 * Desktop -> Android: the 586 core keys map back through the same rules; the remaining
 * surplus Android keys are derived from an already-resolved core anchor. The whole output is
 * always the complete 759-key Android vocabulary.
 */
export class Converter {
	#androidVocabulary: Vocabulary;
	#desktopVocabulary: Vocabulary;
	#ruleTable: RuleTable;

	constructor(androidVocabulary: Vocabulary, desktopVocabulary: Vocabulary, ruleTable: RuleTable) {
		this.#androidVocabulary = androidVocabulary;
		this.#desktopVocabulary = desktopVocabulary;
		this.#ruleTable = ruleTable;
	}

	/**
	 * Resolves a key from the theme's own colors, falling back to the platform's own light
	 * default when the source theme left the key unspecified - the same policy already proven
	 * correct for partial Desktop override films (see {@link DesktopTheme.parse}), applied
	 * uniformly here rather than guessing the source theme's brightness.
	 */
	#resolveOrDefault(colors: ReadonlyMap<string, Color>, key: string, vocabulary: Vocabulary): Color {
		const color = colors.get(key);
		if (color !== undefined) return color;
		return vocabulary.get(key).lightColor();
	}

	androidToDesktop(source: Readonly<AndroidTheme>): ConversionResult<DesktopTheme> {
		const report = new Report();
		const colors = new Map<string, Color>();

		for (const entry of this.#desktopVocabulary.entries) {
			const rule = this.#ruleTable.directRuleForDesktopKey(entry.name);
			colors.set(entry.name, this.#resolveOrDefault(source.colors, rule.source, this.#androidVocabulary));
			report.record(entry.name, KeyOutcome.direct);
		}

		for (const name of source.names()) {
			if (this.#ruleTable.directRuleForAndroidSource(name) === null) report.record(name, KeyOutcome.dropped);
		}

		const theme = new DesktopTheme(colors, source.wallpaper, false);
		return { theme, report };
	}

	desktopToAndroid(source: Readonly<DesktopTheme>): ConversionResult<AndroidTheme> {
		const report = new Report();
		const colors = new Map<string, Color>();

		for (const entry of this.#androidVocabulary.entries) {
			const rule = this.#ruleTable.directRuleForAndroidSource(entry.name);
			if (rule === null) continue;
			colors.set(entry.name, this.#resolveOrDefault(source.colors, rule.target, this.#desktopVocabulary));
			report.record(entry.name, KeyOutcome.direct);
		}

		for (const entry of this.#androidVocabulary.entries) {
			if (colors.has(entry.name)) continue;
			const rule = this.#ruleTable.anchoredRuleForAndroidKey(entry.name);
			if (rule === null) throw new ReferenceError(`Android key '${entry.name}' has neither a direct nor an anchored rule`);
			colors.set(entry.name, rule.resolve(colors));
			report.record(entry.name, KeyOutcome.anchored);
		}

		const theme = new AndroidTheme(colors, source.wallpaper);
		return { theme, report };
	}
}
//#endregion
