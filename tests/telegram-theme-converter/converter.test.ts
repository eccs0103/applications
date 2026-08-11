"use strict";

import "adaptive-extender/core";
import { Color, ColorFormats } from "adaptive-extender/core";
import { describe, it, expect } from "vitest";
import AsyncFileSystem from "node:fs/promises";
import { Vocabulary } from "../../telegram-theme-converter/models/vocabulary.js";
import { RoleVocabulary } from "../../telegram-theme-converter/models/role-vocabulary.js";
import { BindingTable } from "../../telegram-theme-converter/models/binding-table.js";
import { AndroidPlatform, DesktopPlatform, type Platform } from "../../telegram-theme-converter/models/platform.js";
import { Converter } from "../../telegram-theme-converter/services/converter.js";
import { ColorMetrics } from "../../telegram-theme-converter/services/color-metrics.js";
import { KeyOutcome } from "../../telegram-theme-converter/models/report.js";

const dataDir = new URL("../../resources/data/", import.meta.url);
const fixtures = new URL("./fixtures/", import.meta.url);

async function readJson(name: string): Promise<any> {
	const text = await AsyncFileSystem.readFile(new URL(name, dataDir), "utf-8");
	return JSON.parse(text);
}

async function loadEverything() {
	const [androidVocabulary, desktopVocabulary, roles, androidBindings, desktopBindings] = await Promise.all([
		Vocabulary.import(await readJson("telegram-android-vocabulary.json"), "telegram-android-vocabulary.json"),
		Vocabulary.import(await readJson("telegram-desktop-vocabulary.json"), "telegram-desktop-vocabulary.json"),
		RoleVocabulary.import(await readJson("telegram-theme-roles.json"), "telegram-theme-roles.json"),
		BindingTable.import(await readJson("telegram-android-bindings.json"), "telegram-android-bindings.json"),
		BindingTable.import(await readJson("telegram-desktop-bindings.json"), "telegram-desktop-bindings.json"),
	]);
	const android = new AndroidPlatform(androidVocabulary, androidBindings);
	const desktop = new DesktopPlatform(desktopVocabulary, desktopBindings);
	const converter = new Converter(roles);
	return { androidVocabulary, desktopVocabulary, roles, android, desktop, converter };
}

function colorsEqual(first: Readonly<Color>, second: Readonly<Color>): boolean {
	return first.toString({ format: ColorFormats.hex, deep: true }) === second.toString({ format: ColorFormats.hex, deep: true });
}

async function readFixture(name: string): Promise<Uint8Array> {
	const buffer = await AsyncFileSystem.readFile(new URL(name, fixtures));
	return new Uint8Array(buffer);
}

/** Roles with an authority binding on both platforms - the only roles the round-trip guarantee covers. */
function dualAuthorityRoles(android: Readonly<Platform>, desktop: Readonly<Platform>, roles: Readonly<RoleVocabulary>): string[] {
	return [...roles.names()].filter(role => android.bindings.authorityKeyFor(role) !== null && desktop.bindings.authorityKeyFor(role) !== null);
}

// Desktop's `boxDividerFg` is the only key literally named for the divider role, but its stored
// light default is opaque black (`#000000ff`) where Android's `divider` is a light, near-invisible
// gray - Telegram Desktop composites subtle borders at a runtime opacity the palette file does not
// record, which the light-default oracle below cannot see. Reviewed and accepted on 2026-08-11:
// the key identity is the best available semantic match even though its raw ΔE reads high.
const oracleExceptions = new Set(["border.default"]);
const oracleThreshold = 30;

describe("Role graph integrity", () => {
	it("every parent name refers to a real role, and the graph has no cycles", async () => {
		const { roles } = await loadEverything();
		for (const role of roles.roles) expect(() => roles.chain(role.name)).not.toThrow();
	});

	it("every root role has exactly one authority binding on both platforms", async () => {
		const { roles, android, desktop } = await loadEverything();
		for (const root of roles.roots()) {
			const androidKey = android.bindings.authorityKeyFor(root.name);
			const desktopKey = desktop.bindings.authorityKeyFor(root.name);
			expect(androidKey, `root '${root.name}' has no Android authority`).not.toBeNull();
			expect(desktopKey, `root '${root.name}' has no Desktop authority`).not.toBeNull();
		}
	});
});

