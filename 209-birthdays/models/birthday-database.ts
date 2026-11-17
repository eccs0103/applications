"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

const { round } = Math;

//#region Birthday holder
export class BirthdayHolder extends Model {
	static #dayLength: number = 24 * 60 * 60 * 1000;

	@Field(String, { name: "name" })
	name: string;

	@Field(String, { name: "surname" })
	surname: string;

	@Field(Date, { name: "birthday" })
	birthday: Date;

	get fullName(): string { return `${this.name} ${this.surname}`; }

	#dayNumber(year: number, month: number, day: number): number {
		const timestamp = new Date(year, month, day).getTime();
		if (new Date(timestamp).getMonth() === month) return timestamp;
		return this.#dayNumber(year, month, day - 1);
	}

	daysUntil(today: Date): number {
		const dayLength = BirthdayHolder.#dayLength;
		const month = this.birthday.getMonth();
		const day = this.birthday.getDate();
		const year = today.getFullYear();
		const now = this.#dayNumber(year, today.getMonth(), today.getDate());

		const current = this.#dayNumber(year, month, day);
		if (current >= now) return round((current - now) / dayLength);

		const next = this.#dayNumber(year + 1, month, day);
		return round((next - now) / dayLength);
	}
}
//#endregion
//#region Birthday database
export class BirthdayDatabase extends Model {
	static #offsets: readonly number[] = [0, 3];

	@Field(Array.Of(BirthdayHolder), { name: "members" })
	members: BirthdayHolder[];

	reminders(today: Date): [BirthdayHolder, number][] {
		const reminders: [BirthdayHolder, number][] = [];
		for (const member of this.members) {
			const days = member.daysUntil(today);
			if (!BirthdayDatabase.#offsets.includes(days)) continue;
			reminders.push([member, days]);
		}
		return reminders;
	}
}
//#endregion
