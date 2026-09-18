"use strict";

import "adaptive-extender/web";
import { VapidKey } from "../models/vapid-key.js";
import { NotificationState } from "../models/notification-state.js";

//#region Notification service
export class NotificationService {
	static #pushWorkerOrigin: string = "https://birthdays-push.eccs.dev";
	#synchronized: boolean = false;

	static #urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
		const padding = "=".repeat((4 - (base64.length % 4)) % 4);
		const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
		const raw = atob(base64Safe);
		const bytes = new Uint8Array(raw.length);
		for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
		return bytes;
	}

	get supported(): boolean { return "serviceWorker" in navigator && "PushManager" in window; }
	get permission(): NotificationPermission { return Notification.permission; }

	async #getRegistration(): Promise<ServiceWorkerRegistration> {
		const type: WorkerType = "module";
		return await navigator.serviceWorker.register("/service-worker.js", { type });
	}

	async #postSubscription(subscription: PushSubscription): Promise<void> {
		const method: string = "POST";
		const headers: HeadersInit = { ["Content-Type"]: "application/json" };
		const body: BodyInit = JSON.stringify(subscription);
		const response = await fetch(`${NotificationService.#pushWorkerOrigin}/api/subscribe`, { method, headers, body });
		if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
		this.#synchronized = true;
	}

	async #fetchServerKey(): Promise<Uint8Array<ArrayBuffer>> {
		const response = await fetch(`${NotificationService.#pushWorkerOrigin}/api/vapid`);
		if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
		const content = await response.text();
		const object = JSON.parse(content);
		const { key } = VapidKey.import(object, "vapid-key");
		return NotificationService.#urlBase64ToUint8Array(key);
	}

	async #subscribeWithKey(registration: ServiceWorkerRegistration, key: Uint8Array<ArrayBuffer>): Promise<void> {
		const userVisibleOnly: boolean = true;
		const applicationServerKey: BufferSource = key;
		const subscription = await registration.pushManager.subscribe({ userVisibleOnly, applicationServerKey });
		await this.#postSubscription(subscription);
	}

	static #matchesKey(subscription: PushSubscription, key: Uint8Array<ArrayBuffer>): boolean {
		const currentKey = subscription.options.applicationServerKey;
		if (currentKey === null) return false;
		const currentBytes = new Uint8Array(currentKey);
		if (currentBytes.length !== key.length) return false;
		for (let index = 0; index < key.length; index++) {
			if (currentBytes[index] !== key[index]) return false;
		}
		return true;
	}

	async #registerSubscription(): Promise<void> {
		const registration = await this.#getRegistration();
		await navigator.serviceWorker.ready;
		const key = await this.#fetchServerKey();
		await this.#subscribeWithKey(registration, key);
	}

	async subscribe(): Promise<void> {
		const permission = await Notification.requestPermission();
		if (permission !== "granted") throw new Error("Notification permission denied");
		await this.#registerSubscription();
	}

	/**
	 * Re-sends the current browser subscription to the server, or creates one if none exists.
	 * Idempotent (the server keys by endpoint), so it's safe to call on every load to repair a subscription the server lost track of.
	 * Also detects a subscription signed under a key the server no longer advertises (e.g. after a VAPID key
	 * rotation) and transparently replaces it — the old subscription can never deliver again, so it must be recreated.
	 */
	async synchronize(): Promise<void> {
		if (this.permission !== "granted") throw new TypeError("Notification permission not granted");
		const registration = await this.#getRegistration();
		await navigator.serviceWorker.ready;
		const key = await this.#fetchServerKey();

		const subscription = await registration.pushManager.getSubscription();
		if (subscription === null) return await this.#subscribeWithKey(registration, key);
		if (NotificationService.#matchesKey(subscription, key)) return await this.#postSubscription(subscription);

		await subscription.unsubscribe();
		await this.#subscribeWithKey(registration, key);
	}

	/**
	 * Resolves the notification state as known to the server, not just the browser —
	 * `pending` means permission is granted but the last subscribe/synchronize hasn't confirmed the server holds it.
	 */
	async state(): Promise<NotificationState> {
		if (!this.supported) return NotificationState.idle;
		const permission = this.permission;
		if (permission === "default") return NotificationState.idle;
		if (permission === "denied") return NotificationState.denied;
		if (this.#synchronized) return NotificationState.ready;
		return NotificationState.pending;
	}
}
//#endregion
