"use strict";

import "adaptive-extender/web";
import { Controller, MetadataInjector, Timespan } from "adaptive-extender/web";
import { BirthdaysRenderer } from "../view/birthdays-renderer.js";
import { ClientBridge } from "../services/client-bridge.js";
import { type Bridge } from "../services/bridge.js";
import { Group, type GroupMember } from "../models/group.js";
import { SettingsService } from "../services/settings-service.js";
import { Timer } from "../services/timer.js";

const { baseURI, body } = document;

//#region App controller
class AppController extends Controller {
	#bridge: Bridge = new ClientBridge();
	#renderer: BirthdaysRenderer;
	#timer: Timer;
	#settings: SettingsService;

	#members: GroupMember[] = [];
	#selectionIndex: number = 0;
	#selectionMember: GroupMember | null = null;

	constructor() {
		super();
		this.#renderer = new BirthdaysRenderer(body);
		this.#timer = new Timer({ multiple: false });
		this.#settings = new SettingsService();
	}

	async #readGroup(url: Readonly<URL>): Promise<Group> {
		const content = await this.#bridge.read(url);
		if (content === null) throw new ReferenceError();
		const object = JSON.parse(content);
		return Group.load(object, "database-2025.json");
	}

	async run(): Promise<void> {
		const group = await this.#readGroup(new URL("../data/database-2025.json", baseURI));
		this.#members = group.members
			.sort((member1: GroupMember, member2: GroupMember) => member1.birthday.getDate() - member2.birthday.getDate())
			.sort((member1: GroupMember, member2: GroupMember) => member1.birthday.getMonth() - member2.birthday.getMonth());

		this.#selectionIndex = this.#settings.readSelection();
		this.#selectionMember = this.#members.at(this.#selectionIndex) ?? null;

		await this.#renderer.initialize();
		await this.#renderer.render(this.#members);

		this.#renderer.addEventListener("selectionchange", this.#onSelectionChange.bind(this));
		this.#renderer.addEventListener("selectioncommit", this.#onSelectionCommit.bind(this));
		this.#timer.addEventListener("trigger", this.#onTimerTrigger.bind(this));

		this.#renderer.setInitialSelection(this.#selectionIndex);
		this.#updateSelection(this.#selectionMember, false);
		this.#onSelectionCommit();

		MetadataInjector.inject({
			type: "Person",
			name: "eccs0103",
			webpage: new URL("https://eccs.dev"),
			preview: new URL("../icons/cake.png", baseURI),
			associations: [],
			job: "Software engineer",
			description: "209 birthdays application.",
		});
	}

	#updateSelection(member: GroupMember | null, animate: boolean): void {
		this.#selectionMember = member;

		if (member === null) {
			return this.#renderer.updateContent(String.empty, String.empty, false);
		}

		const date = new Date();
		date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
		const now = Number(date);
		const { birthday } = member;
		const begin = birthday.setFullYear(date.getFullYear());
		const end = birthday.setDate(birthday.getDate() + 1);
		const wish = member.askWish();

		if (wish !== null) {
			const [member, content] = wish;
			return this.#renderer.updateContent(content, member.name, animate, 5000);
		}

		const timespan = Timespan.fromValue(begin - now);
		const { days, hours, minutes, seconds } = timespan.duration();
		const negativity = timespan.valueOf() < 0;
		return this.#renderer.updateContent(`${negativity ? "Անցավ" : "Մնաց"} ${days}օր ${hours}ժ․ ${minutes}ր․ ${seconds}վ․`, String.empty, false, 1000);
	}

	#onSelectionChange(event: CustomEvent<GroupMember | null>): void {
		this.#updateSelection(event.detail, false);
	}

	#onSelectionCommit(): void {
		const memberSelection = this.#selectionMember;
		if (memberSelection === null) return;
		const index = this.#members.indexOf(memberSelection);
		void this.#settings.writeSelection(index);
	}

	#onTimerTrigger(): void {
		this.#updateSelection(this.#selectionMember, true);
	}

	async catch(error: Error): Promise<void> {
		console.error(error);
	}
}
//#endregion

await AppController.launch();
