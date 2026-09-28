"use strict";

import "adaptive-extender/web";
import { type ReactElement } from "react";
import { NotificationState } from "../models/notification-state.js";

//#region Notifications toggle
export interface NotificationsToggleProps {
	supported: boolean;
	state: NotificationState;
	onToggle(): void;
}

export function NotificationsToggle({ supported, state, onToggle }: NotificationsToggleProps): ReactElement {
	const disabled = state === NotificationState.ready || state === NotificationState.denied;
	return (
		<button id="notifications-toggle" type="button" hidden={!supported} disabled={disabled} data-notifications={state} onClick={onToggle}>
			<span className="icon"></span>
		</button>
	);
}
//#endregion
