"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";

//#region Theme document
/**
 * A parsed theme file for one Telegram platform: its color keys and, optionally, its
 * embedded chat wallpaper image. Concrete subclasses own how their platform's file format
 * is serialized back to bytes.
 */
export abstract class ThemeDocument {
	#colors: Map<string, Color>;
	#wallpaper: Uint8Array | null;

	constructor(colors: ReadonlyMap<string, Color>, wallpaper: Readonly<Uint8Array> | null) {
		if (new.target === ThemeDocument) throw new TypeError("Unable to create an instance of an abstract class");
		this.#colors = new Map(colors);
		this.#wallpaper = wallpaper === null ? null : new Uint8Array(wallpaper);
	}

	get colors(): ReadonlyMap<string, Color> {
		return this.#colors;
	}

	get wallpaper(): Uint8Array | null {
		return this.#wallpaper;
	}

	names(): Set<string> {
		return new Set(this.#colors.keys());
	}

	/**
	 * Serializes this document to the bytes of its own file format.
	 * @param order The target vocabulary's canonical key order - every key must have a color.
	 */
	abstract serialize(order: readonly string[]): Promise<Uint8Array>;

	/**
	 * Identifies whether wallpaper bytes are a JPEG or a PNG image by their magic number.
	 * @throws {TypeError} If the bytes match neither format.
	 */
	static wallpaperExtension(wallpaper: Readonly<Uint8Array>): "jpg" | "png" {
		if (wallpaper.length >= 2 && wallpaper[0] === 0xff && wallpaper[1] === 0xd8) return "jpg";
		if (wallpaper.length >= 4 && wallpaper[0] === 0x89 && wallpaper[1] === 0x50 && wallpaper[2] === 0x4e && wallpaper[3] === 0x47) return "png";
		throw new TypeError("Wallpaper bytes are neither a recognizable JPEG nor PNG image");
	}
}
//#endregion
