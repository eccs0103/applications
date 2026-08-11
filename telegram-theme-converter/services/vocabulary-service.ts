"use strict";

import "adaptive-extender/core";
import { type Bridge } from "./bridge.js";
import { Vocabulary } from "../models/vocabulary.js";
import { RoleVocabulary } from "../models/role-vocabulary.js";
import { BindingTable } from "../models/binding-table.js";
import { AndroidPlatform, DesktopPlatform } from "../models/platform.js";

//#region Vocabulary service
export class VocabularyService {
	static #nameAndroidVocabulary: string = "telegram-android-vocabulary.json";
	static #nameDesktopVocabulary: string = "telegram-desktop-vocabulary.json";
	static #nameRoles: string = "telegram-theme-roles.json";
	static #nameAndroidBindings: string = "telegram-android-bindings.json";
	static #nameDesktopBindings: string = "telegram-desktop-bindings.json";

	#bridge: Bridge;
	#baseURI: Readonly<URL>;

	constructor(bridge: Bridge, baseURI: Readonly<URL>) {
		this.#bridge = bridge;
		this.#baseURI = baseURI;
	}

	async #readJson(name: string): Promise<any> {
		const url = new URL(`../data/${name}`, this.#baseURI);
		const content = await this.#bridge.read(url);
		if (content === null) throw new ReferenceError(`Missing data file '${name}'`);
		return JSON.parse(content);
	}

	async loadRoles(): Promise<RoleVocabulary> {
		return RoleVocabulary.import(await this.#readJson(VocabularyService.#nameRoles), VocabularyService.#nameRoles);
	}

	async loadAndroidPlatform(): Promise<AndroidPlatform> {
		const [vocabulary, bindings] = await Promise.all([
			Vocabulary.import(await this.#readJson(VocabularyService.#nameAndroidVocabulary), VocabularyService.#nameAndroidVocabulary),
			BindingTable.import(await this.#readJson(VocabularyService.#nameAndroidBindings), VocabularyService.#nameAndroidBindings),
		]);
		return new AndroidPlatform(vocabulary, bindings);
	}

	async loadDesktopPlatform(): Promise<DesktopPlatform> {
		const [vocabulary, bindings] = await Promise.all([
			Vocabulary.import(await this.#readJson(VocabularyService.#nameDesktopVocabulary), VocabularyService.#nameDesktopVocabulary),
			BindingTable.import(await this.#readJson(VocabularyService.#nameDesktopBindings), VocabularyService.#nameDesktopBindings),
		]);
		return new DesktopPlatform(vocabulary, bindings);
	}
}
//#endregion
