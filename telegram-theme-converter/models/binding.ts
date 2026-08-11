"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Binding
export class Binding extends Model {
	@Field(String, { name: "key" })
	key: string;

	@Field(String, { name: "role" })
	role: string;

	@Field(Boolean, { name: "authority" })
	authority: boolean = false;
}
//#endregion
