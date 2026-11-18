"use strict";

import "adaptive-extender/node";
import { ColorFormats, type Color } from "adaptive-extender/node";
import { describe, it, expect } from "vitest";
import { type Vocabulary } from "../../telegram-theme-converter/models/vocabulary.js";
import { type RuleTable } from "../../telegram-theme-converter/models/rule-table.js";
import { Transform } from "../../telegram-theme-converter/models/rule.js";
import { Converter } from "../../telegram-theme-converter/services/converter.js";
import { AndroidTheme } from "../../telegram-theme-converter/models/android-theme.js";
import { DesktopTheme } from "../../telegram-theme-converter/models/desktop-theme.js";
import { KeyOutcome } from "../../telegram-theme-converter/models/report.js";
import { ArchiveReader } from "../../telegram-theme-converter/services/archive-reader.js";
import { PaletteReader } from "../../telegram-theme-converter/services/palette-reader.js";
import { AtthemeReader } from "../../telegram-theme-converter/services/attheme-reader.js";
import { TestData } from "./test-data.js";

const { abs } = Math;

//#region Fixture
class Fixture {
	#android: Vocabulary;
	#desktop: Vocabulary;
	#table: RuleTable;
	#converter: Converter;

	constructor(android: Vocabulary, desktop: Vocabulary, table: RuleTable) {
		this.#android = android;
		this.#desktop = desktop;
		this.#table = table;
		this.#converter = new Converter(android, desktop, table);
	}

	static async load(): Promise<Fixture> {
		const [android, desktop, table] = await Promise.all([
			TestData.vocabulary("telegram-android-vocabulary.json"),
			TestData.vocabulary("telegram-desktop-vocabulary.json"),
			TestData.rules(),
		]);
		return new Fixture(android, desktop, table);
	}

