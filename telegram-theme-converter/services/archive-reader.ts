"use strict";

import "adaptive-extender/core";

const signatureLocalFile = 0x04034b50;
const signatureCentralDirectory = 0x02014b50;
const signatureEndOfCentralDirectory = 0x06054b50;
const lengthEndOfCentralDirectory = 22;

//#region Archive reader
/**
 * Reads a ZIP archive - the container format `.tdesktop-theme` files use - well enough to
 * list and decompress its entries. Supports the two compression methods a theme ZIP ever
 * contains: stored (0) and deflate (8).
 */
export class ArchiveReader {
	static async #inflate(bytes: Readonly<Uint8Array>): Promise<Uint8Array> {
		const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
		const buffer = await new Response(stream).arrayBuffer();
		return new Uint8Array(buffer);
	}

	static #findEndOfCentralDirectory(bytes: Readonly<Uint8Array>): number {
		for (let index = bytes.length - lengthEndOfCentralDirectory; index >= 0; index--) {
			const view = new DataView(bytes.buffer, bytes.byteOffset + index, lengthEndOfCentralDirectory);
			if (view.getUint32(0, true) === signatureEndOfCentralDirectory) return index;
		}
		throw new SyntaxError("End of central directory record not found");
	}

	/**
	 * @throws {SyntaxError} If the bytes are not a well-formed ZIP archive.
	 * @throws {TypeError} If an entry uses a compression method other than stored or deflate.
	 */
	static async read(bytes: Readonly<Uint8Array>): Promise<Map<string, Uint8Array>> {
		const eocdOffset = ArchiveReader.#findEndOfCentralDirectory(bytes);
		const eocd = new DataView(bytes.buffer, bytes.byteOffset + eocdOffset, lengthEndOfCentralDirectory);
		const entryCount = eocd.getUint16(10, true);
		const centralDirectoryOffset = eocd.getUint32(16, true);

		const entries = new Map<string, Uint8Array>();
		let cursor = centralDirectoryOffset;
		for (let index = 0; index < entryCount; index++) {
			const header = new DataView(bytes.buffer, bytes.byteOffset + cursor, 46);
			if (header.getUint32(0, true) !== signatureCentralDirectory) throw new SyntaxError(`Invalid central directory header at offset ${cursor}`);

			const method = header.getUint16(10, true);
			const compressedSize = header.getUint32(20, true);
			const nameLength = header.getUint16(28, true);
			const extraLength = header.getUint16(30, true);
			const commentLength = header.getUint16(32, true);
			const localHeaderOffset = header.getUint32(42, true);
			const name = new TextDecoder("utf-8").decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));

			const localHeader = new DataView(bytes.buffer, bytes.byteOffset + localHeaderOffset, 30);
			if (localHeader.getUint32(0, true) !== signatureLocalFile) throw new SyntaxError(`Invalid local file header for entry '${name}'`);
			const localNameLength = localHeader.getUint16(26, true);
			const localExtraLength = localHeader.getUint16(28, true);
			const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
			const raw = bytes.subarray(dataStart, dataStart + compressedSize);

			if (method === 0) entries.set(name, new Uint8Array(raw));
			else if (method === 8) entries.set(name, await ArchiveReader.#inflate(raw));
			else throw new TypeError(`Unsupported compression method ${method} for entry '${name}'`);

			cursor += 46 + nameLength + extraLength + commentLength;
		}
		return entries;
	}

	/**
	 * Case-insensitively finds the first entry whose name matches one of the given candidates.
	 */
	static find(entries: ReadonlyMap<string, Uint8Array>, candidates: readonly string[]): [string, Uint8Array] | null {
		const lowered = candidates.map(candidate => candidate.toLowerCase());
		for (const [name, content] of entries) {
			if (lowered.includes(name.toLowerCase())) return [name, content];
		}
		return null;
	}
}
//#endregion
