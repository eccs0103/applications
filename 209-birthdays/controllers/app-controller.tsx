"use strict";

import "adaptive-extender/web";
import { Controller, MetadataInjector } from "adaptive-extender/web";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BirthdaysApp } from "../view/birthdays-app.js";
import { ClientBridge } from "../services/client-bridge.js";
import { type Bridge } from "../services/bridge.js";
import { Group } from "../models/group.js";
import { SettingsService } from "../services/settings-service.js";
import { NotificationService } from "../services/notification-service.js";
import { Timer } from "../services/timer.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const { baseURI, body } = document;

//#region App controller
class AppController extends Controller {
	#bridge: Bridge = new ClientBridge();
	#settings: SettingsService = new SettingsService();
	#notifications: NotificationService = new NotificationService();
	#timer: Timer = new Timer({ multiple: false });

	async #readGroup(url: Readonly<URL>): Promise<Group> {
		const content = await this.#bridge.read(url);
		if (content === null) throw new ReferenceError();
		const object = JSON.parse(content);
		return Group.load(object, "database-2025.json");
	}

	async run(): Promise<void> {
		void AnalyticsController.launch();
		const group = await this.#readGroup(new URL("../data/database-2025.json", baseURI));
		const members = group.members
			.sort((member1, member2) => member1.birthday.getDate() - member2.birthday.getDate())
			.sort((member1, member2) => member1.birthday.getMonth() - member2.birthday.getMonth());

		const divRoot = body.getElement(HTMLDivElement, "div#root");
		createRoot(divRoot).render(<StrictMode><BirthdaysApp members={members} settings={this.#settings} notifications={this.#notifications} timer={this.#timer} /></StrictMode>);

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

	async catch(error: Error): Promise<void> {
		console.error(error);
	}
}
//#endregion

await AppController.launch();
