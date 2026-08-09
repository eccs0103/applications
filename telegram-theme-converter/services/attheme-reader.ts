"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { Argb } from "./argb.js";

//#region Attheme reader
export interface AtthemeDocumentData {
	colors: Map<string, Color>;
	wallpaper: Uint8Array | null;
}

export class AtthemeReader {
	static #markerWallpaperStart: Uint8Array = new TextEncoder().encode("WPS\n");
	static #markerWallpaperEnd: Uint8Array = new TextEncoder().encode("\nWPE\n");
	static #keyWallpaperOffset: string = "wallpaperFileOffset";
	static #prefixLegacyKey: string = "key_";

	static get markerWallpaperStart(): Readonly<Uint8Array> { return AtthemeReader.#markerWallpaperStart; }
	static get markerWallpaperEnd(): Readonly<Uint8Array> { return AtthemeReader.#markerWallpaperEnd; }
	static get keyWallpaperOffset(): string { return AtthemeReader.#keyWallpaperOffset; }

	static #indexOfBytes(bytes: Readonly<Uint8Array>, marker: Readonly<Uint8Array>, from: number): number {
		outer: for (let index = from; index <= bytes.length - marker.length; index++) {
			for (let offset = 0; offset < marker.length; offset++) {
				if (bytes[index + offset] !== marker[offset]) continue outer;
			}
			return index;
		}
		return -1;
	}

	static #normalizeName(name: string): string {
		if (name.startsWith(AtthemeReader.#prefixLegacyKey)) return name.slice(AtthemeReader.#prefixLegacyKey.length);
		return name;
	}

	static #parseColors(text: string): Map<string, Color> {
		const colors = new Map<string, Color>();
		for (const line of text.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (trimmed.length === 0) continue;
			if (trimmed.startsWith("//")) continue;

			const index = trimmed.indexOf("=");
			if (index === -1) throw new SyntaxError(`Invalid '${trimmed}' line syntax`);
			const name = AtthemeReader.#normalizeName(trimmed.slice(0, index).trim());
			if (name === AtthemeReader.#keyWallpaperOffset) continue;

			const rawValue = trimmed.slice(index + 1).trim();
			const value = Number.parseInt(rawValue, 10);
			if (!Number.isFinite(value)) throw new SyntaxError(`Invalid '${rawValue}' color value for key '${name}'`);
			colors.set(name, Argb.toColor(value));
		}
		return colors;
	}

	static read(bytes: Readonly<Uint8Array>): AtthemeDocumentData {
		const wpsIndex = AtthemeReader.#indexOfBytes(bytes, AtthemeReader.#markerWallpaperStart, 0);
		if (wpsIndex === -1) {
			const text = new TextDecoder("utf-8").decode(bytes);
			return { colors: AtthemeReader.#parseColors(text), wallpaper: null };
		}

		const text = new TextDecoder("utf-8").decode(bytes.subarray(0, wpsIndex));
		const wallpaperStart = wpsIndex + AtthemeReader.#markerWallpaperStart.length;
		const wpeIndex = AtthemeReader.#indexOfBytes(bytes, AtthemeReader.#markerWallpaperEnd, wallpaperStart);
		const wallpaperEnd = wpeIndex === -1 ? bytes.length : wpeIndex;
		const wallpaper = bytes.subarray(wallpaperStart, wallpaperEnd);

		return { colors: AtthemeReader.#parseColors(text), wallpaper: new Uint8Array(wallpaper) };
	}
}
//#endregion
