"use strict";

import "adaptive-extender/core";
import { Field, Model, Nullable } from "adaptive-extender/core";

//#region Role
export class Role extends Model {
	@Field(String, { name: "name" })
	name: string;

	@Field(Nullable.Of(String), { name: "parent" })
	parent: string | null;

	@Field(String, { name: "description" })
	description: string;
}
//#endregion
