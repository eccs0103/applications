"use strict";

import "adaptive-extender/worker";
import { BirthdayDatabase, type BirthdayHolder } from "../models/birthday-database.js";
import { ReminderExpert } from "./reminder-expert.js";

declare const self: ServiceWorkerGlobalScope;

//#region Birthday service worker
class BirthdayServiceWorker {
	constructor() {
		self.addEventListener("push", (event) => {
			event.waitUntil(this.#notifyReminders());
		});

		self.addEventListener("notificationclick", (event) => {
			event.notification.close();
			event.waitUntil(this.#focusApplication());
		});
	}

	async #readMembers(): Promise<BirthdayHolder[]> {
		const response = await fetch("/data/database-2025.json");
		const content = await response.text();
		const object = JSON.parse(content);
		const database = BirthdayDatabase.import(object, "database-2025.json");
		return database.members;
	}

	#reminderText(member: BirthdayHolder, days: number): [title: string, body: string] {
		if (days === 0) return [`🎂 ${member.fullName}`, "Այսօր ծննունդն է!"];
		const date = member.birthday.toLocaleDateString("hy", { month: "long", day: "numeric" });
		return [`📅 ${member.fullName}`, `${days} օրից ծննունդն է (${date})`];
	}

	async #notifyReminders(): Promise<void> {
		const members = await this.#readMembers();
		const reminders = ReminderExpert.findReminders(members, new Date());
		for (const [member, days] of reminders) {
			const [title, body] = this.#reminderText(member, days);
			await self.registration.showNotification(title, { body, icon: "/icons/cake.png" });
		}
	}

	async #focusApplication(): Promise<WindowClient | undefined> {
		const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
		const existing = clients.find(client => client.url.includes("/209-birthdays/"));
		if (existing !== undefined) return existing.focus();
		await self.clients.openWindow("/209-birthdays/");
		return undefined;
	}
}

new BirthdayServiceWorker();
//#endregion
