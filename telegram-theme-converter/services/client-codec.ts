"use strict";

import "adaptive-extender/web";
import { type Codec } from "./codec.js";

//#region Client codec
export class ClientCodec implements Codec {
	encode(text: string): Uint8Array {
		return new TextEncoder().encode(text);
	}

	decode(bytes: Readonly<Uint8Array>): string {
		return new TextDecoder("utf-8").decode(bytes);
	}

	async deflate(bytes: Readonly<Uint8Array>): Promise<Uint8Array> {
		const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
		const buffer = await new Response(stream).arrayBuffer();
		return new Uint8Array(buffer);
	}

	async inflate(bytes: Readonly<Uint8Array>): Promise<Uint8Array> {
		const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
		const buffer = await new Response(stream).arrayBuffer();
		return new Uint8Array(buffer);
	}
}
//#endregion
