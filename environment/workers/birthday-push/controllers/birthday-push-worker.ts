"use strict";

import "adaptive-extender/core";
import { EnvironmentProvider, type Environment } from "adaptive-extender/core";
import database from "../../../../resources/data/database-2025.json";
import { CloudflareWorker } from "../../cloudflare-worker.js";
import { PushEnvironment } from "../models/push-environment.js";
import { SubscriptionStore } from "../services/subscription-store.js";
import { VapidSigner } from "../services/vapid-signer.js";
import { PushDispatcher } from "../services/push-dispatcher.js";
import { ResponseFactory } from "../services/response-factory.js";
import { BirthdayDatabase } from "../../../../209-birthdays/models/birthday-database.js";
import { ReminderExpert } from "../../../../209-birthdays/services/reminder-expert.js";

//#region Birthday push worker
type WorkerBindings = Environment & { SUBSCRIPTIONS: KVNamespace; };

class BirthdayPushWorker extends CloudflareWorker<WorkerBindings> {
	#factory: ResponseFactory = new ResponseFactory();

	async run(request: Request, environment: WorkerBindings, context: ExecutionContext): Promise<Response> {
		void context;
		const factory = this.#factory;
		const { pathname } = new URL(request.url);

		if (request.method === "OPTIONS") return factory.preflight();
		if (request.method === "GET" && pathname === "/api/vapid") return factory.json({ key: environment.VAPID_PUBLIC });
		if (request.method === "POST" && pathname === "/api/subscribe") return await this.#subscribe(request, environment);
		return factory.error(404, "Not found");
	}

	async catch(error: Error): Promise<Response> {
		return this.#factory.error(500, error.message);
	}

	async #subscribe(request: Request, environment: WorkerBindings): Promise<Response> {
		const text = await request.text();
		const store = new SubscriptionStore(environment.SUBSCRIPTIONS);
		const endpoint = await store.save(text);
		if (endpoint === null) return this.#factory.error(400, "Bad request");
		return this.#factory.noContent();
	}

	async runScheduled(event: ScheduledController, environment: WorkerBindings): Promise<void> {
		void event;
		const members = BirthdayDatabase.import(database, "database-2025.json").members;
		const reminders = ReminderExpert.findReminders(members, new Date());
		if (reminders.length === 0) return;

		const { vapidPublic, vapidPrivate } = EnvironmentProvider.resolve(environment, PushEnvironment);
		const dispatcher = new PushDispatcher(new SubscriptionStore(environment.SUBSCRIPTIONS), new VapidSigner(vapidPublic, vapidPrivate));
		await dispatcher.broadcast();
	}

	async catchScheduled(error: Error): Promise<void> {
		console.error(`Reminder run failed:\n${error}`);
	}
}

export default new BirthdayPushWorker();
//#endregion
