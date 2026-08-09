"use strict";

import "adaptive-extender/core";
import { type Bridge } from "./bridge.js";
import { Vocabulary } from "../models/vocabulary.js";
import { RuleTable } from "../models/rule-table.js";

//#region Vocabulary service
export class VocabularyService {
	static #nameAndroidVocabulary: string = "telegram-android-vocabulary.json";
	static #nameDesktopVocabulary: string = "telegram-desktop-vocabulary.json";
	static #nameRules: string = "telegram-conversion-rules.json";

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

	async loadAndroidVocabulary(): Promise<Vocabulary> {
		return Vocabulary.import(await this.#readJson(VocabularyService.#nameAndroidVocabulary), VocabularyService.#nameAndroidVocabulary);
	}

	async loadDesktopVocabulary(): Promise<Vocabulary> {
		return Vocabulary.import(await this.#readJson(VocabularyService.#nameDesktopVocabulary), VocabularyService.#nameDesktopVocabulary);
	}

	async loadRuleTable(): Promise<RuleTable> {
		return RuleTable.import(await this.#readJson(VocabularyService.#nameRules), VocabularyService.#nameRules);
	}
}
//#endregion
