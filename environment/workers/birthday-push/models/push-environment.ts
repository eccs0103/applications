"use strict";

import "adaptive-extender/core";
import { Field, Model, Any } from "adaptive-extender/core";

//#region Push environment
export class PushEnvironment extends Model {
	@Field(String, { name: "VAPID_PUBLIC" })
	vapidPublic: string;

	/**
	 * `EnvironmentProvider.resolve` JSON-parses every env var that happens to be valid JSON before field
	 * validation runs — since this secret is stored as JWK JSON, it always arrives pre-parsed as an object.
	 */
	@Field(Any, { name: "VAPID_PRIVATE" })
	vapidPrivate: JsonWebKey;

	@Field(String, { name: "TRIGGER_SECRET" })
	triggerSecret: string;
}
//#endregion
