"use strict";

import "adaptive-extender/core";

//#region Codec
export interface Codec {
	encode(text: string): Uint8Array;
	decode(bytes: Readonly<Uint8Array>): string;
	deflate(bytes: Readonly<Uint8Array>): Promise<Uint8Array>;
	inflate(bytes: Readonly<Uint8Array>): Promise<Uint8Array>;
}
//#endregion
