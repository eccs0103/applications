"use strict";

import "adaptive-extender/node";
import { URI } from "adaptive-extender/node";
import AsyncFileSystem from "node:fs/promises";

//#region Test data
export class TestData {
	static #fixtures: URI = new URI("./fixtures/", import.meta.url);
	static #data: URI = new URI("../../resources/data/", import.meta.url);
	static #wallpaper: Uint8Array = new Uint8Array([
		0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
		0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
	]);

	static get wallpaper(): Uint8Array { return TestData.#wallpaper; }

	static async fixture(name: string): Promise<Uint8Array> {
		const buffer = await AsyncFileSystem.readFile(new URI(name, TestData.#fixtures).toPath());
		return new Uint8Array(buffer);
	}

	static async data(name: string): Promise<string> {
		return await AsyncFileSystem.readFile(new URI(name, TestData.#data).toPath(), "utf-8");
	}
}
//#endregion
