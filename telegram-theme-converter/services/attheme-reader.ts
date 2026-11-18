"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { Argb } from "./argb.js";
import { type Codec } from "./codec.js";

//#region Attheme reader
export interface AtthemeDocumentData {
	colors: Map<string, Color>;
	wallpaper: Uint8Array | null;
}

export class AtthemeReader {
	static #markerWallpaperStart: Uint8Array = Uint8Array.from("WPS\n", character => character.charCodeAt(0));
	static #markerWallpaperEnd: Uint8Array = Uint8Array.from("\nWPE\n", character => character.charCodeAt(0));
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

	static #unprefix(name: string): string {
		const prefix = AtthemeReader.#prefixLegacyKey;
		if (name.startsWith(prefix)) return name.slice(prefix.length);
		return name;
	}

	static #parseColors(text: string): Map<string, Color> {
		const colors = new Map<string, Color>();
		for (const line of text.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (String.isEmpty(trimmed)) continue;
			if (trimmed.startsWith("//")) continue;

			const index = trimmed.indexOf("=");
			if (index === -1) throw new SyntaxError(`Invalid '${trimmed}' line syntax`);
			const name = AtthemeReader.#unprefix(trimmed.slice(0, index).trim());
			if (name === AtthemeReader.#keyWallpaperOffset) continue;

			const raw = trimmed.slice(index + 1).trim();
			const value = Number.parseInt(raw, 10);
			if (!Number.isFinite(value)) throw new SyntaxError(`Invalid '${raw}' color value for key '${name}'`);
			colors.set(name, Argb.toColor(value));
		}
		return colors;
	}

	static read(bytes: Readonly<Uint8Array>, codec: Codec): AtthemeDocumentData {
		const markerWallpaperStart = AtthemeReader.#markerWallpaperStart;
		const wpsIndex = AtthemeReader.#indexOfBytes(bytes, markerWallpaperStart, 0);
		if (wpsIndex === -1) {
			const text = codec.decode(bytes);
			return { colors: AtthemeReader.#parseColors(text), wallpaper: null };
		}

		const text = codec.decode(bytes.subarray(0, wpsIndex));
		const start = wpsIndex + markerWallpaperStart.length;
		const wpeIndex = AtthemeReader.#indexOfBytes(bytes, AtthemeReader.#markerWallpaperEnd, start);
		const end = wpeIndex === -1 ? bytes.length : wpeIndex;
		const wallpaper = bytes.subarray(start, end);

		return { colors: AtthemeReader.#parseColors(text), wallpaper: new Uint8Array(wallpaper) };
	}
}
//#endregion
