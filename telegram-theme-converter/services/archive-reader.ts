"use strict";

import "adaptive-extender/core";

//#region Archive reader
export class ArchiveReader {
	static #signatureLocalFile: number = 0x04034b50;
	static #signatureCentralDirectory: number = 0x02014b50;
	static #signatureEndOfCentralDirectory: number = 0x06054b50;
	static #lengthEndOfCentralDirectory: number = 22;

	static async #inflate(bytes: Readonly<Uint8Array>): Promise<Uint8Array> {
		const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
		const buffer = await new Response(stream).arrayBuffer();
		return new Uint8Array(buffer);
	}

	static async #decodeEntry(method: number, raw: Readonly<Uint8Array>, name: string): Promise<Uint8Array> {
		if (method === 0) return new Uint8Array(raw);
		if (method === 8) return ArchiveReader.#inflate(raw);
		throw new TypeError(`Unsupported compression method ${method} for entry '${name}'`);
	}

	static #findEndOfCentralDirectory(bytes: Readonly<Uint8Array>): number {
		for (let index = bytes.length - ArchiveReader.#lengthEndOfCentralDirectory; index >= 0; index--) {
			const view = new DataView(bytes.buffer, bytes.byteOffset + index, ArchiveReader.#lengthEndOfCentralDirectory);
			if (view.getUint32(0, true) === ArchiveReader.#signatureEndOfCentralDirectory) return index;
		}
		throw new SyntaxError("End of central directory record not found");
	}

	static async read(bytes: Readonly<Uint8Array>): Promise<Map<string, Uint8Array>> {
		const eocdOffset = ArchiveReader.#findEndOfCentralDirectory(bytes);
		const eocd = new DataView(bytes.buffer, bytes.byteOffset + eocdOffset, ArchiveReader.#lengthEndOfCentralDirectory);
		const entryCount = eocd.getUint16(10, true);
		const centralDirectoryOffset = eocd.getUint32(16, true);

		const entries = new Map<string, Uint8Array>();
		let cursor = centralDirectoryOffset;
		for (let index = 0; index < entryCount; index++) {
			const header = new DataView(bytes.buffer, bytes.byteOffset + cursor, 46);
			if (header.getUint32(0, true) !== ArchiveReader.#signatureCentralDirectory) throw new SyntaxError(`Invalid central directory header at offset ${cursor}`);

			const method = header.getUint16(10, true);
			const sizeCompressed = header.getUint32(20, true);
			const nameLength = header.getUint16(28, true);
			const extraLength = header.getUint16(30, true);
			const commentLength = header.getUint16(32, true);
			const localHeaderOffset = header.getUint32(42, true);
			const name = new TextDecoder("utf-8").decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));

			const localHeader = new DataView(bytes.buffer, bytes.byteOffset + localHeaderOffset, 30);
			if (localHeader.getUint32(0, true) !== ArchiveReader.#signatureLocalFile) throw new SyntaxError(`Invalid local file header for entry '${name}'`);
			const localNameLength = localHeader.getUint16(26, true);
			const localExtraLength = localHeader.getUint16(28, true);
			const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
			const raw = bytes.subarray(dataStart, dataStart + sizeCompressed);

			entries.set(name, await ArchiveReader.#decodeEntry(method, raw, name));

			cursor += 46 + nameLength + extraLength + commentLength;
		}
		return entries;
	}

	static find(entries: ReadonlyMap<string, Uint8Array>, candidates: readonly string[]): [string, Uint8Array] | null {
		const lowered = candidates.map(candidate => candidate.toLowerCase());
		for (const [name, content] of entries) {
			if (lowered.includes(name.toLowerCase())) return [name, content];
		}
		return null;
	}
}
//#endregion
