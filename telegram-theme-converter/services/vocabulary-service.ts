"use strict";

import "adaptive-extender/core";
import { URI } from "adaptive-extender/core";
import { type Bridge } from "./bridge.js";
import { Vocabulary } from "../models/vocabulary.js";
import { RuleTable } from "../models/rule-table.js";

//#region Vocabulary service
export class VocabularyService {
	static #android: string = "telegram-android-vocabulary.json";
	static #desktop: string = "telegram-desktop-vocabulary.json";
	static #rules: string = "telegram-conversion-rules.json";

	#bridge: Bridge;
	#baseURI: Readonly<URI>;

	constructor(bridge: Bridge, baseURI: Readonly<URI>) {
		this.#bridge = bridge;
		this.#baseURI = baseURI;
	}

	async #read(name: string): Promise<any> {
		const uri = new URI(`../data/${name}`, this.#baseURI);
		const content = ReferenceError.suppress(await this.#bridge.read(uri), `Missing data file '${name}'`);
		return JSON.parse(content);
	}

	async loadAndroidVocabulary(): Promise<Vocabulary> {
		const android = VocabularyService.#android;
		return Vocabulary.import(await this.#read(android), android);
	}

	async loadDesktopVocabulary(): Promise<Vocabulary> {
		const desktop = VocabularyService.#desktop;
		return Vocabulary.import(await this.#read(desktop), desktop);
	}

	async loadRuleTable(): Promise<RuleTable> {
		const rules = VocabularyService.#rules;
		return RuleTable.import(await this.#read(rules), rules);
	}
}
//#endregion
