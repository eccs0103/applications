"use strict";

import "adaptive-extender/core";
import { type SubscriptionStore } from "./subscription-store.js";
import { type VapidSigner } from "./vapid-signer.js";

//#region Push dispatcher
export class PushDispatcher {
	#store: SubscriptionStore;
	#signer: VapidSigner;

	static #ttl: string = "86400";

	constructor(store: SubscriptionStore, signer: VapidSigner) {
		this.#store = store;
		this.#signer = signer;
	}

	async broadcast(): Promise<void> {
		const endpoints = await this.#store.listEndpoints();
		for (const endpoint of endpoints) await this.#send(endpoint);
	}

	async #send(endpoint: string): Promise<void> {
		try {
			const authorization = await this.#signer.authorization(endpoint);
			const response = await fetch(endpoint, { method: "POST", headers: { Authorization: authorization, TTL: PushDispatcher.#ttl } });
			if (response.status !== 404 && response.status !== 410) return;
			await this.#store.remove(endpoint);
		} catch (reason) {
			console.error(`Push failed for '${endpoint}':\n${Error.from(reason)}`);
		}
	}
}
//#endregion
