"use strict";

import "adaptive-extender/core";

//#region Bytes tool
export class BytesTool {
	static concat(pieces: readonly Uint8Array[]): Uint8Array {
		const total = pieces.reduce((sum, piece) => sum + piece.length, 0);
		const result = new Uint8Array(total);
		let cursor = 0;
		for (const piece of pieces) {
			result.set(piece, cursor);
			cursor += piece.length;
		}
		return result;
	}
}
//#endregion
