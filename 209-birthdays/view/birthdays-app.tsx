"use strict";

import "adaptive-extender/web";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { type GroupMember } from "../models/group.js";
import { SelectionContent } from "../models/selection-content.js";
import { NotificationState } from "../models/notification-state.js";
import { type SettingsService } from "../services/settings-service.js";
import { type NotificationService } from "../services/notification-service.js";
import { type Timer } from "../services/timer.js";
import { ScrollPicker } from "./scroll-picker.js";
import { SelectionDisplay } from "./selection-display.js";
import { NotificationsToggle } from "./notifications-toggle.js";

//#region Birthdays app
export interface BirthdaysAppProps {
	members: readonly GroupMember[];
	settings: SettingsService;
	notifications: NotificationService;
	timer: Timer;
}

/** Reproduces AppController's generator-driven wish cycle: each Timer "trigger" pulls the next wish, or falls back to the live countdown once the generator is exhausted. */
function useSelectionContent(member: GroupMember | null, timer: Timer): SelectionContent {
	const [content, setContent] = useState<SelectionContent>(SelectionContent.empty());
	const refGenerator = useRef<Generator<[GroupMember, string], null> | null>(null);

	useEffect(() => {
		if (member === null) {
			refGenerator.current = null;
			setContent(SelectionContent.empty());
			return;
		}
		refGenerator.current = member.askWishes();
		setContent(SelectionContent.next(refGenerator.current, member, false));
	}, [member]);

	useEffect(() => {
		if (member === null) return;
		const handleTrigger = (): void => setContent(SelectionContent.next(refGenerator.current, member, true));
		timer.addEventListener("trigger", handleTrigger);
		return timer.removeEventListener.bind(timer, "trigger", handleTrigger);
	}, [member, timer]);

	useEffect(() => {
		timer.setTimeout(content.delay);
	}, [content, timer]);

	return content;
}

export function BirthdaysApp({ members, settings, notifications, timer }: BirthdaysAppProps): ReactElement {
	const [indexSelection] = useState<number>(settings.readSelection.bind(settings));
	const [memberSelection, setMemberSelection] = useState<GroupMember | null>(() => members.at(indexSelection) ?? null);
	const [notificationsState, setNotificationsState] = useState<NotificationState>(NotificationState.idle);

	const content = useSelectionContent(memberSelection, timer);

	useEffect(() => {
		const bootstrap = async (): Promise<void> => setNotificationsState(await notifications.bootstrap());
		void bootstrap();
	}, [notifications]);

	const handleToggle = async (): Promise<void> => setNotificationsState(await notifications.toggle());

	return (
		<>
			<ScrollPicker members={members} selection={indexSelection} onSelect={setMemberSelection} onCommit={settings.writeSelection.bind(settings)} />
			<hr className="layer" />
			<SelectionDisplay content={content} />
			<NotificationsToggle supported={notifications.supported} state={notificationsState} onToggle={handleToggle} />
		</>
	);
}
//#endregion
