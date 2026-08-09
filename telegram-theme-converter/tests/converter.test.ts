"use strict";

import "adaptive-extender/core";
import { Color, ColorFormats } from "adaptive-extender/core";
import { describe, it, expect } from "vitest";
import AsyncFileSystem from "node:fs/promises";
import { Vocabulary } from "../models/vocabulary.js";
import { RuleTable } from "../models/rule-table.js";
import { Transform } from "../models/rule.js";
import { Converter } from "../services/converter.js";
import { AndroidTheme } from "../models/android-theme.js";
import { DesktopTheme } from "../models/desktop-theme.js";
import { KeyOutcome } from "../models/report.js";
import { ArchiveReader } from "../services/archive-reader.js";
import { PaletteReader } from "../services/palette-reader.js";
import { AtthemeReader } from "../services/attheme-reader.js";

const dataDir = new URL("../../resources/data/", import.meta.url);
const fixtures = new URL("./fixtures/", import.meta.url);

async function loadVocabulary(name: string): Promise<Vocabulary> {
	const json = await AsyncFileSystem.readFile(new URL(name, dataDir), "utf-8");
	return Vocabulary.import(JSON.parse(json), name);
}

async function loadRuleTable(): Promise<RuleTable> {
	const json = await AsyncFileSystem.readFile(new URL("telegram-conversion-rules.json", dataDir), "utf-8");
	return RuleTable.import(JSON.parse(json), "telegram-conversion-rules.json");
}

async function loadEverything() {
	const [androidVocabulary, desktopVocabulary, ruleTable] = await Promise.all([
		loadVocabulary("telegram-android-vocabulary.json"),
		loadVocabulary("telegram-desktop-vocabulary.json"),
		loadRuleTable(),
	]);
	const converter = new Converter(androidVocabulary, desktopVocabulary, ruleTable);
	return { androidVocabulary, desktopVocabulary, ruleTable, converter };
}

function colorsEqual(first: Readonly<Color>, second: Readonly<Color>): boolean {
	return first.toString({ format: ColorFormats.hex, deep: true }) === second.toString({ format: ColorFormats.hex, deep: true });
}

async function readFixture(name: string): Promise<Uint8Array> {
	const buffer = await AsyncFileSystem.readFile(new URL(name, fixtures));
	return new Uint8Array(buffer);
}

describe("RuleTable integrity", () => {
	it("has exactly 759 rules: 586 direct + 173 anchored", async () => {
		const { ruleTable } = await loadEverything();
		expect(ruleTable.rules.length).toBe(759);
		expect(ruleTable.directRules().length).toBe(586);
		expect(ruleTable.anchoredRules().length).toBe(173);
	});

	it("the direct rules form an injective bijection onto the full Desktop vocabulary", async () => {
		const { desktopVocabulary, ruleTable } = await loadEverything();
		const targets = new Set(ruleTable.directRules().map(rule => rule.target));
		const sources = new Set(ruleTable.directRules().map(rule => rule.source));
		expect(targets.size).toBe(586);
		expect(sources.size).toBe(586);
		expect(desktopVocabulary.isComplete(targets)).toBe(true);
	});

	it("every rule's target and referenced sources are real vocabulary keys", async () => {
		const { androidVocabulary, desktopVocabulary, ruleTable } = await loadEverything();
		for (const rule of ruleTable.directRules()) {
			expect(desktopVocabulary.has(rule.target)).toBe(true);
			expect(androidVocabulary.has(rule.source)).toBe(true);
		}
		for (const rule of ruleTable.anchoredRules()) {
			expect(androidVocabulary.has(rule.target)).toBe(true);
			expect(androidVocabulary.has(rule.source)).toBe(true);
			if (rule.mixWith !== null) expect(androidVocabulary.has(rule.mixWith)).toBe(true);
		}
	});

	it("every anchor points inside the bijective core - no chains, no cycles", async () => {
		const { ruleTable } = await loadEverything();
		const coreSources = new Set(ruleTable.directRules().map(rule => rule.source));
		const anchoredTargets = new Set(ruleTable.anchoredRules().map(rule => rule.target));
		for (const rule of ruleTable.anchoredRules()) {
			expect(coreSources.has(rule.source)).toBe(true);
			expect(anchoredTargets.has(rule.source)).toBe(false);
		}
	});

	it("the Android vocabulary is fully covered: every key is a core source or an anchored target, never both", async () => {
		const { androidVocabulary, ruleTable } = await loadEverything();
		const coreSources = new Set(ruleTable.directRules().map(rule => rule.source));
		const anchoredTargets = new Set(ruleTable.anchoredRules().map(rule => rule.target));
		for (const name of coreSources) expect(anchoredTargets.has(name)).toBe(false);
		const covered = new Set([...coreSources, ...anchoredTargets]);
		expect(androidVocabulary.isComplete(covered)).toBe(true);
	});

	it("every fitted alpha/lightness transform reproduces both the light and the dark official samples", async () => {
		const { androidVocabulary, ruleTable } = await loadEverything();
		for (const rule of ruleTable.anchoredRules()) {
			if (rule.transform !== Transform.alpha && rule.transform !== Transform.lightness) continue;
			const anchor = androidVocabulary.get(rule.source);
			const target = androidVocabulary.get(rule.target);
			const resolvedLight = rule.resolve(new Map([[rule.source, anchor.lightColor()]]));
			const resolvedDark = rule.resolve(new Map([[rule.source, anchor.darkColor()]]));
			if (rule.transform === Transform.alpha) {
				expect(colorsEqual(resolvedLight, target.lightColor())).toBe(true);
				expect(colorsEqual(resolvedDark, target.darkColor())).toBe(true);
			} else {
				const expectedLight = target.lightColor();
				const expectedDark = target.darkColor();
				expect(Math.abs(resolvedLight.red - expectedLight.red)).toBeLessThanOrEqual(6);
				expect(Math.abs(resolvedDark.red - expectedDark.red)).toBeLessThanOrEqual(6);
			}
		}
	});
});

