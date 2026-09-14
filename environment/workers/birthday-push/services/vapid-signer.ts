"use strict";

import "adaptive-extender/core";

const { trunc } = Math;

//#region Vapid signer
export class VapidSigner {
	#publicKey: string;
	#privateKey: string;

	static #ttlSeconds: number = 43200;
	static #subject: string = "https://birthdays-push.eccs.dev";

	constructor(publicKey: string, privateKey: string) {
		this.#publicKey = publicKey;
		this.#privateKey = privateKey;
	}

	static #base64UrlEncode(bytes: Uint8Array): string {
		let binary = String.empty;
		for (const byte of bytes) binary += String.fromCharCode(byte);
		return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", String.empty);
	}

	static #encodeJson(value: unknown): string {
		return VapidSigner.#base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
	}

	async #importPrivateKey(): Promise<CryptoKey> {
		const jwk = JSON.parse(this.#privateKey);
		return await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
	}

	/**
	 * Builds the `Authorization` header value for a push request to the given subscription endpoint.
	 */
	async authorization(endpoint: string): Promise<string> {
		const audience = new URL(endpoint).origin;
		const header = VapidSigner.#encodeJson({ typ: "JWT", alg: "ES256" });
		const expiration = trunc(Date.now() / 1000) + VapidSigner.#ttlSeconds;
		const payload = VapidSigner.#encodeJson({ aud: audience, exp: expiration, sub: VapidSigner.#subject });
		const unsigned = `${header}.${payload}`;

		const privateKey = await this.#importPrivateKey();
		const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(unsigned));
		const jwt = `${unsigned}.${VapidSigner.#base64UrlEncode(new Uint8Array(signature))}`;

		return `vapid t=${jwt}, k=${this.#publicKey}`;
	}
}
//#endregion
