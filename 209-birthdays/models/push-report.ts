"use strict";

import "adaptive-extender/core";

//#region Push report
export enum PushOutcome {
	delivered = "delivered",
	expired = "expired",
	rejected = "rejected",
}

export class PushReport {
	#due: readonly string[];
	#outcomes: Map<string, PushOutcome> = new Map();

	constructor(due: readonly string[]) {
		this.#due = due;
	}

	record(endpoint: string, outcome: PushOutcome): void {
		const outcomes = this.#outcomes;
		if (outcomes.has(endpoint)) throw new TypeError(`Endpoint '${endpoint}' already recorded in this report`);
		outcomes.set(endpoint, outcome);
	}

	countBy(outcome: PushOutcome): number {
		let count = 0;
		for (const recorded of this.#outcomes.values()) {
			if (recorded === outcome) count++;
		}
		return count;
	}

	get size(): number { return this.#outcomes.size; }

	describe(): string {
		const due = this.#due;
		const delivered = this.countBy(PushOutcome.delivered);
		const expired = this.countBy(PushOutcome.expired);
		const rejected = this.countBy(PushOutcome.rejected);
		return `Reminder run: ${due.length} due (${due.join(", ")}), ${delivered} delivered, ${expired} expired, ${rejected} rejected.`;
	}

	toJSON(): object {
		return {
			due: this.#due,
			delivered: this.countBy(PushOutcome.delivered),
			expired: this.countBy(PushOutcome.expired),
			rejected: this.countBy(PushOutcome.rejected),
		};
	}
}
//#endregion
