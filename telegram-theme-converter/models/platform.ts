"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";
import { Vocabulary } from "./vocabulary.js";
import { BindingTable } from "./binding-table.js";
import { ThemeDocument } from "./theme-document.js";
import { AndroidTheme } from "./android-theme.js";
import { DesktopTheme } from "./desktop-theme.js";
import { Polarity, PolarityDetector } from "../services/polarity.js";

//#region Platform
/**
 * Describes one theme platform: its key vocabulary, its role bindings, and how to
 * read and write its native file format. This is the single seam a future platform
 * (iOS, macOS) plugs into - conversion code never branches on platform identity.
 */
export abstract class Platform {
	readonly id: string;
	readonly label: string;
	readonly extension: string;
	readonly mimeType: string;
	readonly vocabulary: Vocabulary;
	readonly bindings: BindingTable;

	protected constructor(id: string, label: string, extension: string, mimeType: string, vocabulary: Vocabulary, bindings: BindingTable) {
		this.id = id;
		this.label = label;
		this.extension = extension;
		this.mimeType = mimeType;
		this.vocabulary = vocabulary;
		this.bindings = bindings;
	}

	matches(fileName: string): boolean {
		return fileName.toLowerCase().endsWith(this.extension.toLowerCase());
	}

	swapExtension(fileName: string, target: Readonly<Platform>): string {
		if (this.matches(fileName)) return `${fileName.slice(0, -this.extension.length)}${target.extension}`;
		return `${fileName}${target.extension}`;
	}

	order(): readonly string[] {
		return this.vocabulary.entries.map(entry => entry.name);
	}

	abstract parse(bytes: Readonly<Uint8Array>): Promise<ThemeDocument>;
	abstract create(colors: ReadonlyMap<string, Color>, wallpaper: Readonly<Uint8Array> | null): ThemeDocument;
}
//#endregion

//#region Android platform
export class AndroidPlatform extends Platform {
	constructor(vocabulary: Vocabulary, bindings: BindingTable) {
		super("android", "Android", ".attheme", "text/plain", vocabulary, bindings);
	}

	async parse(bytes: Readonly<Uint8Array>): Promise<ThemeDocument> {
		return Promise.resolve(AndroidTheme.parse(bytes));
	}

	create(colors: ReadonlyMap<string, Color>, wallpaper: Readonly<Uint8Array> | null): ThemeDocument {
		return new AndroidTheme(colors, wallpaper);
	}
}
//#endregion

//#region Desktop platform
export class DesktopPlatform extends Platform {
	static #polarityRole: string = "surface.primary";

	constructor(vocabulary: Vocabulary, bindings: BindingTable) {
		super("desktop", "Desktop", ".tdesktop-theme", "application/zip", vocabulary, bindings);
	}

	#seedColors(polarity: Polarity): Map<string, Color> {
		const colors = new Map<string, Color>();
		for (const entry of this.vocabulary.entries) colors.set(entry.name, polarity === Polarity.light ? entry.lightColor() : entry.darkColor());
		return colors;
	}

	#polarityOf(colors: ReadonlyMap<string, Color>): Polarity {
		const authorityKey = this.bindings.authorityKeyFor(DesktopPlatform.#polarityRole);
		if (authorityKey === null) return Polarity.light;

		const surface = colors.get(authorityKey);
		if (surface === undefined) return Polarity.light;

		return PolarityDetector.fromSurface(surface);
	}

	/**
	 * A `.tdesktop-theme` palette can reference undeclared keys symbolically (`windowFgOver: windowBg;`).
	 * Those references resolve against a seed map of platform defaults. Seeding with the wrong
	 * polarity's defaults silently pollutes a dark theme with light colors, so this parses once with a
	 * light seed to detect polarity from the resolved `surface.primary` authority key, then re-parses
	 * with the matching seed when that guess turns out to be dark.
	 */
	async parse(bytes: Readonly<Uint8Array>): Promise<ThemeDocument> {
		const probe = await DesktopTheme.parse(bytes, this.#seedColors(Polarity.light));
		const polarity = this.#polarityOf(probe.colors);
		if (polarity === Polarity.light) return probe;

		return DesktopTheme.parse(bytes, this.#seedColors(Polarity.dark));
	}

	create(colors: ReadonlyMap<string, Color>, wallpaper: Readonly<Uint8Array> | null): ThemeDocument {
		return new DesktopTheme(colors, wallpaper, false);
	}
}
//#endregion
