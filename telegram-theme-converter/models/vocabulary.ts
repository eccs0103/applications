"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";
import { PaletteEntry } from "./palette-entry.js";

//#region Vocabulary
export class Vocabulary extends Model {
	@Field(Array.Of(PaletteEntry), { name: "entries" })
	entries: PaletteEntry[] = [];

	#byName: Map<string, PaletteEntry> | null = null;

	#index(): Map<string, PaletteEntry> {
		if (this.#byName !== null) return this.#byName;
		const index = new Map<string, PaletteEntry>();
		for (const entry of this.entries) {
			if (index.has(entry.name)) throw new TypeError(`Duplicate vocabulary entry '${entry.name}'`);
			index.set(entry.name, entry);
		}
		this.#byName = index;
		return index;
	}

	get size(): number {
		return this.entries.length;
	}

	has(name: string): boolean {
		return this.#index().has(name);
	}

	get(name: string): PaletteEntry {
		return ReferenceError.suppress(this.#index().get(name), `Unknown vocabulary key '${name}'`);
	}

	names(): Set<string> {
		return new Set(this.#index().keys());
	}

	missingFrom(names: ReadonlySet<string>): Set<string> {
		const missing = new Set<string>();
		for (const name of this.#index().keys()) {
			if (!names.has(name)) missing.add(name);
		}
		return missing;
	}

	unknownIn(names: ReadonlySet<string>): Set<string> {
		const unknown = new Set<string>();
		for (const name of names) {
			if (!this.has(name)) unknown.add(name);
		}
		return unknown;
	}

	isComplete(names: ReadonlySet<string>): boolean {
		return this.missingFrom(names).size === 0 && this.unknownIn(names).size === 0;
	}
}
//#endregion
