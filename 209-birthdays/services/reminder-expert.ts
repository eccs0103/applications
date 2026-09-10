"use strict";

import "adaptive-extender/core";
import { type BirthdayHolder } from "../models/birthday-database.js";

//#region Reminder expert
export class ReminderExpert {
	static #offsets: readonly number[] = [0, 3];

	/**
	 * Finds members whose next birthday falls exactly on one of the reminder offsets (0 = today, 3 = in three days) from `today`.
	 */
	static findReminders(members: readonly BirthdayHolder[], today: Date): [BirthdayHolder, number][] {
		const reminders: [BirthdayHolder, number][] = [];
		for (const member of members) {
			const days = member.daysUntil(today);
			if (!ReminderExpert.#offsets.includes(days)) continue;
			reminders.push([member, days]);
		}
		return reminders;
	}
}
//#endregion
