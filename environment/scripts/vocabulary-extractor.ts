"use strict";

import "adaptive-extender/node";
import { Color, ColorFormats } from "adaptive-extender/node";
import AsyncFileSystem from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AtthemeReader } from "../../telegram-theme-converter/services/attheme-reader.js";
import { PaletteReader } from "../../telegram-theme-converter/services/palette-reader.js";
import { ArchiveReader } from "../../telegram-theme-converter/services/archive-reader.js";
import { Argb } from "../../telegram-theme-converter/services/argb.js";

interface VocabularyEntryData {
	name: string;
	light: string;
	dark: string;
}

//#region HTTP fetcher
class HttpFetcher {
	static async text(url: string): Promise<string> {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`${response.status}: ${response.statusText} for ${url}`);
		return response.text();
	}

	static async bytes(url: string): Promise<Uint8Array> {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`${response.status}: ${response.statusText} for ${url}`);
		return new Uint8Array(await response.arrayBuffer());
	}
}
//#endregion

//#region Color hex formatter
class ColorHexFormatter {
	static format(color: Readonly<Color>): string {
		return color.toString({ format: ColorFormats.hex, deep: true });
	}
}
//#endregion

//#region Android source
class AndroidSource {
	static #commit: string = "45ab8f4308496e1f01026a97fcdb0d58a5274474";
	static #urlThemeColors: string = `https://raw.githubusercontent.com/DrKLO/Telegram/${AndroidSource.#commit}/TMessagesProj/src/main/java/org/telegram/ui/ActionBar/ThemeColors.java`;
	static #urlNightAttheme: string = `https://raw.githubusercontent.com/DrKLO/Telegram/${AndroidSource.#commit}/TMessagesProj/src/main/assets/night.attheme`;
	static #nameWallpaperOffset: string = "wallpaperFileOffset";
	static #platformConstants: ReadonlyMap<string, number> = new Map([
		["Color.WHITE", 0xffffffff | 0],
	]);

	static #resolveExpression(expression: string, javaConstants: ReadonlyMap<string, number>): number {
		const trimmed = expression.trim();
		if (/^0[xX][0-9a-fA-F]+$/.test(trimmed)) return Number.parseInt(trimmed, 16) | 0;
		if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10) | 0;

		const setAlphaMatch = /^ColorUtils\.setAlphaComponent\(([^,]+),\s*(-?\d+)\s*\)$/.exec(trimmed);
		if (setAlphaMatch !== null) {
			const [, baseExpression, alphaExpression] = setAlphaMatch;
			const base = AndroidSource.#resolveExpression(baseExpression, javaConstants);
			const alpha = Number.parseInt(alphaExpression, 10) & 0xff;
			return ((alpha << 24) | (base & 0x00ffffff)) | 0;
		}

		const javaConstant = javaConstants.get(trimmed);
		if (javaConstant !== undefined) return javaConstant;

		const platformConstant = AndroidSource.#platformConstants.get(trimmed);
		if (platformConstant !== undefined) return platformConstant;

		throw new SyntaxError(`Unable to resolve Android color expression '${trimmed}'`);
	}

	static #parseLightDefaults(javaSource: string): Map<string, Color> {
		const javaConstants = new Map<string, number>();
		for (const match of javaSource.matchAll(/public static final int (\w+) = (0[xX][0-9a-fA-F]+);/g)) {
			const [, name, hex] = match;
			javaConstants.set(name, Number.parseInt(hex, 16) | 0);
		}

		const defaults = new Map<string, Color>();
		for (const match of javaSource.matchAll(/defaultColors\[key_(\w+)\]\s*=\s*([^;]+);/g)) {
			const [, name, expression] = match;
			if (name === AndroidSource.#nameWallpaperOffset) continue;
			const value = AndroidSource.#resolveExpression(expression, javaConstants);
			if (defaults.has(name)) throw new TypeError(`Duplicate Android default for '${name}'`);
			defaults.set(name, Argb.toColor(value));
		}
		return defaults;
	}

	static async build(): Promise<VocabularyEntryData[]> {
		const [javaSource, nightAtthemeText] = await Promise.all([HttpFetcher.text(AndroidSource.#urlThemeColors), HttpFetcher.text(AndroidSource.#urlNightAttheme)]);
		const light = AndroidSource.#parseLightDefaults(javaSource);

		const nightAtthemeBytes = new TextEncoder().encode(nightAtthemeText);
		const { colors: darkOverrides } = AtthemeReader.read(nightAtthemeBytes);
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
			entries.push({ name, light: ColorHexFormatter.format(lightColor), dark: ColorHexFormatter.format(darkColor) });
		}
		return entries;
	}
}
//#endregion

//#region Desktop source
class DesktopSource {
	static #commit: string = "8e18cb71103d83d7d98994ff27f0a2bca55c489c";
	static #commitLibUi: string = "9c2fb5e7cb7f0c9150340dec8204ce5ca687a65a";
	static #urlColorsPalette: string = `https://raw.githubusercontent.com/desktop-app/lib_ui/${DesktopSource.#commitLibUi}/ui/colors.palette`;
	static #urlNightCustomBase: string = `https://raw.githubusercontent.com/telegramdesktop/tdesktop/${DesktopSource.#commit}/Telegram/Resources/night-custom-base.tdesktop-theme`;

	static async build(): Promise<VocabularyEntryData[]> {
		const [paletteText, nightCustomBaseZip] = await Promise.all([HttpFetcher.text(DesktopSource.#urlColorsPalette), HttpFetcher.bytes(DesktopSource.#urlNightCustomBase)]);
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
			entries.push({ name, light: ColorHexFormatter.format(lightColor), dark: ColorHexFormatter.format(darkColor) });
		}
		return entries;
	}
}
//#endregion

//#region Vocabulary writer
class VocabularyWriter {
	static async write(entries: readonly VocabularyEntryData[], relativePath: string): Promise<void> {
		const url = new URL(`../../${relativePath}`, import.meta.url);
		const json = `${JSON.stringify({ entries }, null, "\t")}\n`;
		await AsyncFileSystem.writeFile(fileURLToPath(url), json, "utf-8");
	}
}
//#endregion

//#region Vocabulary extractor
class VocabularyExtractor {
	static #pathAndroidVocabulary: string = "resources/data/telegram-android-vocabulary.json";
	static #pathDesktopVocabulary: string = "resources/data/telegram-desktop-vocabulary.json";

	static async run(): Promise<void> {
		const [androidEntries, desktopEntries] = await Promise.all([AndroidSource.build(), DesktopSource.build()]);

		console.log(`Android vocabulary: ${androidEntries.length} keys`);
		console.log(`Desktop vocabulary: ${desktopEntries.length} keys`);

		await VocabularyWriter.write(androidEntries, VocabularyExtractor.#pathAndroidVocabulary);
		await VocabularyWriter.write(desktopEntries, VocabularyExtractor.#pathDesktopVocabulary);
	}
}
//#endregion

await VocabularyExtractor.run();
