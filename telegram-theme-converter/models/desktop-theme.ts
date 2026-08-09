"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";
import { ThemeDocument } from "./theme-document.js";
import { ArchiveReader } from "../services/archive-reader.js";
import { ArchiveWriter, type ArchiveEntry } from "../services/archive-writer.js";
import { PaletteReader } from "../services/palette-reader.js";
import { PaletteWriter } from "../services/palette-writer.js";

//#region Desktop theme
export class DesktopTheme extends ThemeDocument {
	static #namesPalette: string[] = ["colors.tdesktop-palette", "colors.tdesktop-theme"];
	static #namesBackground: string[] = ["background.jpg", "background.png"];
	static #namesTiled: string[] = ["tiled.jpg", "tiled.png"];
	static #nameCanonicalPalette: string = "colors.tdesktop-theme";

	#tiled: boolean;

	constructor(colors: ReadonlyMap<string, Color>, wallpaper: Readonly<Uint8Array> | null, tiled: boolean = false) {
		super(colors, wallpaper);
		this.#tiled = tiled;
	}

	get tiled(): boolean { return this.#tiled; }

	static async parse(bytes: Readonly<Uint8Array>): Promise<DesktopTheme>;
	static async parse(bytes: Readonly<Uint8Array>, baseColors: ReadonlyMap<string, Color>): Promise<DesktopTheme>;
	static async parse(bytes: Readonly<Uint8Array>, baseColors: ReadonlyMap<string, Color> = new Map()): Promise<DesktopTheme> {
		const zipEntries = await ArchiveReader.read(bytes);

		const entryPalette = ArchiveReader.find(zipEntries, DesktopTheme.#namesPalette);
		if (entryPalette === null) throw new ReferenceError("No palette entry found in the desktop theme archive");
		const [, bytesPalette] = entryPalette;
		const colors = PaletteReader.read(new TextDecoder("utf-8").decode(bytesPalette), baseColors);

		const entryTiled = ArchiveReader.find(zipEntries, DesktopTheme.#namesTiled);
		let entryWallpaper = ArchiveReader.find(zipEntries, DesktopTheme.#namesBackground);
		if (entryWallpaper === null) entryWallpaper = entryTiled;
		let wallpaper: Uint8Array | null = null;
		if (entryWallpaper !== null) wallpaper = entryWallpaper[1];

		return new DesktopTheme(colors, wallpaper, entryTiled !== null);
	}

	async serialize(order: readonly string[]): Promise<Uint8Array> {
		const bytesPalette = PaletteWriter.write(this.colors, order);
		const entries: ArchiveEntry[] = [{ name: DesktopTheme.#nameCanonicalPalette, content: bytesPalette, stored: false }];

		const wallpaper = this.wallpaper;
		if (wallpaper !== null) {
			const extension = ThemeDocument.wallpaperExtension(wallpaper);
			let name = `background.${extension}`;
			if (this.#tiled) name = `tiled.${extension}`;
			entries.push({ name, content: wallpaper, stored: true });
		}

		return ArchiveWriter.write(entries);
	}
}
//#endregion
