"use strict";

import "adaptive-extender/node";
import { URI } from "adaptive-extender/node";
import AsyncFileSystem from "node:fs/promises";
import { Vocabulary } from "../../telegram-theme-converter/models/vocabulary.js";
import { RuleTable } from "../../telegram-theme-converter/models/rule-table.js";
import { ServerCodec } from "../../telegram-theme-converter/services/server-codec.js";

//#region Test data
export class TestData {
	static #fixtures: URI = new URI("./fixtures/", import.meta.url);
	static #data: URI = new URI("../../resources/data/", import.meta.url);
	static #rules: string = "telegram-conversion-rules.json";
	static #wallpaper: Uint8Array = new Uint8Array([
		0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
		0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
	]);

	static #codec: ServerCodec = new ServerCodec();

	static get wallpaper(): Uint8Array { return TestData.#wallpaper; }
	static get codec(): ServerCodec { return TestData.#codec; }

	static async fixture(name: string): Promise<Uint8Array> {
		const buffer = await AsyncFileSystem.readFile(new URI(name, TestData.#fixtures).toPath());
		return new Uint8Array(buffer);
	}

	static async vocabulary(name: string): Promise<Vocabulary> {
		return Vocabulary.import(await TestData.#json(name), name);
	}

	static async rules(): Promise<RuleTable> {
		const name = TestData.#rules;
		return RuleTable.import(await TestData.#json(name), name);
	}

	static async #json(name: string): Promise<unknown> {
		const text = await AsyncFileSystem.readFile(new URI(name, TestData.#data).toPath(), "utf-8");
		return JSON.parse(text);
	}
}
//#endregion
