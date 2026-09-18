"use strict";

import "adaptive-extender/core";
import { type SubscriptionStore } from "./subscription-store.js";
import { type VapidSigner } from "./vapid-signer.js";
import { PushReport, PushOutcome } from "../models/push-report.js";

//#region Push dispatcher
export class PushDispatcher {
	#store: SubscriptionStore;
	#signer: VapidSigner;

	static #ttl: string = "86400";

	constructor(store: SubscriptionStore, signer: VapidSigner) {
		this.#store = store;
		this.#signer = signer;
	}

	async broadcast(due: readonly string[]): Promise<PushReport> {
		const endpoints = await this.#store.listEndpoints();
		const report = new PushReport(due);
		for (const endpoint of endpoints) report.record(endpoint, await this.#send(endpoint));
		return report;
	}

	async #send(endpoint: string): Promise<PushOutcome> {
		try {
			const authorization = await this.#signer.authorization(endpoint);
			const response = await fetch(endpoint, { method: "POST", headers: { Authorization: authorization, TTL: PushDispatcher.#ttl } });
			if (response.ok) return PushOutcome.delivered;
			if (response.status === 404 || response.status === 410) {
				await this.#store.remove(endpoint);
				return PushOutcome.expired;
			}
			const body = await response.text();
			console.error(`Push failed for '${endpoint}': ${response.status} ${response.statusText} — ${body}`);
			return PushOutcome.rejected;
		} catch (reason) {
			console.error(`Push failed for '${endpoint}':\n${Error.from(reason)}`);
			return PushOutcome.rejected;
		}
	}
}
//#endregion
