"use strict";

import "adaptive-extender/web";
import { type BufferedCell } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";

//#region Settings service
export class SettingsService {
	#repository: BufferedCell<typeof Settings>;

	constructor() {
		this.#repository = localStorage.openBufferedCell("Personal webpage\\209 birthdays\\Settings", Settings, new Settings);
	}

	readSelection(): number {
		const repository = this.#repository;
		return repository.content.selection;
	}

	async writeSelection(index: number): Promise<void> {
		if (index < 0) return;
		const repository = this.#repository;
		repository.content.selection = index;
		await repository.save(1000);
	}
}
//#endregion
