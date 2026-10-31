"use strict";

import "adaptive-extender/web";

//#region Legacy cell
/**
 * Moves a localStorage value from an old key to its two-part key. Call it before the new cell opens.
 * @deprecated Migration only. Remove once no browser keeps the old key.
 */
export class LegacyCell {
	static migrate(source: string, target: string): void {
		const text = localStorage.getItem(source);
		if (text === null) return;
		localStorage.setItem(target, text);
		localStorage.removeItem(source);
	}
}
//#endregion
