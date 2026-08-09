"use strict";

import "adaptive-extender/core";
import { Field, Model, Enum, Nullable } from "adaptive-extender/core";
import { Color } from "adaptive-extender/core";

//#region Rule origin
/**
 * How a target key's value is produced.
 */
export enum RuleOrigin {
	/** The target key is part of the 586-key bijective core: a direct, hand-authored 1:1 correspondence. */
	direct = "direct",
	/** The target key has no counterpart in the other platform; its value is derived from an anchor key that is part of the core. */
	anchored = "anchored",
}
//#endregion
//#region Transform
/**
 * The relationship an anchored key's value has to its anchor's value, fitted against both
 * the light and dark official sample pairs.
 */
export enum Transform {
	/** The target equals its anchor exactly. */
	identity = "identity",
	/** The target equals its anchor with alpha replaced by {@link Rule.parameter} (an absolute value in [0 - 1]). */
	alpha = "alpha",
	/** The target equals its anchor with lightness replaced by {@link Rule.parameter} (an absolute value in [0 - 1]). */
	lightness = "lightness",
	/** The target is a mix of its anchor and {@link Rule.mixWith}, weighted by {@link Rule.parameter} toward the latter. */
	mix = "mix",
}
//#endregion
//#region Rule
/**
 * One conversion rule: how to produce a single target-platform key's value.
 *
 * For a `direct` rule, {@link source} names the paired key on the other platform and the
 * value is copied as-is. For an `anchored` rule, {@link source} names the anchor key -
 * itself part of the bijective core - and {@link transform} together with {@link parameter}
 * (and, for `mix`, {@link mixWith}) describe how the anchor's own value is reshaped.
 */
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

	/**
	 * Resolves this rule's target color given a lookup into the source platform's colors.
	 * @throws {ReferenceError} If a color this rule depends on is missing from `colors`.
	 * @throws {TypeError} If an `anchored` rule is missing the fields its transform requires.
	 */
	resolve(colors: ReadonlyMap<string, Color>): Color {
		const anchor = colors.get(this.source);
		if (anchor === undefined) throw new ReferenceError(`Rule for '${this.target}' depends on missing color '${this.source}'`);

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
				const second = colors.get(this.mixWith);
				if (second === undefined) throw new ReferenceError(`Rule for '${this.target}' depends on missing color '${this.mixWith}'`);
				return Color.mix(anchor, second, this.parameter);
			}
			default: throw new TypeError(`Rule for '${this.target}' is 'anchored' without a transform`);
		}
	}
}
//#endregion
