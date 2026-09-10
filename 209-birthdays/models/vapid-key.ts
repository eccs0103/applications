"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Vapid key
export class VapidKey extends Model {
	@Field(String, { name: "key" })
	key: string;
}
//#endregion
