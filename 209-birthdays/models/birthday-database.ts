"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

const { round } = Math;

//#region Birthday holder
export class BirthdayHolder extends Model {
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

	/**
	 * Returns the number of days until the next occurrence of this birthday, relative to `today`.
	 */
	daysUntil(today: Date): number {
		const millisecondsPerDay = 24 * 60 * 60 * 1000;
		const month = this.birthday.getMonth();
		const day = this.birthday.getDate();
		const year = today.getFullYear();
		const todayNumber = this.#dayNumber(year, today.getMonth(), today.getDate());

		const occurrenceThisYear = this.#dayNumber(year, month, day);
		if (occurrenceThisYear >= todayNumber) return round((occurrenceThisYear - todayNumber) / millisecondsPerDay);

		const occurrenceNextYear = this.#dayNumber(year + 1, month, day);
		return round((occurrenceNextYear - todayNumber) / millisecondsPerDay);
	}
}
//#endregion
//#region Birthday database
export class BirthdayDatabase extends Model {
	@Field(Array.Of(BirthdayHolder), { name: "members" })
	members: BirthdayHolder[];
}
//#endregion
