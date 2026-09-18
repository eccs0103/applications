"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Subscription record
export class SubscriptionRecord extends Model {
	@Field(String, { name: "endpoint" })
	endpoint: string;
}
//#endregion
