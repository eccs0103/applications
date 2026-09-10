"use strict";

import "adaptive-extender/core";

//#region Response factory
export class ResponseFactory {
	static #CORS: Record<string, string> = {
		["Access-Control-Allow-Origin"]: "*",
		["Access-Control-Allow-Methods"]: "GET, POST, OPTIONS",
		["Access-Control-Allow-Headers"]: "Content-Type",
	};

	#corsHeaders(): Headers {
		return new Headers(ResponseFactory.#CORS);
	}

	preflight(): Response {
		return new Response(null, { status: 204, headers: this.#corsHeaders() });
	}

	json(body: unknown): Response {
		return Response.json(body, { headers: this.#corsHeaders() });
	}

	noContent(): Response {
		return new Response(null, { status: 204, headers: this.#corsHeaders() });
	}

	error(status: number, message: string): Response {
		return new Response(message, { status, headers: this.#corsHeaders() });
	}
}
//#endregion
