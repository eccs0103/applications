"use strict";

import "adaptive-extender/core";
import { EnvironmentProvider, type Environment } from "adaptive-extender/core";
import database from "../../resources/data/database-2025.json";
import { CloudflareWorker } from "../../environment/workers/cloudflare-worker.js";
import { PushEnvironment } from "../models/push-environment.js";
import { PushReport } from "../models/push-report.js";
import { SubscriptionStore } from "../services/subscription-store.js";
import { VapidSigner } from "../services/vapid-signer.js";
import { PushDispatcher } from "../services/push-dispatcher.js";
import { ResponseFactory } from "../services/response-factory.js";
import { BirthdayDatabase, type BirthdayHolder } from "../models/birthday-database.js";
import { ReminderExpert } from "../services/reminder-expert.js";

//#region Birthday push worker
interface WorkerServices {
	SUBSCRIPTIONS: KVNamespace;
}
type WorkerBindings = Environment & WorkerServices;

class BirthdayPushWorker extends CloudflareWorker<WorkerBindings> {
	#factory: ResponseFactory = new ResponseFactory();

	async run(request: Request, environment: WorkerBindings, context: ExecutionContext): Promise<Response> {
		void context;
		const factory = this.#factory;
		const { pathname } = new URL(request.url);

		if (request.method === "OPTIONS") return factory.preflight();
		if (request.method === "GET" && pathname === "/api/vapid") return factory.json({ key: environment.VAPID_PUBLIC });
		if (request.method === "POST" && pathname === "/api/subscribe") return await this.#subscribe(request, environment);
		if (request.method === "POST" && pathname === "/api/trigger") return await this.#trigger(request, environment);
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

	static #timezoneOffsetHours: number = 4;

	/**
	 * Cloudflare Workers run in UTC, but this app has one fixed audience timezone (Yerevan, UTC+4,
	 * no DST). Raw UTC `new Date()` reads a calendar day that's still stale for up to 4 hours after
	 * Yerevan's own day has already rolled over — shift by the fixed offset before reading the date.
	 */
	#today(): Date {
		const shifted = new Date(Date.now() + BirthdayPushWorker.#timezoneOffsetHours * 60 * 60 * 1000);
		return new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
	}

	#reminders(): [BirthdayHolder, number][] {
		const members = BirthdayDatabase.import(database, "database-2025.json").members;
		return ReminderExpert.findReminders(members, this.#today());
	}

	static #safeEquals(token: string, token2: string): boolean {
		const bytes = new TextEncoder().encode(token);
		const bytes2 = new TextEncoder().encode(token2);
		if (bytes.length !== bytes2.length) return false;
		let difference = 0;
		for (let index = 0; index < bytes.length; index++) difference |= bytes[index] ^ bytes2[index];
		return difference === 0;
	}

	#authorized(request: Request, secret: string): boolean {
		const header = request.headers.get("Authorization");
		if (header === null) return false;
		const [scheme, token] = header.split(" ");
		if (scheme !== "Bearer") return false;
		if (token === undefined) return false;
		return BirthdayPushWorker.#safeEquals(token, secret);
	}

	async #runReminderCycle(environment: WorkerBindings, pushEnvironment: Readonly<PushEnvironment>): Promise<PushReport> {
		const reminders = this.#reminders();
		const due = reminders.map(([member]) => member.fullName);
		if (reminders.length === 0) return new PushReport(due);

		const dispatcher = new PushDispatcher(new SubscriptionStore(environment.SUBSCRIPTIONS), new VapidSigner(pushEnvironment.vapidPublic, pushEnvironment.vapidPrivate));
		return await dispatcher.broadcast(due);
	}

	async #trigger(request: Request, environment: WorkerBindings): Promise<Response> {
		const pushEnvironment = EnvironmentProvider.resolve(environment, PushEnvironment);
		if (!this.#authorized(request, pushEnvironment.triggerSecret)) return this.#factory.error(401, "Unauthorized");
		const report = await this.#runReminderCycle(environment, pushEnvironment);
		return this.#factory.json(report);
	}

	async runScheduled(event: ScheduledController, environment: WorkerBindings): Promise<void> {
		void event;
		const pushEnvironment = EnvironmentProvider.resolve(environment, PushEnvironment);
		const report = await this.#runReminderCycle(environment, pushEnvironment);
		console.info(report.describe());
	}

	async catchScheduled(error: Error): Promise<void> {
		console.error(`Reminder run failed:\n${error}`);
	}
}

export default new BirthdayPushWorker();
//#endregion