	get android(): Vocabulary { return this.#android; }
	get desktop(): Vocabulary { return this.#desktop; }
	get table(): RuleTable { return this.#table; }
	get converter(): Converter { return this.#converter; }
}
//#endregion

function sameColor(color: Readonly<Color>, color2: Readonly<Color>): boolean {
	return color.toString({ format: ColorFormats.hex, deep: true }) === color2.toString({ format: ColorFormats.hex, deep: true });
}

describe("RuleTable integrity", () => {
	it("has exactly 759 rules: 586 direct + 173 anchored", async () => {
		const { table } = await Fixture.load();
		expect(table.rules.length).toBe(759);
		expect(table.direct().length).toBe(586);
		expect(table.anchored().length).toBe(173);
	});

	it("the direct rules form an injective bijection onto the full Desktop vocabulary", async () => {
		const { desktop, table } = await Fixture.load();
		const targets = new Set(table.direct().map(rule => rule.target));
		const sources = new Set(table.direct().map(rule => rule.source));
		expect(targets.size).toBe(586);
		expect(sources.size).toBe(586);
		expect(desktop.isComplete(targets)).toBe(true);
	});

	it("every rule's target and referenced sources are real vocabulary keys", async () => {
		const { android, desktop, table } = await Fixture.load();
		for (const rule of table.direct()) {
			expect(desktop.has(rule.target)).toBe(true);
			expect(android.has(rule.source)).toBe(true);
		}
		for (const rule of table.anchored()) {
			expect(android.has(rule.target)).toBe(true);
			expect(android.has(rule.source)).toBe(true);
			if (rule.mixWith !== null) expect(android.has(rule.mixWith)).toBe(true);
		}
	});

	it("every anchor points inside the bijective core - no chains, no cycles", async () => {
		const { table } = await Fixture.load();
		const core = new Set(table.direct().map(rule => rule.source));
		const anchored = new Set(table.anchored().map(rule => rule.target));
		for (const rule of table.anchored()) {
			expect(core.has(rule.source)).toBe(true);
			expect(anchored.has(rule.source)).toBe(false);
		}
	});

	it("the Android vocabulary is fully covered: every key is a core source or an anchored target, never both", async () => {
		const { android, table } = await Fixture.load();
		const core = new Set(table.direct().map(rule => rule.source));
		const anchored = new Set(table.anchored().map(rule => rule.target));
		for (const name of core) expect(anchored.has(name)).toBe(false);
		const covered = new Set([...core, ...anchored]);
		expect(android.isComplete(covered)).toBe(true);
	});

	it("every fitted alpha/lightness transform reproduces both the light and the dark official samples", async () => {
		const { android, table } = await Fixture.load();
		for (const rule of table.anchored()) {
			if (rule.transform !== Transform.alpha && rule.transform !== Transform.lightness) continue;
			const anchor = android.get(rule.source);
			const target = android.get(rule.target);
			const light = rule.resolve(new Map([[rule.source, anchor.lightColor()]]));
			const dark = rule.resolve(new Map([[rule.source, anchor.darkColor()]]));
			if (rule.transform === Transform.alpha) {
				expect(sameColor(light, target.lightColor())).toBe(true);
				expect(sameColor(dark, target.darkColor())).toBe(true);
				continue;
			}
			expect(abs(light.red - target.lightColor().red)).toBeLessThanOrEqual(6);
			expect(abs(dark.red - target.darkColor().red)).toBeLessThanOrEqual(6);
		}
	});
});

describe("Converter completeness", () => {
	it("Android -> Desktop always emits exactly the Desktop vocabulary's key set", async () => {
		const { desktop, converter } = await Fixture.load();
		const source = new AndroidTheme(new Map(), null);
		const { theme } = converter.androidToDesktop(source);
		expect(desktop.isComplete(theme.names())).toBe(true);
	});

	it("Desktop -> Android always emits exactly the Android vocabulary's key set", async () => {
		const { android, converter } = await Fixture.load();
		const source = new DesktopTheme(new Map(), null);
		const { theme } = converter.desktopToAndroid(source);
		expect(android.isComplete(theme.names())).toBe(true);
	});

	it("Android -> Desktop reports every Desktop key as direct and every non-core source key as dropped", async () => {
		const { android, table, converter } = await Fixture.load();
		const source = new AndroidTheme(android.lightColors(), null);
		const { report } = converter.androidToDesktop(source);
		expect(report.countBy(KeyOutcome.direct)).toBe(586);
		const core = new Set(table.direct().map(rule => rule.source));
		const dropped = android.entries.map(entry => entry.name).filter(name => !core.has(name));
		expect(report.keysBy(KeyOutcome.dropped)).toEqual(dropped.sort());
	});

	it("Desktop -> Android reports exactly 586 direct and 173 anchored keys", async () => {
		const { desktop, converter } = await Fixture.load();
		const source = new DesktopTheme(desktop.lightColors(), null);
		const { report } = converter.desktopToAndroid(source);
		expect(report.countBy(KeyOutcome.direct)).toBe(586);
		expect(report.countBy(KeyOutcome.anchored)).toBe(173);
	});
});

describe("Converter round trip", () => {
	it("Desktop -> Android -> Desktop is the identity across all 586 keys, using official sample palettes", async () => {
		const { desktop, converter } = await Fixture.load();
		const base = desktop.lightColors();

		for (const name of ["day-custom-base.tdesktop-theme", "night-custom-base.tdesktop-theme"]) {
			const bytes = await TestData.fixture(name);
			const archive = await ArchiveReader.read(bytes, TestData.codec);
			const entry = ArchiveReader.find(archive, ["colors.tdesktop-theme"]);
			const [, palette] = ReferenceError.suppress(entry, `No palette entry in '${name}'`);
			const colors = PaletteReader.read(new TextDecoder("utf-8").decode(palette), base);
			const source = new DesktopTheme(colors, null);

			const { theme: android } = converter.desktopToAndroid(source);
			const { theme: returned } = converter.androidToDesktop(android);

			for (const { name: key } of desktop.entries) {
				const original = ReferenceError.suppress(source.colors.get(key), `Missing '${key}'`);
				const color = ReferenceError.suppress(returned.colors.get(key), `Missing '${key}'`);
				expect(sameColor(color, original)).toBe(true);
			}
		}
	});

	it("Android -> Desktop -> Android is the identity on the 586 core keys; surplus keys are reported as anchored", async () => {
		const { android, table, converter } = await Fixture.load();
		const core = new Set(table.direct().map(rule => rule.source));

		for (const name of ["day.attheme", "night.attheme"]) {
			const bytes = await TestData.fixture(name);
			const { colors } = AtthemeReader.read(bytes, TestData.codec);
			const complete = android.lightColors();
			for (const [key, color] of colors) if (android.has(key)) complete.set(key, color);
			const source = new AndroidTheme(complete, null);

			const { theme: desktop, report } = converter.androidToDesktop(source);
			expect(report.countBy(KeyOutcome.direct)).toBe(586);

			const { theme: returned, report: report2 } = converter.desktopToAndroid(desktop);

			for (const key of core) {
				const color = ReferenceError.suppress(returned.colors.get(key), `Missing '${key}'`);
				const original = ReferenceError.suppress(complete.get(key), `Missing '${key}'`);
				expect(sameColor(color, original)).toBe(true);
			}

			const anchored = android.entries.map(entry => entry.name).filter(key => !core.has(key)).sort();
			expect(report2.keysBy(KeyOutcome.anchored)).toEqual(anchored);
		}
	});
});
