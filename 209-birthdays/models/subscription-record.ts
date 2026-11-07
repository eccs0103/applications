"use strict";

import "adaptive-extender/core";
import { Field, Model, URI } from "adaptive-extender/core";

//#region Subscription record
export class SubscriptionRecord extends Model {
	@Field(URI, { name: "endpoint" })
	endpoint: URI;
}
//#endregion
