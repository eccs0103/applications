"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";
import { Rule, RuleOrigin } from "./rule.js";

//#region Rule table
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
				continue;
			}
			if (byAndroidTarget.has(rule.target)) throw new TypeError(`Duplicate anchored rule for Android key '${rule.target}'`);
			byAndroidTarget.set(rule.target, rule);
		}
		this.#byDesktopTarget = byDesktopTarget;
		this.#byAndroidSource = byAndroidSource;
		this.#byAndroidTarget = byAndroidTarget;
	}

	directRuleForDesktopKey(key: string): Rule {
		this.#index();
		const byDesktopTarget = ReferenceError.suppress(this.#byDesktopTarget, "RuleTable index not built");
		return ReferenceError.suppress(byDesktopTarget.get(key), `No direct rule targets Desktop key '${key}'`);
	}

	directRuleForAndroidSource(key: string): Rule | null {
		this.#index();
		const byAndroidSource = ReferenceError.suppress(this.#byAndroidSource, "RuleTable index not built");
		const rule = byAndroidSource.get(key);
		if (rule === undefined) return null;
		return rule;
	}

	anchoredRuleForAndroidKey(key: string): Rule | null {
		this.#index();
		const byAndroidTarget = ReferenceError.suppress(this.#byAndroidTarget, "RuleTable index not built");
		const rule = byAndroidTarget.get(key);
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
