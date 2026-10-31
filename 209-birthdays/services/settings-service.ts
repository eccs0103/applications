"use strict";

import "adaptive-extender/web";
import { type BufferedCell } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { LegacyCell } from "./legacy-cell.js";

//#region Settings service
export class SettingsService {
	#repository: BufferedCell<typeof Settings>;

	constructor() {
		LegacyCell.migrate("Personal webpage\\209 birthdays\\Settings", "209 birthdays\\Settings");
		this.#repository = localStorage.openBufferedCell("209 birthdays\\Settings", Settings, new Settings());
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
