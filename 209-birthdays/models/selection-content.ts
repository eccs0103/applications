"use strict";

import "adaptive-extender/web";
import { Timespan } from "adaptive-extender/web";
import { type GroupMember } from "./group.js";

//#region Selection content
/**
 * What the selection display shows for the current member: either a wish someone left them, or the live countdown to their birthday.
 */
export class SelectionContent {
	title: string;
	auxiliary: string;
	delay: number;
	animate: boolean;

	constructor(title: string, auxiliary: string, delay: number, animate: boolean) {
		this.title = title;
		this.auxiliary = auxiliary;
		this.delay = delay;
		this.animate = animate;
	}

	static empty(): SelectionContent {
		return new SelectionContent(String.empty, String.empty, 0, false);
	}

	static fromWish(author: GroupMember, wish: string, animate: boolean): SelectionContent {
		return new SelectionContent(wish, author.name, 3000, animate);
	}

	static fromCountdown(member: GroupMember): SelectionContent {
		const date = new Date();
		date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
		const now = Number(date);
		const birthday = new Date(member.birthday);
		const begin = birthday.setFullYear(date.getFullYear());

		const timespan = Timespan.fromValue(begin - now);
		const { days, hours, minutes, seconds } = timespan.duration();
		const negativity = timespan.valueOf() < 0;
		const title = `${negativity ? "Անցավ" : "Մնաց"} ${days}օր ${hours}ժ․ ${minutes}ր․ ${seconds}վ․`;
		return new SelectionContent(title, String.empty, 1000, false);
	}

	static next(generator: Generator<[GroupMember, string], null> | null, member: GroupMember, animate: boolean): SelectionContent {
		if (generator === null) return SelectionContent.fromCountdown(member);
		const result = generator.next();
		if (result.done) return SelectionContent.fromCountdown(member);
		const [author, text] = result.value;
		return SelectionContent.fromWish(author, text, animate);
	}
}
//#endregion
