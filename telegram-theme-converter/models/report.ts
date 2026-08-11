"use strict";

import "adaptive-extender/core";

//#region Report
export enum KeyOutcome {
	/** The key's own role held a lifted value. */
	bound = "bound",
	/** The key's role held no value; the nearest populated ancestor role was copied instead. */
	inherited = "inherited",
	/** A source key that is not an authority for its role, and so was never consulted while lifting. */
	unread = "unread",
}

interface ReportEntry {
	outcome: KeyOutcome;
	detail: string | null;
}

export class Report {
	#entries: Map<string, ReportEntry> = new Map();

	record(key: string, outcome: KeyOutcome, detail: string | null = null): void {
		if (this.#entries.has(key)) throw new TypeError(`Key '${key}' already recorded in this report`);
		this.#entries.set(key, { outcome, detail });
	}

	keysBy(outcome: KeyOutcome): string[] {
		const keys: string[] = [];
		for (const [key, entry] of this.#entries) {
			if (entry.outcome === outcome) keys.push(key);
		}
		return keys.sort();
	}

	countBy(outcome: KeyOutcome): number {
		return this.keysBy(outcome).length;
	}

	/** The role a key's value ultimately resolved to: its own role if `bound`, else the inherited ancestor. Null for `unread`. */
	detailFor(key: string): string | null {
		return ReferenceError.suppress(this.#entries.get(key), `Key '${key}' not recorded in this report`).detail;
	}

	get size(): number {
		return this.#entries.size;
	}
}
//#endregion
