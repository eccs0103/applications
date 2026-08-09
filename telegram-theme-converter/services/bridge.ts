"use strict";

import "adaptive-extender/core";

//#region Bridge
export interface Bridge {
	read(path: Readonly<URL>): Promise<string | null>;
}
//#endregion
