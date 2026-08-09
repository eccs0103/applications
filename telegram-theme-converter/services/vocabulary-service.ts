"use strict";

import "adaptive-extender/core";
import { type Bridge } from "./bridge.js";
import { Vocabulary } from "../models/vocabulary.js";
import { RuleTable } from "../models/rule-table.js";

const nameAndroidVocabulary = "telegram-android-vocabulary.json";
const nameDesktopVocabulary = "telegram-desktop-vocabulary.json";
const nameRules = "telegram-conversion-rules.json";

//#region Vocabulary service
/**
 * Loads the two canonical vocabularies and the conversion rule table from `resources/data/`.
 */
export class VocabularyService {
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
		return Vocabulary.import(await this.#readJson(nameAndroidVocabulary), nameAndroidVocabulary);
	}

	async loadDesktopVocabulary(): Promise<Vocabulary> {
		return Vocabulary.import(await this.#readJson(nameDesktopVocabulary), nameDesktopVocabulary);
	}

	async loadRuleTable(): Promise<RuleTable> {
		return RuleTable.import(await this.#readJson(nameRules), nameRules);
	}
}
//#endregion