describe("Converter completeness", () => {
	it("Android -> Desktop always emits exactly the Desktop vocabulary's key set", async () => {
		const { desktopVocabulary, converter } = await loadEverything();
		const source = new AndroidTheme(new Map(), null);
		const { theme } = converter.androidToDesktop(source);
		expect(desktopVocabulary.isComplete(theme.names())).toBe(true);
	});

	it("Desktop -> Android always emits exactly the Android vocabulary's key set", async () => {
		const { androidVocabulary, converter } = await loadEverything();
		const source = new DesktopTheme(new Map(), null);
		const { theme } = converter.desktopToAndroid(source);
		expect(androidVocabulary.isComplete(theme.names())).toBe(true);
	});

	it("Android -> Desktop reports every Desktop key as direct and every non-core source key as dropped", async () => {
		const { androidVocabulary, ruleTable, converter } = await loadEverything();
		const source = new AndroidTheme(new Map(androidVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		const { report } = converter.androidToDesktop(source);
		expect(report.countBy(KeyOutcome.direct)).toBe(586);
		const coreSources = new Set(ruleTable.directRules().map(rule => rule.source));
		const expectedDropped = androidVocabulary.entries.map(entry => entry.name).filter(name => !coreSources.has(name));
		expect(report.keysBy(KeyOutcome.dropped)).toEqual(expectedDropped.sort());
	});

	it("Desktop -> Android reports exactly 586 direct and 173 anchored keys", async () => {
		const { desktopVocabulary, converter } = await loadEverything();
		const source = new DesktopTheme(new Map(desktopVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		const { report } = converter.desktopToAndroid(source);
		expect(report.countBy(KeyOutcome.direct)).toBe(586);
		expect(report.countBy(KeyOutcome.anchored)).toBe(173);
	});
});

describe("Converter round trip", () => {
	it("Desktop -> Android -> Desktop is the identity across all 586 keys, using official sample palettes", async () => {
		const { desktopVocabulary, converter } = await loadEverything();
		const baseColors = new Map(desktopVocabulary.entries.map(entry => [entry.name, entry.lightColor()]));

		for (const name of ["day-custom-base.tdesktop-theme", "night-custom-base.tdesktop-theme"]) {
			const bytes = await readFixture(name);
			const zipEntries = await ArchiveReader.read(bytes);
			const entry = ArchiveReader.find(zipEntries, ["colors.tdesktop-theme"]);
			const [, paletteBytes] = ReferenceError.suppress(entry, `No palette entry in '${name}'`);
			const paletteColors = PaletteReader.read(new TextDecoder("utf-8").decode(paletteBytes), baseColors);
			const source = new DesktopTheme(paletteColors, null);

			const { theme: android } = converter.desktopToAndroid(source);
			const { theme: roundTripped } = converter.androidToDesktop(android);

			for (const vocabularyEntry of desktopVocabulary.entries) {
				const original = ReferenceError.suppress(source.colors.get(vocabularyEntry.name), `Missing '${vocabularyEntry.name}'`);
				const roundTrippedColor = ReferenceError.suppress(roundTripped.colors.get(vocabularyEntry.name), `Missing '${vocabularyEntry.name}'`);
				expect(colorsEqual(roundTrippedColor, original)).toBe(true);
			}
		}
	});

	it("Android -> Desktop -> Android is the identity on the 586 core keys; surplus keys are reported as anchored", async () => {
		const { androidVocabulary, ruleTable, converter } = await loadEverything();
		const coreSources = new Set(ruleTable.directRules().map(rule => rule.source));

		for (const name of ["day.attheme", "night.attheme"]) {
			const bytes = await readFixture(name);
			const { colors } = AtthemeReader.read(bytes);
			const complete = new Map(androidVocabulary.entries.map(entry => [entry.name, entry.lightColor()]));
			for (const [key, color] of colors) if (androidVocabulary.has(key)) complete.set(key, color);
			const source = new AndroidTheme(complete, null);

			const { theme: desktop, report: firstReport } = converter.androidToDesktop(source);
			expect(firstReport.countBy(KeyOutcome.direct)).toBe(586);

			const { theme: roundTripped, report: secondReport } = converter.desktopToAndroid(desktop);

			for (const key of coreSources) {
				const roundTrippedColor = ReferenceError.suppress(roundTripped.colors.get(key), `Missing '${key}'`);
				const originalColor = ReferenceError.suppress(complete.get(key), `Missing '${key}'`);
				expect(colorsEqual(roundTrippedColor, originalColor)).toBe(true);
			}

			const expectedAnchored = androidVocabulary.entries.map(entry => entry.name).filter(n => !coreSources.has(n)).sort();
			expect(secondReport.keysBy(KeyOutcome.anchored)).toEqual(expectedAnchored);
		}
	});
});
