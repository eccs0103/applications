"use strict";

import "adaptive-extender/node";
import { Color, ColorFormats } from "adaptive-extender/node";
import { describe, it, expect } from "vitest";
import { AtthemeReader } from "../../telegram-theme-converter/services/attheme-reader.js";
import { AtthemeWriter } from "../../telegram-theme-converter/services/attheme-writer.js";
import { PaletteReader } from "../../telegram-theme-converter/services/palette-reader.js";
import { PaletteWriter } from "../../telegram-theme-converter/services/palette-writer.js";
import { ArchiveReader } from "../../telegram-theme-converter/services/archive-reader.js";
import { ArchiveWriter } from "../../telegram-theme-converter/services/archive-writer.js";
import { Argb } from "../../telegram-theme-converter/services/argb.js";
import { AndroidTheme } from "../../telegram-theme-converter/models/android-theme.js";
import { DesktopTheme } from "../../telegram-theme-converter/models/desktop-theme.js";
import { TestData } from "./test-data.js";

function sameColor(color: Readonly<Color>, color2: Readonly<Color>): boolean {
	return Argb.fromColor(color) === Argb.fromColor(color2);
}

function sameColors(colors: ReadonlyMap<string, Color>, colors2: ReadonlyMap<string, Color>): boolean {
	if (colors.size !== colors2.size) return false;
	for (const [name, color] of colors) {
		const other = colors2.get(name);
		if (other === undefined) return false;
		if (!sameColor(color, other)) return false;
	}
	return true;
}

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
		expect(sameColors(parsed, colors)).toBe(true);
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
			const bytes = await TestData.fixture(name);
			const { colors, wallpaper } = AtthemeReader.read(bytes);
			expect(wallpaper).toBeNull();
			const order = [...colors.keys()];
			const rewritten = AtthemeWriter.writeText(colors, order, -1);
			const { colors: reparsed } = AtthemeReader.read(rewritten);
			expect(sameColors(reparsed, colors)).toBe(true);
		}
	});

	it("finds the WPS/WPE markers at an arbitrary, independently-computed offset", () => {
		const { wallpaper: sample } = TestData;
		const { markerWallpaperStart: start, markerWallpaperEnd: end } = AtthemeReader;
		const prefix = new TextEncoder().encode("chat_wallpaper=-1\n");
		const bytes = new Uint8Array(prefix.length + start.length + sample.length + end.length);
		bytes.set(prefix, 0);
		bytes.set(start, prefix.length);
		bytes.set(sample, prefix.length + start.length);
		bytes.set(end, prefix.length + start.length + sample.length);

		const parsed = AtthemeReader.read(bytes);
		const wallpaper = ReferenceError.suppress(parsed.wallpaper, "Expected a parsed wallpaper");
		expect([...wallpaper]).toEqual([...sample]);
	});
});

describe("AndroidTheme", () => {
	it("computes a wallpaperFileOffset that survives a serialize/parse round trip, with no wallpaper", async () => {
		const colors = new Map<string, Color>([["windowBackgroundWhite", Color.fromRGB(1, 2, 3, 1)]]);
		const theme = new AndroidTheme(colors, null);
		const bytes = await theme.serialize([...colors.keys()]);
		const parsed = AndroidTheme.parse(bytes);
		expect(parsed.wallpaper).toBeNull();
		expect(sameColors(parsed.colors, colors)).toBe(true);
	});

	it("computes a wallpaperFileOffset that survives a serialize/parse round trip, with a wallpaper", async () => {
		const { wallpaper: sample } = TestData;
		const colors = new Map<string, Color>([
			["windowBackgroundWhite", Color.fromRGB(1, 2, 3, 1)],
			["chat_wallpaper", Color.fromRGB(200, 200, 200, 1)],
		]);
		const theme = new AndroidTheme(colors, sample);
		const order = [...colors.keys()];
		const bytes = await theme.serialize(order);
		const parsed = AndroidTheme.parse(bytes);

		const wallpaper = ReferenceError.suppress(parsed.wallpaper, "Expected a parsed wallpaper");
		expect([...wallpaper]).toEqual([...sample]);
		expect(sameColors(parsed.colors, colors)).toBe(true);
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
		expect(sameColors(parsed, colors)).toBe(true);
	});

	it("resolves references and the '|' fallback to its first alternative", () => {
		const text = "a: #ff0000ff;\nb: a;\nc: #00ff00 | a; // trailing comment\n";
		const colors = PaletteReader.read(text);
		const colorA = ReferenceError.suppress(colors.get("a"), "Missing 'a'");
		const colorB = ReferenceError.suppress(colors.get("b"), "Missing 'b'");
		const colorC = ReferenceError.suppress(colors.get("c"), "Missing 'c'");
		expect(sameColor(colorB, colorA)).toBe(true);
		expect(colorC.toString({ format: ColorFormats.hex, deep: false })).toBe("#00ff00");
	});

	it("seeds resolution from a base map for a partial override film", () => {
		const seed = new Map<string, Color>([["windowBg", Color.fromRGB(1, 1, 1, 1)]]);
		const colors = PaletteReader.read("windowFgOver: windowBg;\n", seed);
		const seeded = ReferenceError.suppress(seed.get("windowBg"), "Missing seed 'windowBg'");
		const over = ReferenceError.suppress(colors.get("windowFgOver"), "Missing 'windowFgOver'");
		const background = ReferenceError.suppress(colors.get("windowBg"), "Missing 'windowBg'");
		expect(sameColor(over, seeded)).toBe(true);
		expect(sameColor(background, seeded)).toBe(true);
	});

	it("reproduces official sample files on a read/rewrite round trip", async () => {
		const desktop = await TestData.vocabulary("telegram-desktop-vocabulary.json");
		const base = desktop.lightColors();
		for (const name of ["day-custom-base.tdesktop-theme", "night-custom-base.tdesktop-theme"]) {
			const bytes = await TestData.fixture(name);
			const entries = await ArchiveReader.read(bytes);
			const entry = ArchiveReader.find(entries, ["colors.tdesktop-theme", "colors.tdesktop-palette"]);
			const [, palette] = ReferenceError.suppress(entry, `No palette entry in '${name}'`);
			const colors = PaletteReader.read(new TextDecoder("utf-8").decode(palette), base);
			const order = [...colors.keys()];
			const rewritten = PaletteWriter.write(colors, order);
			const reparsed = PaletteReader.read(new TextDecoder("utf-8").decode(rewritten));
			expect(sameColors(reparsed, colors)).toBe(true);
		}
	});
});

