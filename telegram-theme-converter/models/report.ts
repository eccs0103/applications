"use strict";

import "adaptive-extender/core";

//#region Report
export enum KeyOutcome {
	direct = "direct",
	anchored = "anchored",
	dropped = "dropped",
}

export class Report {
	#outcomes: Map<string, KeyOutcome> = new Map();

	record(key: string, outcome: KeyOutcome): void {
		if (this.#outcomes.has(key)) throw new TypeError(`Key '${key}' already recorded in this report`);
		this.#outcomes.set(key, outcome);
	}

	keysBy(outcome: KeyOutcome): string[] {
		const keys: string[] = [];
		for (const [key, recorded] of this.#outcomes) {
			if (recorded === outcome) keys.push(key);
		}
		return keys.sort();
	}

	countBy(outcome: KeyOutcome): number {
		return this.keysBy(outcome).length;
	}

	get size(): number {
		return this.#outcomes.size;
	}
}
//#endregion
