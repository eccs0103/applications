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

	get tiled(): boolean {
		return this.#tiled;
	}

	static async parse(bytes: Readonly<Uint8Array>, baseColors: ReadonlyMap<string, Color> = new Map()): Promise<DesktopTheme> {
		const zipEntries = await ArchiveReader.read(bytes);

		const paletteEntry = ArchiveReader.find(zipEntries, DesktopTheme.#namesPalette);
		if (paletteEntry === null) throw new ReferenceError("No palette entry found in the desktop theme archive");
		const [, paletteBytes] = paletteEntry;
		const colors = PaletteReader.read(new TextDecoder("utf-8").decode(paletteBytes), baseColors);

		const tiledEntry = ArchiveReader.find(zipEntries, DesktopTheme.#namesTiled);
		let wallpaperEntry = ArchiveReader.find(zipEntries, DesktopTheme.#namesBackground);
		if (wallpaperEntry === null) wallpaperEntry = tiledEntry;
		const wallpaper = wallpaperEntry === null ? null : wallpaperEntry[1];

		return new DesktopTheme(colors, wallpaper, tiledEntry !== null);
	}

	async serialize(order: readonly string[]): Promise<Uint8Array> {
		const paletteBytes = PaletteWriter.write(this.colors, order);
		const entries: ArchiveEntry[] = [{ name: DesktopTheme.#nameCanonicalPalette, content: paletteBytes, stored: false }];

		const wallpaper = this.wallpaper;
		if (wallpaper !== null) {
			const extension = ThemeDocument.wallpaperExtension(wallpaper);
			const name = this.#tiled ? `tiled.${extension}` : `background.${extension}`;
			entries.push({ name, content: wallpaper, stored: true });
		}

		return ArchiveWriter.write(entries);
	}
}
//#endregion
