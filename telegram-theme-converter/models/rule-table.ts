"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";
import { Rule, RuleOrigin } from "./rule.js";

//#region Rule table
/**
 * The full conversion rule set: the 586-key bijective Desktop<->Android core, read forward
 * (by Desktop target) or backward (by Android source), plus the anchored derivations for the
 * Android keys the core does not cover. Owns every lookup a converter needs - callers never
 * scan {@link rules} themselves.
 */
export class RuleTable extends Model {
	@Field(Array.Of(Rule), { name: "rules" })
	rules: Rule[] = [];

	#byDesktopTarget: Map<string, Rule> | null = null;
	#byAndroidSource: Map<string, Rule> | null = null;
	#byAndroidTarget: Map<string, Rule> | null = null;

	#index(): void {
		if (this.#byDesktopTarget !== null) return;
		const byDesktopTarget = new Map<string, Rule>();
		const byAndroidSource = new Map<string, Rule>();
		const byAndroidTarget = new Map<string, Rule>();
		for (const rule of this.rules) {
			if (rule.origin === RuleOrigin.direct) {
				if (byDesktopTarget.has(rule.target)) throw new TypeError(`Duplicate direct rule for Desktop key '${rule.target}'`);
				byDesktopTarget.set(rule.target, rule);
				if (byAndroidSource.has(rule.source)) throw new TypeError(`Duplicate direct rule sourcing Android key '${rule.source}'`);
				byAndroidSource.set(rule.source, rule);
			} else {
				if (byAndroidTarget.has(rule.target)) throw new TypeError(`Duplicate anchored rule for Android key '${rule.target}'`);
				byAndroidTarget.set(rule.target, rule);
			}
		}
		this.#byDesktopTarget = byDesktopTarget;
		this.#byAndroidSource = byAndroidSource;
		this.#byAndroidTarget = byAndroidTarget;
	}

	/**
	 * The core rule producing the given Desktop key.
	 * @throws {ReferenceError} If no core rule targets this Desktop key.
	 */
	directRuleForDesktopKey(desktopKey: string): Rule {
		this.#index();
		const rule = this.#byDesktopTarget!.get(desktopKey);
		if (rule === undefined) throw new ReferenceError(`No direct rule targets Desktop key '${desktopKey}'`);
		return rule;
	}

	/**
	 * The core rule sourced from the given Android key, or `null` if that key is not part of
	 * the bijective core (i.e. it is a surplus key with only an anchored rule).
	 */
	directRuleForAndroidSource(androidKey: string): Rule | null {
		this.#index();
		const rule = this.#byAndroidSource!.get(androidKey);
		if (rule === undefined) return null;
		return rule;
	}

	/**
	 * The anchored rule producing the given surplus Android key, or `null` if that key is part
	 * of the bijective core instead.
	 */
	anchoredRuleForAndroidKey(androidKey: string): Rule | null {
		this.#index();
		const rule = this.#byAndroidTarget!.get(androidKey);
		if (rule === undefined) return null;
		return rule;
	}

	directRules(): readonly Rule[] {
		return this.rules.filter(rule => rule.origin === RuleOrigin.direct);
	}

	anchoredRules(): readonly Rule[] {
		return this.rules.filter(rule => rule.origin === RuleOrigin.anchored);
	}
}
//#endregion
