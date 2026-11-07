"use strict";

import "adaptive-extender/core";
import { type URI } from "adaptive-extender/core";

//#region Bridge
export interface Bridge {
	read(path: Readonly<URI>): Promise<string | null>;
}
//#endregion