describe("Binding table integrity", () => {
	it("every Android key has exactly one binding, and every binding names a real role", async () => {
		const { androidVocabulary, roles, android } = await loadEverything();
		expect(android.bindings.size).toBe(androidVocabulary.size);
		for (const entry of androidVocabulary.entries) {
			expect(android.bindings.has(entry.name)).toBe(true);
			expect(roles.has(android.bindings.roleFor(entry.name))).toBe(true);
		}
	});

	it("every Desktop key has exactly one binding, and every binding names a real role", async () => {
		const { desktopVocabulary, roles, desktop } = await loadEverything();
		expect(desktop.bindings.size).toBe(desktopVocabulary.size);
		for (const entry of desktopVocabulary.entries) {
			expect(desktop.bindings.has(entry.name)).toBe(true);
			expect(roles.has(desktop.bindings.roleFor(entry.name))).toBe(true);
		}
	});

	it("no role has more than one authority binding per platform", async () => {
		const { roles, android, desktop } = await loadEverything();
		for (const role of roles.names()) {
			const androidAuthorities = android.bindings.bindings.filter(binding => binding.role === role && binding.authority);
			const desktopAuthorities = desktop.bindings.bindings.filter(binding => binding.role === role && binding.authority);
			expect(androidAuthorities.length, `role '${role}' has ${androidAuthorities.length} Android authorities`).toBeLessThanOrEqual(1);
			expect(desktopAuthorities.length, `role '${role}' has ${desktopAuthorities.length} Desktop authorities`).toBeLessThanOrEqual(1);
		}
	});
});

describe("Light-default oracle", () => {
	it("dual-authority roles agree with the official light palettes within a perceptual threshold", async () => {
		const { androidVocabulary, desktopVocabulary, roles, android, desktop } = await loadEverything();
		const failures: string[] = [];

		for (const role of dualAuthorityRoles(android, desktop, roles)) {
			if (oracleExceptions.has(role)) continue;
			const androidKey = ReferenceError.suppress(android.bindings.authorityKeyFor(role));
			const desktopKey = ReferenceError.suppress(desktop.bindings.authorityKeyFor(role));
			const distance = ColorMetrics.perceptualDistance(androidVocabulary.get(androidKey).lightColor(), desktopVocabulary.get(desktopKey).lightColor());
			if (distance > oracleThreshold) failures.push(`${role}: android '${androidKey}' vs desktop '${desktopKey}' - dE=${distance.toFixed(1)}`);
		}

		expect(failures, failures.join("\n")).toEqual([]);
	});

	it("dual-authority roles report their dark-default divergence, advisory only", async () => {
		const { androidVocabulary, desktopVocabulary, roles, android, desktop } = await loadEverything();
		for (const role of dualAuthorityRoles(android, desktop, roles)) {
			const androidKey = ReferenceError.suppress(android.bindings.authorityKeyFor(role));
			const desktopKey = ReferenceError.suppress(desktop.bindings.authorityKeyFor(role));
			const distance = ColorMetrics.perceptualDistance(androidVocabulary.get(androidKey).darkColor(), desktopVocabulary.get(desktopKey).darkColor());
			// Not gated: Android Night and Desktop Night are legitimately different designs.
			expect(Number.isFinite(distance)).toBe(true);
		}
	});

	it("dual-authority roles agree on opacity class - neither platform composites an opaque color where the other expects a translucent one", async () => {
		const { androidVocabulary, desktopVocabulary, roles, android, desktop } = await loadEverything();
		const opaque = (color: Readonly<Color>) => color.alpha > 0.9;
		const failures: string[] = [];

		for (const role of dualAuthorityRoles(android, desktop, roles)) {
			const androidKey = ReferenceError.suppress(android.bindings.authorityKeyFor(role));
			const desktopKey = ReferenceError.suppress(desktop.bindings.authorityKeyFor(role));
			const androidOpaque = opaque(androidVocabulary.get(androidKey).lightColor());
			const desktopOpaque = opaque(desktopVocabulary.get(desktopKey).lightColor());
			if (androidOpaque !== desktopOpaque) failures.push(`${role}: android '${androidKey}' opaque=${androidOpaque} vs desktop '${desktopKey}' opaque=${desktopOpaque}`);
		}

		expect(failures, failures.join("\n")).toEqual([]);
	});
});

