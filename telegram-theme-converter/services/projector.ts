"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";
import { type Platform } from "../models/platform.js";
import { type RoleVocabulary } from "../models/role-vocabulary.js";
import { Report, KeyOutcome } from "../models/report.js";

//#region Projector
/**
 * Projects lifted role values onto a target platform's keys.
 * Every projected value is a verbatim copy, never a computed one: for each target key this walks
 * the key's role chain root-ward and copies the nearest populated ancestor's value, recording
 * whether the key's own role held a value (`bound`) or an ancestor's did (`inherited`). Nothing is
 * ever fabricated from a vocabulary default - a key whose entire chain is unpopulated throws,
 * because every root role is required to carry an authority binding on every platform.
 */
export class Projector {
	static project(values: ReadonlyMap<string, Color>, platform: Readonly<Platform>, roles: Readonly<RoleVocabulary>, report: Report): Map<string, Color> {
		const colors = new Map<string, Color>();

		for (const entry of platform.vocabulary.entries) {
			const role = platform.bindings.roleFor(entry.name);
			const chain = roles.chain(role);

			const resolved = chain.find(candidate => values.has(candidate));
			if (resolved === undefined) throw new ReferenceError(`Key '${entry.name}' resolves to role '${role}', whose chain [${chain.join(" -> ")}] has no lifted value on platform '${platform.id}'`);

			colors.set(entry.name, ReferenceError.suppress(values.get(resolved), `Role '${resolved}' vanished mid-projection`));
			report.record(entry.name, resolved === role ? KeyOutcome.bound : KeyOutcome.inherited, resolved);
		}

		return colors;
	}
}
//#endregion
