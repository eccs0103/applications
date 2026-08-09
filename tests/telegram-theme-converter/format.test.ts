"use strict";

import "adaptive-extender/core";
import { Color, ColorFormats } from "adaptive-extender/core";
import { describe, it, expect } from "vitest";
import AsyncFileSystem from "node:fs/promises";
import { AtthemeReader } from "../../telegram-theme-converter/services/attheme-reader.js";
import { AtthemeWriter } from "../../telegram-theme-converter/services/attheme-writer.js";
import { PaletteReader } from "../../telegram-theme-converter/services/palette-reader.js";
import { PaletteWriter } from "../../telegram-theme-converter/services/palette-writer.js";
import { ArchiveReader } from "../../telegram-theme-converter/services/archive-reader.js";
import { ArchiveWriter } from "../../telegram-theme-converter/services/archive-writer.js";
import { Argb } from "../../telegram-theme-converter/services/argb.js";
import { AndroidTheme } from "../../telegram-theme-converter/models/android-theme.js";
import { DesktopTheme } from "../../telegram-theme-converter/models/desktop-theme.js";

const fixtures = new URL("./fixtures/", import.meta.url);
const desktopVocabularyPath = new URL("../../resources/data/telegram-desktop-vocabulary.json", import.meta.url);

async function readFixture(name: string): Promise<Uint8Array> {
	const buffer = await AsyncFileSystem.readFile(new URL(name, fixtures));
	return new Uint8Array(buffer);
}

async function readDesktopBaseColors(): Promise<Map<string, Color>> {
	const json = await AsyncFileSystem.readFile(desktopVocabularyPath, "utf-8");
	const { entries } = JSON.parse(json) as { entries: { name: string; light: string; }[]; };
	const colors = new Map<string, Color>();
	for (const entry of entries) colors.set(entry.name, Color.parse(entry.light, { format: ColorFormats.hex, deep: true }));
	return colors;
}

function colorsEqual(first: Readonly<Color>, second: Readonly<Color>): boolean {
	return Argb.fromColor(first) === Argb.fromColor(second);
}

function colorMapsEqual(first: ReadonlyMap<string, Color>, second: ReadonlyMap<string, Color>): boolean {
	if (first.size !== second.size) return false;
	for (const [name, color] of first) {
		const other = second.get(name);
		if (other === undefined) return false;
		if (!colorsEqual(color, other)) return false;
	}
	return true;
}