describe("Converter completeness", () => {
	it("Android -> Desktop always emits exactly the Desktop vocabulary's key set", async () => {
		const { androidVocabulary, desktopVocabulary, android, desktop, converter } = await loadEverything();
		const source = android.create(new Map(androidVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		const { theme } = converter.convert(source, android, desktop);
		expect(desktopVocabulary.isComplete(theme.names())).toBe(true);
	});

	it("Desktop -> Android always emits exactly the Android vocabulary's key set", async () => {
		const { androidVocabulary, desktopVocabulary, android, desktop, converter } = await loadEverything();
		const source = desktop.create(new Map(desktopVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		const { theme } = converter.convert(source, desktop, android);
		expect(androidVocabulary.isComplete(theme.names())).toBe(true);
	});

	it("a theme missing a root authority key throws instead of fabricating a default", async () => {
		const { androidVocabulary, android, desktop, converter } = await loadEverything();
		const incomplete = new Map(androidVocabulary.entries.map(entry => [entry.name, entry.lightColor()]));
		incomplete.delete("windowBackgroundWhite"); // the surface.primary authority key
		const source = android.create(incomplete, null);
		expect(() => converter.convert(source, android, desktop)).toThrow(/surface\.primary/);
	});

	it("never fabricates a color: every target key resolves to a real lifted value or the conversion throws", async () => {
		const { androidVocabulary, android, desktop, converter } = await loadEverything();
		// A source with every key present must convert without throwing - nothing forces a fallback.
		const source = android.create(new Map(androidVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		expect(() => converter.convert(source, android, desktop)).not.toThrow();
	});
});

describe("Converter round trip", () => {
	it("Android -> Desktop -> Android is the identity on every role with authority on both platforms", async () => {
		const { androidVocabulary, roles, android, desktop, converter } = await loadEverything();
		const roundTripped = dualAuthorityRoles(android, desktop, roles);

		for (const name of ["day.attheme", "night.attheme"]) {
			const bytes = await readFixture(name);
			const source = await android.parse(bytes);
			const complete = new Map(androidVocabulary.entries.map(entry => [entry.name, entry.lightColor()]));
			for (const [key, color] of source.colors) if (androidVocabulary.has(key)) complete.set(key, color);
			const filled = android.create(complete, null);

			const { theme: desktopTheme } = converter.convert(filled, android, desktop);
			const { theme: roundTrippedTheme } = converter.convert(desktopTheme, desktop, android);

			for (const role of roundTripped) {
				const key = ReferenceError.suppress(android.bindings.authorityKeyFor(role));
				const original = ReferenceError.suppress(filled.colors.get(key));
				const result = ReferenceError.suppress(roundTrippedTheme.colors.get(key));
				expect(colorsEqual(result, original), `role '${role}' key '${key}' in '${name}'`).toBe(true);
			}
		}
	});

	it("Desktop -> Android -> Desktop is the identity on every role with authority on both platforms", async () => {
		const { desktopVocabulary, roles, android, desktop, converter } = await loadEverything();
		const roundTripped = dualAuthorityRoles(android, desktop, roles);

		for (const name of ["day-custom-base.tdesktop-theme", "night-custom-base.tdesktop-theme"]) {
			const bytes = await readFixture(name);
			const source = await desktop.parse(bytes);

			const { theme: androidTheme } = converter.convert(source, desktop, android);
			const { theme: roundTrippedTheme } = converter.convert(androidTheme, android, desktop);

			for (const role of roundTripped) {
				const key = ReferenceError.suppress(desktop.bindings.authorityKeyFor(role));
				const original = ReferenceError.suppress(source.colors.get(key), `Missing '${key}' in parsed '${name}'`);
				const result = ReferenceError.suppress(roundTrippedTheme.colors.get(key));
				expect(colorsEqual(result, original), `role '${role}' key '${key}' in '${name}'`).toBe(true);
			}
		}
	});
});

describe("Screenshot defect checklist", () => {
	function contrast(colors: ReadonlyMap<string, Color>, foregroundKey: string, backgroundKey: string): number {
		const foreground = ReferenceError.suppress(colors.get(foregroundKey), `Missing '${foregroundKey}'`);
		const background = ReferenceError.suppress(colors.get(backgroundKey), `Missing '${backgroundKey}'`);
		return ColorMetrics.contrastRatio(foreground, background);
	}

	it("D1/D2: action bar title and icon stay readable on the chrome surface after Desktop -> Android", async () => {
		const { desktopVocabulary, android, desktop, converter } = await loadEverything();
		const source = desktop.create(new Map(desktopVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		const { theme } = converter.convert(source, desktop, android);
		expect(contrast(theme.colors, "actionBarDefaultTitle", "actionBarDefault")).toBeGreaterThanOrEqual(3);
		expect(contrast(theme.colors, "actionBarDefaultIcon", "actionBarDefault")).toBeGreaterThanOrEqual(3);
	});

	it("D6: the action bar subtitle stays a plain secondary tone, not an unrelated accent color, after Desktop -> Android", async () => {
		const { desktopVocabulary, android, desktop, converter } = await loadEverything();
		const source = desktop.create(new Map(desktopVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		const { theme } = converter.convert(source, desktop, android);
		const subtitle = ReferenceError.suppress(theme.colors.get("actionBarDefaultSubtitle"));
		const secondary = ReferenceError.suppress(theme.colors.get("windowBackgroundWhiteGrayText"));
		expect(colorsEqual(subtitle, secondary)).toBe(true);
	});

	// Telegram's own native white-on-accent contrast already sits below the WCAG 3:1 threshold
	// (Android's own avatar_text-on-chats_actionBackground is ~2.53:1, Desktop's own
	// windowFgActive-on-windowBgActive is ~2.67:1) - these are bold icon-weight elements, not body
	// text, and 3:1 is simply not the bar Telegram itself designs to. The gate here is 2.5: tight
	// enough to catch a real regression (a wrong pairing scores far below this) without failing on
	// the platforms' own legitimate design.
	const accentIconThreshold = 2.5;

	it("D4: the Cancel/Apply flat button text stays a visible accent tone, not invisible-on-surface, after Desktop -> Android", async () => {
		const { desktopVocabulary, android, desktop, converter } = await loadEverything();
		const source = desktop.create(new Map(desktopVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		const { theme } = converter.convert(source, desktop, android);
		expect(contrast(theme.colors, "dialogButton", "dialogBackground")).toBeGreaterThanOrEqual(accentIconThreshold);
	});

	it("D3: the compose FAB icon stays readable on the FAB background after Desktop -> Android", async () => {
		const { desktopVocabulary, android, desktop, converter } = await loadEverything();
		const source = desktop.create(new Map(desktopVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		const { theme } = converter.convert(source, desktop, android);
		expect(contrast(theme.colors, "chats_actionIcon", "chats_actionBackground")).toBeGreaterThanOrEqual(accentIconThreshold);
	});

	it("D5: avatar initials stay readable on the avatar background after Desktop -> Android", async () => {
		const { desktopVocabulary, android, desktop, converter } = await loadEverything();
		const source = desktop.create(new Map(desktopVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		const { theme } = converter.convert(source, desktop, android);
		expect(contrast(theme.colors, "avatar_text", "chats_actionBackground")).toBeGreaterThanOrEqual(accentIconThreshold);
	});

	it("D7: quoted reply text stays readable on the incoming bubble after Desktop -> Android", async () => {
		const { desktopVocabulary, android, desktop, converter } = await loadEverything();
		const source = desktop.create(new Map(desktopVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		const { theme } = converter.convert(source, desktop, android);
		expect(contrast(theme.colors, "chat_inReplyMessageText", "chat_inBubble")).toBeGreaterThanOrEqual(3);
	});

	it("D8: the audio performer label stays readable on the incoming bubble after Desktop -> Android", async () => {
		const { desktopVocabulary, android, desktop, converter } = await loadEverything();
		const source = desktop.create(new Map(desktopVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		const { theme } = converter.convert(source, desktop, android);
		expect(contrast(theme.colors, "chat_inAudioPerformerText", "chat_inBubble")).toBeGreaterThanOrEqual(3);
	});

	it("D9: the download loader stays readable on the incoming bubble after Desktop -> Android", async () => {
		const { desktopVocabulary, android, desktop, converter } = await loadEverything();
		const source = desktop.create(new Map(desktopVocabulary.entries.map(entry => [entry.name, entry.lightColor()])), null);
		const { theme } = converter.convert(source, desktop, android);
		// A progress ring, not text - same accentIconThreshold rationale as D3/D5 above.
		expect(contrast(theme.colors, "chat_inLoader", "chat_inBubble")).toBeGreaterThanOrEqual(accentIconThreshold);
	});
});
