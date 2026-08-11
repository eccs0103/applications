"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";
import { Binding } from "./binding.js";

//#region Binding table
export class BindingTable extends Model {
	@Field(String, { name: "platform" })
	platform: string;

	@Field(Array.Of(Binding), { name: "bindings" })
	bindings: Binding[] = [];

	#byKey: Map<string, Binding> | null = null;
	#authorityByRole: Map<string, Binding> | null = null;
	#keysByRole: Map<string, string[]> | null = null;

	#index(): void {
		if (this.#byKey !== null) return;
		const byKey = new Map<string, Binding>();
		const authorityByRole = new Map<string, Binding>();
		const keysByRole = new Map<string, string[]>();

		for (const binding of this.bindings) {
			if (byKey.has(binding.key)) throw new TypeError(`Duplicate binding for key '${binding.key}' in platform '${this.platform}'`);
			byKey.set(binding.key, binding);

			let keys = keysByRole.get(binding.role);
			if (keys === undefined) {
				keys = [];
				keysByRole.set(binding.role, keys);
			}
			keys.push(binding.key);

			if (!binding.authority) continue;
			if (authorityByRole.has(binding.role)) throw new TypeError(`Duplicate authority binding for role '${binding.role}' in platform '${this.platform}'`);
			authorityByRole.set(binding.role, binding);
		}

		this.#byKey = byKey;
		this.#authorityByRole = authorityByRole;
		this.#keysByRole = keysByRole;
	}

	get size(): number {
		return this.bindings.length;
	}

	has(key: string): boolean {
		this.#index();
		return ReferenceError.suppress(this.#byKey, "BindingTable index not built").has(key);
	}

	roleFor(key: string): string {
		this.#index();
		const byKey = ReferenceError.suppress(this.#byKey, "BindingTable index not built");
		return ReferenceError.suppress(byKey.get(key), `Platform '${this.platform}' has no binding for key '${key}'`).role;
	}

	authorityKeyFor(role: string): string | null {
		this.#index();
		const authorityByRole = ReferenceError.suppress(this.#authorityByRole, "BindingTable index not built");
		const binding = authorityByRole.get(role);
		if (binding === undefined) return null;
		return binding.key;
	}

	isAuthority(key: string): boolean {
		return this.authorityKeyFor(this.roleFor(key)) === key;
	}

	keysFor(role: string): readonly string[] {
		this.#index();
		const keysByRole = ReferenceError.suppress(this.#keysByRole, "BindingTable index not built");
		return keysByRole.get(role) ?? [];
	}

	keys(): readonly string[] {
		return this.bindings.map(binding => binding.key);
	}

	roles(): Set<string> {
		return new Set(this.bindings.map(binding => binding.role));
	}
}
//#endregion
