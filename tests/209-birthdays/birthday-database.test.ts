"use strict";

import "adaptive-extender/node";
import { describe, it, expect } from "vitest";
import { BirthdayDatabase } from "../../209-birthdays/models/birthday-database.js";

function database(name: string, birthday: string): BirthdayDatabase {
	return BirthdayDatabase.import({ members: [{ name, surname: String.empty, birthday }] }, "test-database");
}

describe("BirthdayDatabase.reminders", () => {
	it("includes a member whose birthday is today", () => {
		const today = new Date(2026, 4, 17);
		const [[, days]] = database("Արման", "2004-05-17").reminders(today);
		expect(days).toBe(0);
	});

	it("includes a member whose birthday is in three days", () => {
		const today = new Date(2026, 4, 14);
		const [[, days]] = database("Արման", "2004-05-17").reminders(today);
		expect(days).toBe(3);
	});

	it("excludes a member whose birthday is neither today nor in three days", () => {
		const today = new Date(2026, 4, 10);
		expect(database("Արման", "2004-05-17").reminders(today)).toEqual([]);
	});

	it("wraps across the year boundary", () => {
		const today = new Date(2026, 11, 30);
		const [[, days]] = database("Գևորգ", "2004-01-02").reminders(today);
		expect(days).toBe(3);
	});

	it("treats a leap-day birthday as February 28th in a non-leap year", () => {
		const today = new Date(2027, 1, 28);
		const [[, days]] = database("Անահիտ", "2000-02-29").reminders(today);
		expect(days).toBe(0);
	});

	it("keeps a leap-day birthday on February 29th in a leap year", () => {
		const today = new Date(2028, 1, 29);
		const [[, days]] = database("Անահիտ", "2000-02-29").reminders(today);
		expect(days).toBe(0);
	});

	it("fires the 3-day reminder for a birthday on the 18th when today is the 15th", () => {
		const today = new Date(2026, 8, 15);
		const [[, days]] = database("Անահիտ", "2004-09-18").reminders(today);
		expect(days).toBe(3);
	});
});
