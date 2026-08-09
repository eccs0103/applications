"use strict";

import "adaptive-extender/core";
import { BytesTool } from "./bytes.js";

export interface ArchiveEntry {
	name: string;
	content: Uint8Array;
	stored: boolean;
}

//#region Archive writer
export class ArchiveWriter {
	static #signatureLocalFile: number = 0x04034b50;
	static #signatureCentralDirectory: number = 0x02014b50;
	static #signatureEndOfCentralDirectory: number = 0x06054b50;
	static #dosDateEpoch: number = 0b0000000000100001;

	static #crcTable: Uint32Array | null = null;

	static #table(): Uint32Array {
		if (ArchiveWriter.#crcTable !== null) return ArchiveWriter.#crcTable;
		const table = new Uint32Array(256);
		for (let index = 0; index < 256; index++) {
			let value = index;
			for (let bit = 0; bit < 8; bit++) value = (value & 1) === 1 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
			table[index] = value >>> 0;
		}
		ArchiveWriter.#crcTable = table;
		return table;
	}

	static #crc32(bytes: Readonly<Uint8Array>): number {
		const table = ArchiveWriter.#table();
		let crc = 0xffffffff;
		for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
		return (crc ^ 0xffffffff) >>> 0;
	}

	static async #deflate(bytes: Readonly<Uint8Array>): Promise<Uint8Array> {
		const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
		const buffer = await new Response(stream).arrayBuffer();
		return new Uint8Array(buffer);
	}

	static async write(entries: readonly ArchiveEntry[]): Promise<Uint8Array> {
		const encoder = new TextEncoder();
		const localChunks: Uint8Array[] = [];
		const centralChunks: Uint8Array[] = [];
		let offset = 0;

		for (const entry of entries) {
			const nameBytes = encoder.encode(entry.name);
			const crc = ArchiveWriter.#crc32(entry.content);
			const compressed = entry.stored ? entry.content : await ArchiveWriter.#deflate(entry.content);
			const method = entry.stored ? 0 : 8;

			const localHeader = new DataView(new ArrayBuffer(30));
			localHeader.setUint32(0, ArchiveWriter.#signatureLocalFile, true);
			localHeader.setUint16(4, 20, true);
			localHeader.setUint16(6, 0, true);
			localHeader.setUint16(8, method, true);
			localHeader.setUint16(10, 0, true);
			localHeader.setUint16(12, ArchiveWriter.#dosDateEpoch, true);
			localHeader.setUint32(14, crc, true);
			localHeader.setUint32(18, compressed.length, true);
			localHeader.setUint32(22, entry.content.length, true);
			localHeader.setUint16(26, nameBytes.length, true);
			localHeader.setUint16(28, 0, true);
			localChunks.push(new Uint8Array(localHeader.buffer), nameBytes, compressed);

			const centralHeader = new DataView(new ArrayBuffer(46));
			centralHeader.setUint32(0, ArchiveWriter.#signatureCentralDirectory, true);
			centralHeader.setUint16(4, 20, true);
			centralHeader.setUint16(6, 20, true);
			centralHeader.setUint16(8, 0, true);
			centralHeader.setUint16(10, method, true);
			centralHeader.setUint16(12, 0, true);
			centralHeader.setUint16(14, ArchiveWriter.#dosDateEpoch, true);
			centralHeader.setUint32(16, crc, true);
			centralHeader.setUint32(20, compressed.length, true);
			centralHeader.setUint32(24, entry.content.length, true);
			centralHeader.setUint16(28, nameBytes.length, true);
			centralHeader.setUint16(30, 0, true);
			centralHeader.setUint16(32, 0, true);
			centralHeader.setUint16(34, 0, true);
			centralHeader.setUint16(36, 0, true);
			centralHeader.setUint32(38, 0, true);
			centralHeader.setUint32(42, offset, true);
			centralChunks.push(new Uint8Array(centralHeader.buffer), nameBytes);

			offset += 30 + nameBytes.length + compressed.length;
		}

		const centralDirectoryOffset = offset;
		const centralDirectoryBytes = BytesTool.concat(centralChunks);

		const eocd = new DataView(new ArrayBuffer(22));
		eocd.setUint32(0, ArchiveWriter.#signatureEndOfCentralDirectory, true);
		eocd.setUint16(4, 0, true);
		eocd.setUint16(6, 0, true);
		eocd.setUint16(8, entries.length, true);
		eocd.setUint16(10, entries.length, true);
		eocd.setUint32(12, centralDirectoryBytes.length, true);
		eocd.setUint32(16, centralDirectoryOffset, true);
		eocd.setUint16(20, 0, true);

		return BytesTool.concat([...localChunks, centralDirectoryBytes, new Uint8Array(eocd.buffer)]);
	}
}
//#endregion
