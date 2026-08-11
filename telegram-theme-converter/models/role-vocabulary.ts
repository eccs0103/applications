"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";
import { Role } from "./role.js";

//#region Role vocabulary
export class RoleVocabulary extends Model {
	@Field(Array.Of(Role), { name: "roles" })
	roles: Role[] = [];

	#byName: Map<string, Role> | null = null;

	#index(): Map<string, Role> {
		if (this.#byName !== null) return this.#byName;
		const index = new Map<string, Role>();
		for (const role of this.roles) {
			if (index.has(role.name)) throw new TypeError(`Duplicate role '${role.name}'`);
			index.set(role.name, role);
		}
		for (const role of this.roles) {
			if (role.parent !== null && !index.has(role.parent)) throw new TypeError(`Role '${role.name}' names unknown parent '${role.parent}'`);
		}
		this.#byName = index;
		return index;
	}

	get size(): number {
		return this.roles.length;
	}

	has(name: string): boolean {
		return this.#index().has(name);
	}

	get(name: string): Role {
		return ReferenceError.suppress(this.#index().get(name), `Unknown role '${name}'`);
	}

	names(): Set<string> {
		return new Set(this.#index().keys());
	}

	roots(): readonly Role[] {
		return this.roles.filter(role => role.parent === null);
	}

	/**
	 * Returns the root-ward chain of role names starting at `name` itself and ending at a root.
	 * @throws {TypeError} If the role graph has a cycle reachable from `name`.
	 */
	chain(name: string): readonly string[] {
		this.#index();
		const chain: string[] = [];
		const seen = new Set<string>();
		let current: string | null = name;
		while (current !== null) {
			if (seen.has(current)) throw new TypeError(`Role graph has a cycle at '${current}'`);
			seen.add(current);
			chain.push(current);
			current = this.get(current).parent;
		}
		return chain;
	}
}
//#endregion
