"use strict";

import "adaptive-extender/core";
import { Field, Model, Any } from "adaptive-extender/core";

//#region Push environment
export class PushEnvironment extends Model {
	@Field(String, { name: "VAPID_PUBLIC" })
	vapidPublic: string;

	// EnvironmentProvider.resolve JSON-parses every variable first, so this JWK secret always arrives as an object, never as a string
	@Field(Any, { name: "VAPID_PRIVATE" })
	vapidPrivate: JsonWebKey;

	@Field(String, { name: "TRIGGER_SECRET" })
	secret: string;
}
//#endregion
