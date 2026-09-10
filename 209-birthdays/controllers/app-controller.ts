"use strict";

import "adaptive-extender/web";
import { Controller, MetadataInjector, Timespan } from "adaptive-extender/web";
import { BirthdaysRenderer } from "../view/birthdays-renderer.js";
import { ClientBridge } from "../services/client-bridge.js";
import { type Bridge } from "../services/bridge.js";
import { Group, type GroupMember } from "../models/group.js";
import { SettingsService } from "../services/settings-service.js";
import { Timer } from "../services/timer.js";
import { NotificationService } from "../services/notification-service.js";

const { baseURI, body } = document;

//#region App controller
class AppController extends Controller {
	#bridge: Bridge = new ClientBridge();
	#renderer: BirthdaysRenderer = new BirthdaysRenderer(body);
	#timer: Timer = new Timer({ multiple: false });
	#settings: SettingsService = new SettingsService();
	#notifications: NotificationService = new NotificationService();

	#members: GroupMember[] = [];
	#selectionIndex: number = 0;
	#selectionMember: GroupMember | null = null;
	#wishGenerator: Generator<[GroupMember, string], null> | null = null;

	async #readGroup(url: Readonly<URL>): Promise<Group> {
		const content = await this.#bridge.read(url);
		if (content === null) throw new ReferenceError();
		const object = JSON.parse(content);
		return Group.load(object, "database-2025.json");
	}

	#resolveSelection(index: number): GroupMember | null {
		const member = this.#members.at(index);
		if (member === undefined) return null;
		return member;
	}

	#createWishGenerator(member: GroupMember | null): Generator<[GroupMember, string], null> | null {
		if (member === null) return null;
		return member.askWishes();
	}

	#nextWish(): [GroupMember, string] | null {
		const generator = this.#wishGenerator;
		if (generator === null) return null;
		const { value, done } = generator.next();
		if (done) return null;
		return value;
	}

	async run(): Promise<void> {
		const group = await this.#readGroup(new URL("../data/database-2025.json", baseURI));
		this.#members = group.members
			.sort((member1: GroupMember, member2: GroupMember) => member1.birthday.getDate() - member2.birthday.getDate())
			.sort((member1: GroupMember, member2: GroupMember) => member1.birthday.getMonth() - member2.birthday.getMonth());

		this.#selectionIndex = this.#settings.readSelection();
		this.#selectionMember = this.#resolveSelection(this.#selectionIndex);
		this.#wishGenerator = this.#createWishGenerator(this.#selectionMember);

		await this.#renderer.initialize();
		await this.#renderer.render(this.#members);

		this.#renderer.addEventListener("selectionchange", this.#onSelectionChange.bind(this));
		this.#renderer.addEventListener("selectioncommit", this.#onSelectionCommit.bind(this));
		this.#renderer.addEventListener("notificationstoggle", this.#onNotificationsToggle.bind(this));
		this.#timer.addEventListener("trigger", this.#onTimerTrigger.bind(this));

		this.#renderer.setInitialSelection(this.#selectionIndex);
		this.#updateSelection(this.#selectionMember, false);
		this.#onSelectionCommit();

		this.#renderer.setNotificationsSupported(this.#notifications.supported);
		await this.#refreshNotificationsLabel();

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
		const renderer = this.#renderer;
		const timer = this.#timer;
		this.#selectionMember = member;

		if (member === null) {
			return renderer.updateContent(String.empty, String.empty, false);
		}

		const date = new Date();
		date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
		const now = Number(date);
		const birthday = new Date(member.birthday);
		const begin = birthday.setFullYear(date.getFullYear());
		const wish = this.#nextWish();

		if (wish !== null) {
			const [member, content] = wish;
			renderer.updateContent(content, member.name, animate);
			return timer.setTimeout(3000);
		}

		const timespan = Timespan.fromValue(begin - now);
		const { days, hours, minutes, seconds } = timespan.duration();
		const negativity = timespan.valueOf() < 0;
		renderer.updateContent(`${negativity ? "Անցավ" : "Մնաց"} ${days}օր ${hours}ժ․ ${minutes}ր․ ${seconds}վ․`, String.empty, false);
		return timer.setTimeout(1000);
	}

	#onSelectionChange(event: CustomEvent<GroupMember | null>): void {
		const member = event.detail;
		this.#wishGenerator = this.#createWishGenerator(member);
		this.#updateSelection(member, false);
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

	#onNotificationsToggle(): void {
		void this.#handleNotificationsToggle();
	}

	async #handleNotificationsToggle(): Promise<void> {
		try {
			await this.#toggleNotifications();
		} catch (reason) {
			await this.catch(Error.from(reason));
		}
		await this.#refreshNotificationsLabel();
	}

	async #toggleNotifications(): Promise<void> {
		const subscribed = await this.#notifications.isSubscribed();
		if (!subscribed) await this.#notifications.subscribe();
	}

	async #refreshNotificationsLabel(): Promise<void> {
		const subscribed = await this.#notifications.isSubscribed();
		this.#renderer.setNotificationsSubscribed(subscribed);
	}

	async catch(error: Error): Promise<void> {
		console.error(error);
	}
}
//#endregion

await AppController.launch();
