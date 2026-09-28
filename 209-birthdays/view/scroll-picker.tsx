"use strict";

import "adaptive-extender/web";
import { type ReactElement, type RefObject, useEffect, useRef } from "react";
import { type GroupMember } from "../models/group.js";
import { PickerSelection, type PickerSelectionDelegate } from "./picker-selection.js";

//#region Scroll picker
export interface ScrollPickerProps extends PickerSelectionDelegate {
	members: readonly GroupMember[];
	selection: number;
}

export function ScrollPicker({ members, selection, onSelect, onCommit }: ScrollPickerProps): ReactElement {
	const refContainer: RefObject<HTMLDivElement | null> = useRef(null);

	// Built once per mount and kept for the component's lifetime — the closest a function component gets to a
	// constructor. Safe to capture onSelect/onCommit here because both stay referentially stable for this page's
	// lifetime (a useState setter, and a bound service method — see BirthdaysApp).
	const refPicker: RefObject<PickerSelection | null> = useRef(null);
	if (refPicker.current === null) refPicker.current = new PickerSelection(members, { onSelect, onCommit });
	const picker = refPicker.current;

	useEffect(() => {
		const divScrollPicker = refContainer.current;
		if (divScrollPicker === null) return;

		picker.setInitial(divScrollPicker, selection);

		const handleScroll = picker.handleScroll.bind(picker, divScrollPicker);
		divScrollPicker.addEventListener("scroll", handleScroll, { passive: true });
		return divScrollPicker.removeEventListener.bind(divScrollPicker, "scroll", handleScroll);
		// Runs once on mount only — matches BirthdaysRenderer#setInitialSelection, which also ran once.
	}, []);

	return (
		<div id="scroll-picker" className="flex column definition" ref={refContainer}>
			{members.map((member, index) => (
				<button
					key={member.identifier}
					type="button"
					title={String.empty}
					className="picker-item flex column main-center"
					ref={picker.setButton.bind(picker, index)}
					onClick={picker.handleClick.bind(picker, index)}
				>
					<span className="title">{member.birthday.toLocaleDateString("hy", { month: "short", day: "numeric" })}</span>
					<dfn className="subtitle">{member.name}</dfn>
				</button>
			))}
		</div>
	);
}
//#endregion
