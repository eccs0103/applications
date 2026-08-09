"use strict";

import "adaptive-extender/core";

//#region Key outcome
/**
 * What happened to a single target-platform key during a conversion.
 */
export enum KeyOutcome {
	/** Copied from a directly-paired source key (the bijective core). */
	direct = "direct",
	/** Produced by an anchored derivation from a core key. */
	anchored = "anchored",
	/** A source key with no counterpart in the target vocabulary; excluded from the output. */
	dropped = "dropped",
}
//#endregion
//#region Report
/**
 * A per-key account of a single conversion: what happened to every key involved, and the
 * summary counts derived from that ledger. Nothing about a conversion is ever discarded -
 * every key the source or target vocabulary mentions appears here exactly once.
 */
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
