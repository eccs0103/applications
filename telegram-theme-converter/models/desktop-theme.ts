"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";
import { ThemeDocument } from "./theme-document.js";
import { ArchiveReader } from "../services/archive-reader.js";
import { ArchiveWriter, type ArchiveEntry } from "../services/archive-writer.js";
import { PaletteReader } from "../services/palette-reader.js";
import { PaletteWriter } from "../services/palette-writer.js";
import { type Codec } from "../services/codec.js";

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

	static async parse(bytes: Readonly<Uint8Array>, codec: Codec): Promise<DesktopTheme>;
	static async parse(bytes: Readonly<Uint8Array>, codec: Codec, baseColors: ReadonlyMap<string, Color>): Promise<DesktopTheme>;
	static async parse(bytes: Readonly<Uint8Array>, codec: Codec, baseColors: ReadonlyMap<string, Color> = new Map()): Promise<DesktopTheme> {
		const entries = await ArchiveReader.read(bytes, codec);

		const [, palette] = ReferenceError.suppress(ArchiveReader.find(entries, DesktopTheme.#namesPalette), "No palette entry found in the desktop theme archive");
		const colors = PaletteReader.read(codec.decode(palette), baseColors);

		const tiledEntry = ArchiveReader.find(entries, DesktopTheme.#namesTiled);
		let wallpaperEntry = ArchiveReader.find(entries, DesktopTheme.#namesBackground);
		if (wallpaperEntry === null) wallpaperEntry = tiledEntry;
		const wallpaper = wallpaperEntry === null ? null : wallpaperEntry[1];

		return new DesktopTheme(colors, wallpaper, tiledEntry !== null);
	}

	async serialize(order: readonly string[], codec: Codec): Promise<Uint8Array> {
		const palette = PaletteWriter.write(this.colors, order, codec);
		const entries: ArchiveEntry[] = [{ name: DesktopTheme.#nameCanonicalPalette, content: palette, stored: false }];

		const wallpaper = this.wallpaper;
		if (wallpaper !== null) {
			const extension = ThemeDocument.wallpaperExtension(wallpaper);
			const name = this.#tiled ? `tiled.${extension}` : `background.${extension}`;
			entries.push({ name, content: wallpaper, stored: true });
		}

		return ArchiveWriter.write(entries, codec);
	}
}
//#endregion
