"use strict";

import "adaptive-extender/core";

//#region Bridge
export interface Bridge {
	read(path: Readonly<URL>): Promise<string | null>;
	write(path: Readonly<URL>, content: string): Promise<void>;
}
//#endregion
