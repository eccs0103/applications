"use strict";

import "adaptive-extender/core";
import { SubscriptionRecord } from "../models/subscription-record.js";

//#region Subscription store
export class SubscriptionStore {
	#namespace: KVNamespace;

	constructor(namespace: KVNamespace) {
		this.#namespace = namespace;
	}

	/**
	 * Validates and stores a subscription, returning its endpoint, or `null` if the payload is malformed.
	 */
	async save(text: string): Promise<string | null> {
		const object = JSON.parse(text);
		try {
			const subscription = SubscriptionRecord.import(object, "subscription");
			await this.#namespace.put(subscription.endpoint, text);
			return subscription.endpoint;
		} catch {
			return null;
		}
	}

	async remove(endpoint: string): Promise<void> {
		await this.#namespace.delete(endpoint);
	}

	async listEndpoints(): Promise<string[]> {
		const { keys } = await this.#namespace.list();
		return keys.map(key => key.name);
	}
}
//#endregion
