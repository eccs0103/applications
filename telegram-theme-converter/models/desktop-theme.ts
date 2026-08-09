"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";
import { ThemeDocument } from "./theme-document.js";
import { ArchiveReader } from "../services/archive-reader.js";
import { ArchiveWriter, type ArchiveEntry } from "../services/archive-writer.js";
import { PaletteReader } from "../services/palette-reader.js";
import { PaletteWriter } from "../services/palette-writer.js";

const namesPalette = ["colors.tdesktop-palette", "colors.tdesktop-theme"];
const namesBackground = ["background.jpg", "background.png"];
const namesTiled = ["tiled.jpg", "tiled.png"];
const nameCanonicalPalette = "colors.tdesktop-theme";

//#region Desktop theme
/**
 * A parsed Desktop `.tdesktop-theme` document - a ZIP archive containing a palette entry and,
 * optionally, a background image whose filename itself carries the tiled/non-tiled flag.
 */
export class DesktopTheme extends ThemeDocument {
	#tiled: boolean;

	constructor(colors: ReadonlyMap<string, Color>, wallpaper: Readonly<Uint8Array> | null, tiled: boolean = false) {
		super(colors, wallpaper);
		this.#tiled = tiled;
	}

	get tiled(): boolean {
		return this.#tiled;
	}

	/**
	 * @param baseColors Desktop's own compiled-in default palette. A `.tdesktop-theme` file is
	 * an override film, not always a self-contained palette - Telegram always has this base
	 * loaded before applying it, so a reference the file makes to a key it does not itself
	 * declare is only resolvable against this same base.
	 * @throws {ReferenceError} If the archive contains no recognizable palette entry.
	 */
	static async parse(bytes: Readonly<Uint8Array>, baseColors: ReadonlyMap<string, Color> = new Map()): Promise<DesktopTheme> {
		const zipEntries = await ArchiveReader.read(bytes);

		const paletteEntry = ArchiveReader.find(zipEntries, namesPalette);
		if (paletteEntry === null) throw new ReferenceError("No palette entry found in the desktop theme archive");
		const [, paletteBytes] = paletteEntry;
		const colors = PaletteReader.read(new TextDecoder("utf-8").decode(paletteBytes), baseColors);

		const tiledEntry = ArchiveReader.find(zipEntries, namesTiled);
		let wallpaperEntry = ArchiveReader.find(zipEntries, namesBackground);
		if (wallpaperEntry === null) wallpaperEntry = tiledEntry;
		const wallpaper = wallpaperEntry === null ? null : wallpaperEntry[1];

		return new DesktopTheme(colors, wallpaper, tiledEntry !== null);
	}

	async serialize(order: readonly string[]): Promise<Uint8Array> {
		const paletteBytes = PaletteWriter.write(this.colors, order);
		const entries: ArchiveEntry[] = [{ name: nameCanonicalPalette, content: paletteBytes, stored: false }];

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
