"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { Argb } from "./argb.js";

export const markerWallpaperStart: Readonly<Uint8Array> = new TextEncoder().encode("WPS\n");
export const markerWallpaperEnd: Readonly<Uint8Array> = new TextEncoder().encode("\nWPE\n");
export const keyWallpaperOffset = "wallpaperFileOffset";

const prefixLegacyKey = "key_";

export interface AtthemeDocumentData {
	colors: Map<string, Color>;
	wallpaper: Uint8Array | null;
}

//#region Attheme reader
/**
 * Parses the Android `.attheme` format: plain-text `name=value` lines, one per color, where
 * `value` is a signed 32-bit ARGB integer, followed by an optional embedded wallpaper image
 * framed by literal `WPS` / `WPE` marker lines.
 */
export class AtthemeReader {
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
		if (name.startsWith(prefixLegacyKey)) return name.slice(prefixLegacyKey.length);
		return name;
	}

	/**
	 * @throws {SyntaxError} If a non-empty, non-comment line does not match `name=value`.
	 */
	static #parseColors(text: string): Map<string, Color> {
		const colors = new Map<string, Color>();
		for (const line of text.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (trimmed.length === 0) continue;
			if (trimmed.startsWith("//")) continue;

			const index = trimmed.indexOf("=");
			if (index === -1) throw new SyntaxError(`Invalid '${trimmed}' line syntax`);
			const name = AtthemeReader.#normalizeName(trimmed.slice(0, index).trim());
			if (name === keyWallpaperOffset) continue;

			const rawValue = trimmed.slice(index + 1).trim();
			const value = Number.parseInt(rawValue, 10);
			if (!Number.isFinite(value)) throw new SyntaxError(`Invalid '${rawValue}' color value for key '${name}'`);
			colors.set(name, Argb.toColor(value));
		}
		return colors;
	}

	static read(bytes: Readonly<Uint8Array>): AtthemeDocumentData {
		const wpsIndex = AtthemeReader.#indexOfBytes(bytes, markerWallpaperStart, 0);
		if (wpsIndex === -1) {
			const text = new TextDecoder("utf-8").decode(bytes);
			return { colors: AtthemeReader.#parseColors(text), wallpaper: null };
		}

		const text = new TextDecoder("utf-8").decode(bytes.subarray(0, wpsIndex));
		const wallpaperStart = wpsIndex + markerWallpaperStart.length;
		const wpeIndex = AtthemeReader.#indexOfBytes(bytes, markerWallpaperEnd, wallpaperStart);
		const wallpaperEnd = wpeIndex === -1 ? bytes.length : wpeIndex;
		const wallpaper = bytes.subarray(wallpaperStart, wallpaperEnd);

		return { colors: AtthemeReader.#parseColors(text), wallpaper: new Uint8Array(wallpaper) };
	}
}
//#endregion
