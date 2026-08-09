"use strict";

import "adaptive-extender/node";
import { Color, ColorFormats } from "adaptive-extender/node";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AtthemeReader } from "../../telegram-theme-converter/services/attheme-reader.js";
import { PaletteReader } from "../../telegram-theme-converter/services/palette-reader.js";
import { ArchiveReader } from "../../telegram-theme-converter/services/archive-reader.js";
import { Argb } from "../../telegram-theme-converter/services/argb.js";

//#region One-shot vocabulary extractor
/**
 * Rebuilds `resources/data/telegram-android-vocabulary.json` and
 * `telegram-desktop-vocabulary.json` from the official Telegram sources. This is a
 * mechanical extraction, not a mapping generator: it produces each platform's own canonical
 * key set and its own light/dark defaults, nothing more. Run via `npm run extract:vocabulary`
 * and re-run (after bumping the pinned commits below) whenever Telegram adds keys.
 */

// Pinned commits - immutable snapshots, bump and re-run when Telegram adds keys.
const commitAndroid = "45ab8f4308496e1f01026a97fcdb0d58a5274474"; // DrKLO/Telegram
const commitDesktop = "8e18cb71103d83d7d98994ff27f0a2bca55c489c"; // telegramdesktop/tdesktop
const commitLibUi = "9c2fb5e7cb7f0c9150340dec8204ce5ca687a65a"; // desktop-app/lib_ui

const urlThemeColors = `https://raw.githubusercontent.com/DrKLO/Telegram/${commitAndroid}/TMessagesProj/src/main/java/org/telegram/ui/ActionBar/ThemeColors.java`;
const urlNightAttheme = `https://raw.githubusercontent.com/DrKLO/Telegram/${commitAndroid}/TMessagesProj/src/main/assets/night.attheme`;
const urlColorsPalette = `https://raw.githubusercontent.com/desktop-app/lib_ui/${commitLibUi}/ui/colors.palette`;
const urlNightCustomBase = `https://raw.githubusercontent.com/telegramdesktop/tdesktop/${commitDesktop}/Telegram/Resources/night-custom-base.tdesktop-theme`;

const nameWallpaperOffset = "wallpaperFileOffset";

interface VocabularyEntryData {
	name: string;
	light: string;
	dark: string;
}

async function fetchText(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${response.status}: ${response.statusText} for ${url}`);
	return response.text();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${response.status}: ${response.statusText} for ${url}`);
	return new Uint8Array(await response.arrayBuffer());
}

function toHex(color: Readonly<Color>): string {
	return color.toString({ format: ColorFormats.hex, deep: true });
}

//#region Android
// `Color.WHITE` is Android's own `android.graphics.Color` constant - not declared in
// ThemeColors.java, so it cannot be extracted; its value is public API and stable.
const androidPlatformConstants: ReadonlyMap<string, number> = new Map([
	["Color.WHITE", 0xffffffff | 0],
]);

function resolveAndroidExpression(expression: string, javaConstants: ReadonlyMap<string, number>): number {
	const trimmed = expression.trim();
	if (/^0[xX][0-9a-fA-F]+$/.test(trimmed)) return Number.parseInt(trimmed, 16) | 0;
	if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10) | 0;

	const setAlphaMatch = /^ColorUtils\.setAlphaComponent\(([^,]+),\s*(-?\d+)\s*\)$/.exec(trimmed);
	if (setAlphaMatch !== null) {
		const [, baseExpression, alphaExpression] = setAlphaMatch;
		const base = resolveAndroidExpression(baseExpression!, javaConstants);
		const alpha = Number.parseInt(alphaExpression!, 10) & 0xff;
		return ((alpha << 24) | (base & 0x00ffffff)) | 0;
	}

	const javaConstant = javaConstants.get(trimmed);
	if (javaConstant !== undefined) return javaConstant;

	const platformConstant = androidPlatformConstants.get(trimmed);
	if (platformConstant !== undefined) return platformConstant;

	throw new SyntaxError(`Unable to resolve Android color expression '${trimmed}'`);
}

