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

	get supported(): boolean {
		return "serviceWorker" in navigator && "PushManager" in window;
	}

	get permission(): NotificationPermission {
		return Notification.permission;
	}

	async #getRegistration(): Promise<ServiceWorkerRegistration> {
		return await navigator.serviceWorker.register("/service-worker.js", { type: "module" });
	}

	async #postSubscription(subscription: PushSubscription): Promise<void> {
		const response = await fetch(`${NotificationService.#pushWorkerOrigin}/api/subscribe`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(subscription),
		});
		if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
		this.#synchronized = true;
	}

	async #registerSubscription(): Promise<void> {
		const registration = await this.#getRegistration();
		await navigator.serviceWorker.ready;

		const response = await fetch(`${NotificationService.#pushWorkerOrigin}/api/vapid`);
		if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
		const content = await response.text();
		const object = JSON.parse(content);
		const { key } = VapidKey.import(object, "vapid-key");

		const subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: NotificationService.#urlBase64ToUint8Array(key),
		});

		await this.#postSubscription(subscription);
	}

	async subscribe(): Promise<void> {
		const permission = await Notification.requestPermission();
		if (permission !== "granted") throw new Error("Notification permission denied");
		await this.#registerSubscription();
	}

	/**
	 * Re-sends the current browser subscription to the server, or creates one if none exists.
	 * Idempotent (the server keys by endpoint), so it's safe to call on every load to repair a subscription the server lost track of.
	 */
	async synchronize(): Promise<void> {
		if (this.permission !== "granted") throw new TypeError("Notification permission not granted");
		const registration = await this.#getRegistration();
		await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		if (subscription === null) return await this.#registerSubscription();
		await this.#postSubscription(subscription);
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
