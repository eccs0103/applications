"use strict";

import "adaptive-extender/core";

//#region Cloudflare worker
export abstract class CloudflareWorker<Env> implements ExportedHandler<Env> {
	constructor() {
		if (new.target === CloudflareWorker) throw new TypeError("Unable to create an instance of an abstract class");
	}

	async run(request: Request, environment: Env, context: ExecutionContext): Promise<Response> {
		void request, environment, context;
		return new Response(null, { status: 501 });
	}

	async catch(error: Error): Promise<Response> {
		void error;
		return new Response(null, { status: 501 });
	}

	async fetch(request: Request, environment: Env, context: ExecutionContext): Promise<Response> {
		try {
			return await this.run(request, environment, context);
		} catch (reason) {
			return await this.catch(Error.from(reason));
		}
	}

	async runScheduled(event: ScheduledController, environment: Env, context: ExecutionContext): Promise<void> {
		void event, environment, context;
	}

	async catchScheduled(error: Error): Promise<void> {
		console.error(`Scheduled run failed:\n${error}`);
	}

	async scheduled(event: ScheduledController, environment: Env, context: ExecutionContext): Promise<void> {
		try {
			await this.runScheduled(event, environment, context);
		} catch (reason) {
			await this.catchScheduled(Error.from(reason));
		}
	}
}
//#endregion