function parseAndroidLightDefaults(javaSource: string): Map<string, Color> {
	const javaConstants = new Map<string, number>();
	for (const match of javaSource.matchAll(/public static final int (\w+) = (0[xX][0-9a-fA-F]+);/g)) {
		const [, name, hex] = match;
		javaConstants.set(name!, Number.parseInt(hex!, 16) | 0);
	}

	const defaults = new Map<string, Color>();
	for (const match of javaSource.matchAll(/defaultColors\[key_(\w+)\]\s*=\s*([^;]+);/g)) {
		const [, name, expression] = match;
		if (name === nameWallpaperOffset) continue; // a byte offset, not a color - excluded from the vocabulary
		const value = resolveAndroidExpression(expression!, javaConstants);
		if (defaults.has(name!)) throw new TypeError(`Duplicate Android default for '${name}'`);
		defaults.set(name!, Argb.toColor(value));
	}
	return defaults;
}

async function buildAndroidVocabulary(): Promise<VocabularyEntryData[]> {
	const [javaSource, nightAtthemeText] = await Promise.all([fetchText(urlThemeColors), fetchText(urlNightAttheme)]);
	const light = parseAndroidLightDefaults(javaSource);

	const nightAtthemeBytes = new TextEncoder().encode(nightAtthemeText);
	const { colors: darkOverrides } = AtthemeReader.read(nightAtthemeBytes);
	// Theme.java aliases a handful of legacy key names onto a current key's storage slot
	// without its own `defaultColors[...]` assignment (e.g. `chat_inAudioPerfomerText`).
	// Such an alias overriding itself in night.attheme carries no information beyond what
	// its canonical name already carries elsewhere in the same file, so it is skipped here.
	let skippedLegacyAliases = 0;
	for (const name of darkOverrides.keys()) {
		if (!light.has(name)) skippedLegacyAliases++;
	}
	if (skippedLegacyAliases > 0) console.log(`night.attheme: skipped ${skippedLegacyAliases} legacy alias key(s) absent from ThemeColors.java's defaults`);

	const entries: VocabularyEntryData[] = [];
	for (const [name, lightColor] of light) {
		let darkColor = lightColor;
		const override = darkOverrides.get(name);
		if (override !== undefined) darkColor = override;
		entries.push({ name, light: toHex(lightColor), dark: toHex(darkColor) });
	}
	return entries;
}
//#endregion

//#region Desktop
async function buildDesktopVocabulary(): Promise<VocabularyEntryData[]> {
	const [paletteText, nightCustomBaseZip] = await Promise.all([fetchText(urlColorsPalette), fetchBytes(urlNightCustomBase)]);
	const light = PaletteReader.read(paletteText);

	const zipEntries = await ArchiveReader.read(nightCustomBaseZip);
	const paletteEntry = ArchiveReader.find(zipEntries, ["colors.tdesktop-theme", "colors.tdesktop-palette"]);
	if (paletteEntry === null) throw new ReferenceError("night-custom-base.tdesktop-theme has no palette entry");
	const [, paletteBytes] = paletteEntry;
	const dark = PaletteReader.read(new TextDecoder("utf-8").decode(paletteBytes), light);

	const entries: VocabularyEntryData[] = [];
	for (const [name, lightColor] of light) {
		const darkColor = dark.get(name);
		if (darkColor === undefined) throw new ReferenceError(`Desktop dark palette unexpectedly missing '${name}'`);
		entries.push({ name, light: toHex(lightColor), dark: toHex(darkColor) });
	}
	return entries;
}
//#endregion

async function writeVocabulary(entries: readonly VocabularyEntryData[], relativePath: string): Promise<void> {
	const url = new URL(`../../${relativePath}`, import.meta.url);
	const json = `${JSON.stringify({ entries }, null, "\t")}\n`;
	await writeFile(fileURLToPath(url), json, "utf-8");
}

async function main(): Promise<void> {
	const [androidEntries, desktopEntries] = await Promise.all([buildAndroidVocabulary(), buildDesktopVocabulary()]);

	console.log(`Android vocabulary: ${androidEntries.length} keys`);
	console.log(`Desktop vocabulary: ${desktopEntries.length} keys`);

	await writeVocabulary(androidEntries, "resources/data/telegram-android-vocabulary.json");
	await writeVocabulary(desktopEntries, "resources/data/telegram-desktop-vocabulary.json");
}

await main();
//#endregion
