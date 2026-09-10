"use strict";

import { describe, it, expect } from "vitest";
import { BirthdayHolder } from "../models/birthday-database.js";
import { ReminderExpert } from "../services/reminder-expert.js";

function member(name: string, birthday: string): BirthdayHolder {
	return BirthdayHolder.import({ name, surname: String.empty, birthday }, "test-member");
}

describe("ReminderExpert.findReminders", () => {
	it("includes a member whose birthday is today", () => {
		const today = new Date(2026, 4, 17);
		const arman = member("Արման", "2004-05-17");
		const [[, days]] = ReminderExpert.findReminders([arman], today);
		expect(days).toBe(0);
	});

	it("includes a member whose birthday is in three days", () => {
		const today = new Date(2026, 4, 14);
		const arman = member("Արման", "2004-05-17");
		const [[, days]] = ReminderExpert.findReminders([arman], today);
		expect(days).toBe(3);
	});

	it("excludes a member whose birthday is neither today nor in three days", () => {
		const today = new Date(2026, 4, 10);
		const arman = member("Արման", "2004-05-17");
		expect(ReminderExpert.findReminders([arman], today)).toEqual([]);
	});

	it("wraps across the year boundary", () => {
		const today = new Date(2026, 11, 30);
		const member1 = member("Գևորգ", "2004-01-02");
		const [[, days]] = ReminderExpert.findReminders([member1], today);
		expect(days).toBe(3);
	});

	it("treats a leap-day birthday as February 28th in a non-leap year", () => {
		const today = new Date(2027, 1, 28);
		const member1 = member("Անահիտ", "2000-02-29");
		const [[, days]] = ReminderExpert.findReminders([member1], today);
		expect(days).toBe(0);
	});

	it("keeps a leap-day birthday on February 29th in a leap year", () => {
		const today = new Date(2028, 1, 29);
		const member1 = member("Անահիտ", "2000-02-29");
		const [[, days]] = ReminderExpert.findReminders([member1], today);
		expect(days).toBe(0);
	});
});
