"use strict";

import "adaptive-extender/worker";
import { BirthdayDatabase, type BirthdayHolder } from "../models/birthday-database.js";
import { ReminderExpert } from "./reminder-expert.js";

declare const self: ServiceWorkerGlobalScope;

//#region Birthday service worker
class BirthdayServiceWorker {
	constructor() {
		self.addEventListener("install", () => {
			self.skipWaiting();
		});

		self.addEventListener("activate", (event) => {
			event.waitUntil(self.clients.claim());
		});

		self.addEventListener("push", (event) => {
			event.waitUntil(this.#notifyReminders());
		});

		self.addEventListener("notificationclick", (event) => {
			event.notification.close();
			event.waitUntil(this.#focusApplication());
		});
	}

	async #readMembers(): Promise<BirthdayHolder[]> {
		const cache: RequestCache = "no-store";
		const response = await fetch("/data/database-2025.json", { cache });
		const content = await response.text();
		const object = JSON.parse(content);
		const database = BirthdayDatabase.import(object, "database-2025.json");
		return database.members;
	}

	#reminderText(member: BirthdayHolder, days: number): [string, string] {
		if (days === 0) return [`🎂 ${member.fullName}`, "Այսօր ծնունդն է!"];
		const month: "long" = "long";
		const day: "numeric" = "numeric";
		const date = member.birthday.toLocaleDateString("hy", { month, day });
		return [`📅 ${member.fullName}`, `${days} օրից ծնունդն է (${date})`];
	}

	async #notifyFallback(): Promise<void> {
		const body: string = "Ստուգեք ծնունդների ցուցակը";
		const icon: string = "/icons/cake.png";
		const badge: string = "/icons/cake.png";
		await self.registration.showNotification("🎂 209", { body, icon, badge });
	}

	async #notifyReminders(): Promise<void> {
		try {
			const members = await this.#readMembers();
			const reminders = ReminderExpert.findReminders(members, new Date());
			if (reminders.length === 0) return await this.#notifyFallback();
			for (const [member, days] of reminders) {
				const [title, body] = this.#reminderText(member, days);
				const icon: string = "/icons/cake.png";
				const badge: string = "/icons/cake.png";
				await self.registration.showNotification(title, { body, icon, badge });
			}
		} catch (reason) {
			console.error(`Reminder notification failed:\n${Error.from(reason)}`);
			await this.#notifyFallback();
		}
	}

	async #focusApplication(): Promise<WindowClient | undefined> {
		const type: ClientTypes = "window";
		const includeUncontrolled: boolean = true;
		const clients = await self.clients.matchAll({ type, includeUncontrolled });
		const existing = clients.find(client => client.url.includes("/209-birthdays/"));
		if (existing !== undefined) return existing.focus();
		await self.clients.openWindow("/209-birthdays/");
		return undefined;
	}
}

new BirthdayServiceWorker();
//#endregion