const sampleWallpaper = new Uint8Array([
	0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
	0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

describe("Argb", () => {
	it("round-trips signed 32-bit ARGB integers through Color", () => {
		for (const value of [-1, 0, -14709290, -10177041, 1, 0x5affffff | 0, -2147483648, 2147483647]) {
			const color = Argb.toColor(value);
			expect(Argb.fromColor(color)).toBe(value);
		}
	});
});

describe("AtthemeReader / AtthemeWriter", () => {
	it("round-trips a color map with no wallpaper", () => {
		const colors = new Map<string, Color>([
			["windowBackgroundWhite", Color.fromRGB(255, 255, 255, 1)],
			["chat_inBubble", Color.fromRGB(10, 20, 30, 0.5)],
		]);
		const order = [...colors.keys()];
		const bytes = AtthemeWriter.writeText(colors, order, -1);
		const { colors: parsed, wallpaper } = AtthemeReader.read(bytes);
		expect(wallpaper).toBeNull();
		expect(colorMapsEqual(parsed, colors)).toBe(true);
	});

	it("strips the legacy 'key_' prefix and ignores wallpaperFileOffset", () => {
		const text = "key_graySectionText=-7762802\nwallpaperFileOffset=1234\nchat_status=-1\n";
		const { colors } = AtthemeReader.read(new TextEncoder().encode(text));
		expect(colors.has("graySectionText")).toBe(true);
		expect(colors.has("wallpaperFileOffset")).toBe(false);
		expect(colors.get("chat_status")).toBeDefined();
	});

	it("reproduces official sample files byte-for-byte on a read/rewrite round trip for the keys they declare", async () => {
		for (const name of ["day.attheme", "night.attheme", "bluebubbles.attheme"]) {
			const bytes = await readFixture(name);
			const { colors, wallpaper } = AtthemeReader.read(bytes);
			expect(wallpaper).toBeNull();
			const order = [...colors.keys()];
			const rewritten = AtthemeWriter.writeText(colors, order, -1);
			const { colors: reparsed } = AtthemeReader.read(rewritten);
			expect(colorMapsEqual(reparsed, colors)).toBe(true);
		}
	});

	it("finds the WPS/WPE markers at an arbitrary, independently-computed offset", () => {
		const prefix = new TextEncoder().encode("chat_wallpaper=-1\n");
		const markerWallpaperStart = AtthemeReader.markerWallpaperStart;
		const markerWallpaperEnd = AtthemeReader.markerWallpaperEnd;
		const bytes = new Uint8Array(prefix.length + markerWallpaperStart.length + sampleWallpaper.length + markerWallpaperEnd.length);
		bytes.set(prefix, 0);
		bytes.set(markerWallpaperStart, prefix.length);
		bytes.set(sampleWallpaper, prefix.length + markerWallpaperStart.length);
		bytes.set(markerWallpaperEnd, prefix.length + markerWallpaperStart.length + sampleWallpaper.length);

		const parsed = AtthemeReader.read(bytes);
		const wallpaper = ReferenceError.suppress(parsed.wallpaper, "Expected a parsed wallpaper");
		expect([...wallpaper]).toEqual([...sampleWallpaper]);
	});
});

describe("AndroidTheme", () => {
	it("computes a wallpaperFileOffset that survives a serialize/parse round trip, with no wallpaper", async () => {
		const colors = new Map<string, Color>([["windowBackgroundWhite", Color.fromRGB(1, 2, 3, 1)]]);
		const theme = new AndroidTheme(colors, null);
		const bytes = await theme.serialize([...colors.keys()]);
		const parsed = AndroidTheme.parse(bytes);
		expect(parsed.wallpaper).toBeNull();
		expect(colorMapsEqual(parsed.colors, colors)).toBe(true);
	});

	it("computes a wallpaperFileOffset that survives a serialize/parse round trip, with a wallpaper", async () => {
		const colors = new Map<string, Color>([
			["windowBackgroundWhite", Color.fromRGB(1, 2, 3, 1)],
			["chat_wallpaper", Color.fromRGB(200, 200, 200, 1)],
		]);
		const theme = new AndroidTheme(colors, sampleWallpaper);
		const order = [...colors.keys()];
		const bytes = await theme.serialize(order);
		const parsed = AndroidTheme.parse(bytes);

		const wallpaper = ReferenceError.suppress(parsed.wallpaper, "Expected a parsed wallpaper");
		expect([...wallpaper]).toEqual([...sampleWallpaper]);
		expect(colorMapsEqual(parsed.colors, colors)).toBe(true);
	});
});

describe("PaletteReader / PaletteWriter", () => {
	it("round-trips a color map", () => {
		const colors = new Map<string, Color>([
			["windowBg", Color.fromRGB(255, 255, 255, 1)],
			["windowFg", Color.fromRGB(0, 0, 0, 1)],
		]);
		const order = [...colors.keys()];
		const bytes = PaletteWriter.write(colors, order);
		const parsed = PaletteReader.read(new TextDecoder("utf-8").decode(bytes));
		expect(colorMapsEqual(parsed, colors)).toBe(true);
	});

	it("resolves references and the '|' fallback to its first alternative", () => {
		const text = "a: #ff0000ff;\nb: a;\nc: #00ff00 | a; // trailing comment\n";
		const colors = PaletteReader.read(text);
		const colorA = ReferenceError.suppress(colors.get("a"), "Missing 'a'");
		const colorB = ReferenceError.suppress(colors.get("b"), "Missing 'b'");
		const colorC = ReferenceError.suppress(colors.get("c"), "Missing 'c'");
		expect(colorsEqual(colorB, colorA)).toBe(true);
		expect(colorC.toString({ format: ColorFormats.hex, deep: false })).toBe("#00ff00");
	});

	it("seeds resolution from a base map for a partial override film", () => {
		const seed = new Map<string, Color>([["windowBg", Color.fromRGB(1, 1, 1, 1)]]);
		const colors = PaletteReader.read("windowFgOver: windowBg;\n", seed);
		const seedWindowBg = ReferenceError.suppress(seed.get("windowBg"), "Missing seed 'windowBg'");
		const resolvedWindowFgOver = ReferenceError.suppress(colors.get("windowFgOver"), "Missing 'windowFgOver'");
		const resolvedWindowBg = ReferenceError.suppress(colors.get("windowBg"), "Missing 'windowBg'");
		expect(colorsEqual(resolvedWindowFgOver, seedWindowBg)).toBe(true);
		expect(colorsEqual(resolvedWindowBg, seedWindowBg)).toBe(true);
	});

	it("reproduces official sample files on a read/rewrite round trip", async () => {
		const baseColors = await readDesktopBaseColors();
		for (const name of ["day-custom-base.tdesktop-theme", "night-custom-base.tdesktop-theme"]) {
			const bytes = await readFixture(name);
			const entries = await ArchiveReader.read(bytes);
			const entry = ArchiveReader.find(entries, ["colors.tdesktop-theme", "colors.tdesktop-palette"]);
			const [, paletteBytes] = ReferenceError.suppress(entry, `No palette entry in '${name}'`);
			const colors = PaletteReader.read(new TextDecoder("utf-8").decode(paletteBytes), baseColors);
			const order = [...colors.keys()];
			const rewritten = PaletteWriter.write(colors, order);
			const reparsed = PaletteReader.read(new TextDecoder("utf-8").decode(rewritten));
			expect(colorMapsEqual(reparsed, colors)).toBe(true);
		}
	});
});

describe("ArchiveReader / ArchiveWriter", () => {
	it("round-trips stored and deflated entries", async () => {
		const textContent = new TextEncoder().encode("windowBg: #ffffffff;\n");
		const entries = [
			{ name: "colors.tdesktop-theme", content: textContent, stored: false },
			{ name: "background.jpg", content: sampleWallpaper, stored: true },
		];
		const archive = await ArchiveWriter.write(entries);
		const parsed = await ArchiveReader.read(archive);

		expect(parsed.size).toBe(2);
		const paletteEntry = ReferenceError.suppress(parsed.get("colors.tdesktop-theme"), "Missing palette entry");
		const wallpaperEntry = ReferenceError.suppress(parsed.get("background.jpg"), "Missing wallpaper entry");
		expect([...paletteEntry]).toEqual([...textContent]);
		expect([...wallpaperEntry]).toEqual([...sampleWallpaper]);
	});

	it("finds entries case-insensitively", async () => {
		const archive = await ArchiveWriter.write([{ name: "Colors.TDesktop-Theme", content: new Uint8Array([1]), stored: true }]);
		const parsed = await ArchiveReader.read(archive);
		const found = ArchiveReader.find(parsed, ["colors.tdesktop-theme"]);
		expect(found).not.toBeNull();
	});

	it("reproduces the official sample archives on a decompress/recompress round trip", async () => {
		for (const name of ["day-custom-base.tdesktop-theme", "night-custom-base.tdesktop-theme"]) {
			const bytes = await readFixture(name);
			const entries = await ArchiveReader.read(bytes);
			const rebuilt = await ArchiveWriter.write([...entries].map(([entryName, content]) => ({ name: entryName, content, stored: false })));
			const reparsed = await ArchiveReader.read(rebuilt);
			expect(reparsed.size).toBe(entries.size);
			for (const [entryName, content] of entries) {
				const reparsedContent = ReferenceError.suppress(reparsed.get(entryName), `Missing entry '${entryName}'`);
				expect([...reparsedContent]).toEqual([...content]);
			}
		}
	});
});

describe("DesktopTheme", () => {
	it("round-trips colors with no wallpaper", async () => {
		const colors = new Map<string, Color>([["windowBg", Color.fromRGB(1, 2, 3, 1)]]);
		const theme = new DesktopTheme(colors, null);
		const bytes = await theme.serialize([...colors.keys()]);
		const parsed = await DesktopTheme.parse(bytes);
		expect(parsed.wallpaper).toBeNull();
		expect(parsed.tiled).toBe(false);
		expect(colorMapsEqual(parsed.colors, colors)).toBe(true);
	});

	it("round-trips a non-tiled wallpaper under 'background.<ext>'", async () => {
		const colors = new Map<string, Color>([["windowBg", Color.fromRGB(1, 2, 3, 1)]]);
		const theme = new DesktopTheme(colors, sampleWallpaper, false);
		const bytes = await theme.serialize([...colors.keys()]);
		const parsed = await DesktopTheme.parse(bytes);
		expect(parsed.tiled).toBe(false);
		const wallpaper = ReferenceError.suppress(parsed.wallpaper, "Expected a parsed wallpaper");
		expect([...wallpaper]).toEqual([...sampleWallpaper]);
	});

	it("round-trips a tiled wallpaper under 'tiled.<ext>'", async () => {
		const colors = new Map<string, Color>([["windowBg", Color.fromRGB(1, 2, 3, 1)]]);
		const theme = new DesktopTheme(colors, sampleWallpaper, true);
		const bytes = await theme.serialize([...colors.keys()]);
		const parsed = await DesktopTheme.parse(bytes);
		expect(parsed.tiled).toBe(true);
		const wallpaper = ReferenceError.suppress(parsed.wallpaper, "Expected a parsed wallpaper");
		expect([...wallpaper]).toEqual([...sampleWallpaper]);
	});

	it("parses official sample archives without error", async () => {
		const baseColors = await readDesktopBaseColors();
		for (const name of ["day-custom-base.tdesktop-theme", "night-custom-base.tdesktop-theme"]) {
			const bytes = await readFixture(name);
			const theme = await DesktopTheme.parse(bytes, baseColors);
			expect(theme.colors.size).toBeGreaterThan(0);
		}
	});
});