describe("ArchiveReader / ArchiveWriter", () => {
	it("round-trips stored and deflated entries", async () => {
		const { wallpaper: sample } = TestData;
		const text = new TextEncoder().encode("windowBg: #ffffffff;\n");
		const entries = [
			{ name: "colors.tdesktop-theme", content: text, stored: false },
			{ name: "background.jpg", content: sample, stored: true },
		];
		const archive = await ArchiveWriter.write(entries);
		const parsed = await ArchiveReader.read(archive);

		expect(parsed.size).toBe(2);
		const palette = ReferenceError.suppress(parsed.get("colors.tdesktop-theme"), "Missing palette entry");
		const wallpaper = ReferenceError.suppress(parsed.get("background.jpg"), "Missing wallpaper entry");
		expect([...palette]).toEqual([...text]);
		expect([...wallpaper]).toEqual([...sample]);
	});

	it("finds entries case-insensitively", async () => {
		const archive = await ArchiveWriter.write([{ name: "Colors.TDesktop-Theme", content: new Uint8Array([1]), stored: true }]);
		const parsed = await ArchiveReader.read(archive);
		const found = ArchiveReader.find(parsed, ["colors.tdesktop-theme"]);
		expect(found).not.toBeNull();
	});

	it("reproduces the official sample archives on a decompress/recompress round trip", async () => {
		for (const name of ["day-custom-base.tdesktop-theme", "night-custom-base.tdesktop-theme"]) {
			const bytes = await TestData.fixture(name);
			const entries = await ArchiveReader.read(bytes);
			const rebuilt = await ArchiveWriter.write([...entries].map(([key, content]) => ({ name: key, content, stored: false })));
			const reparsed = await ArchiveReader.read(rebuilt);
			expect(reparsed.size).toBe(entries.size);
			for (const [key, content] of entries) {
				const content2 = ReferenceError.suppress(reparsed.get(key), `Missing entry '${key}'`);
				expect([...content2]).toEqual([...content]);
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
		expect(sameColors(parsed.colors, colors)).toBe(true);
	});

	it("round-trips a non-tiled wallpaper under 'background.<ext>'", async () => {
		const { wallpaper: sample } = TestData;
		const colors = new Map<string, Color>([["windowBg", Color.fromRGB(1, 2, 3, 1)]]);
		const theme = new DesktopTheme(colors, sample, false);
		const bytes = await theme.serialize([...colors.keys()]);
		const parsed = await DesktopTheme.parse(bytes);
		expect(parsed.tiled).toBe(false);
		const wallpaper = ReferenceError.suppress(parsed.wallpaper, "Expected a parsed wallpaper");
		expect([...wallpaper]).toEqual([...sample]);
	});

	it("round-trips a tiled wallpaper under 'tiled.<ext>'", async () => {
		const { wallpaper: sample } = TestData;
		const colors = new Map<string, Color>([["windowBg", Color.fromRGB(1, 2, 3, 1)]]);
		const theme = new DesktopTheme(colors, sample, true);
		const bytes = await theme.serialize([...colors.keys()]);
		const parsed = await DesktopTheme.parse(bytes);
		expect(parsed.tiled).toBe(true);
		const wallpaper = ReferenceError.suppress(parsed.wallpaper, "Expected a parsed wallpaper");
		expect([...wallpaper]).toEqual([...sample]);
	});

	it("parses official sample archives without error", async () => {
		const desktop = await TestData.vocabulary("telegram-desktop-vocabulary.json");
		const base = desktop.lightColors();
		for (const name of ["day-custom-base.tdesktop-theme", "night-custom-base.tdesktop-theme"]) {
			const bytes = await TestData.fixture(name);
			const theme = await DesktopTheme.parse(bytes, base);
			expect(theme.colors.size).toBeGreaterThan(0);
		}
	});
});
