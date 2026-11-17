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

	async #enroll(registration: ServiceWorkerRegistration, key: Uint8Array<ArrayBuffer>): Promise<void> {
		const userVisibleOnly: boolean = true;
		const applicationServerKey: BufferSource = key;
		const subscription = await registration.pushManager.subscribe({ userVisibleOnly, applicationServerKey });
		await this.#postSubscription(subscription);
	}

	static #matches(subscription: PushSubscription, key: Uint8Array<ArrayBuffer>): boolean {
		const current = subscription.options.applicationServerKey;
		if (current === null) return false;
		const bytes = new Uint8Array(current);
		if (bytes.length !== key.length) return false;
		for (let index = 0; index < key.length; index++) {
			if (bytes[index] !== key[index]) return false;
		}
		return true;
	}

	async #registerSubscription(): Promise<void> {
		const registration = await this.#getRegistration();
		await navigator.serviceWorker.ready;
		const key = await this.#fetchServerKey();
		await this.#enroll(registration, key);
	}

	async subscribe(): Promise<void> {
		const permission = await Notification.requestPermission();
		if (permission !== "granted") throw new Error("Notification permission denied");
		await this.#registerSubscription();
	}

	async synchronize(): Promise<void> {
		if (this.permission !== "granted") throw new TypeError("Notification permission not granted");
		const registration = await this.#getRegistration();
		await navigator.serviceWorker.ready;
		const key = await this.#fetchServerKey();

		const subscription = await registration.pushManager.getSubscription();
		if (subscription === null) return await this.#enroll(registration, key);
		if (NotificationService.#matches(subscription, key)) return await this.#postSubscription(subscription);

		await subscription.unsubscribe();
		await this.#enroll(registration, key);
	}

	async state(): Promise<NotificationState> {
		if (!this.supported) return NotificationState.idle;
		const permission = this.permission;
		if (permission === "default") return NotificationState.idle;
		if (permission === "denied") return NotificationState.denied;
		if (this.#synchronized) return NotificationState.ready;
		return NotificationState.pending;
	}

	async toggle(): Promise<NotificationState> {
		try {
			const state = await this.state();
			if (state !== NotificationState.ready) await this.subscribe();
		} catch (reason) {
			console.error(Error.from(reason));
		}
		return await this.state();
	}

	async bootstrap(): Promise<NotificationState> {
		if (this.permission !== "granted") return await this.state();
		try {
			await this.synchronize();
		} catch (reason) {
			console.error(Error.from(reason));
		}
		return await this.state();
	}
}
//#endregion
