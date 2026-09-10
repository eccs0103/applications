"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Push environment
export class PushEnvironment extends Model {
	@Field(String, { name: "VAPID_PUBLIC" })
	vapidPublic: string;

	@Field(String, { name: "VAPID_PRIVATE" })
	vapidPrivate: string;
}
//#endregion
