"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Settings
export class Settings extends Model {
	@Field(Number, { name: "selection" })
	selection: number = 0;
}
//#endregion
