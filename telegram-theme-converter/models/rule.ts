"use strict";

import "adaptive-extender/core";
import { Field, Model, Enum, Nullable } from "adaptive-extender/core";
import { Color } from "adaptive-extender/core";

//#region Rule
export enum RuleOrigin {
	direct = "direct",
	anchored = "anchored",
}

export enum Transform {
	identity = "identity",
	alpha = "alpha",
	lightness = "lightness",
	mix = "mix",
}

export class Rule extends Model {
	@Field(String, { name: "target" })
	target: string;

	@Field(String, { name: "source" })
	source: string;

	@Field(Enum.Of(RuleOrigin), { name: "origin" })
	origin: RuleOrigin = RuleOrigin.direct;

	@Field(Nullable.Of(Enum.Of(Transform)), { name: "transform" })
	transform: Transform | null = null;

	@Field(Nullable.Of(Number), { name: "parameter" })
	parameter: number | null = null;

	@Field(Nullable.Of(String), { name: "mixWith" })
	mixWith: string | null = null;

	resolve(colors: ReadonlyMap<string, Color>): Color {
		const anchor = ReferenceError.suppress(colors.get(this.source), `Rule for '${this.target}' depends on missing color '${this.source}'`);

		if (this.origin === RuleOrigin.direct) return new Color(anchor);

		switch (this.transform) {
		case Transform.identity: return new Color(anchor);
		case Transform.alpha: {
			if (this.parameter === null) throw new TypeError(`Rule for '${this.target}' uses 'alpha' without a parameter`);
			return new Color(anchor).pass(this.parameter);
		}
		case Transform.lightness: {
			if (this.parameter === null) throw new TypeError(`Rule for '${this.target}' uses 'lightness' without a parameter`);
			return new Color(anchor).illuminate(this.parameter);
		}
		case Transform.mix: {
			if (this.parameter === null) throw new TypeError(`Rule for '${this.target}' uses 'mix' without a parameter`);
			if (this.mixWith === null) throw new TypeError(`Rule for '${this.target}' uses 'mix' without 'mixWith'`);
			const second = ReferenceError.suppress(colors.get(this.mixWith), `Rule for '${this.target}' depends on missing color '${this.mixWith}'`);
			return Color.mix(anchor, second, this.parameter);
		}
		default: throw new TypeError(`Rule for '${this.target}' is 'anchored' without a transform`);
		}
	}
}
//#endregion
