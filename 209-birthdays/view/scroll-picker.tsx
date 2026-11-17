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

	// Built once per mount; capturing onSelect and onCommit is safe only because both stay referentially stable (a useState setter and a bound service method, see BirthdaysApp)
	const refPicker: RefObject<PickerSelection | null> = useRef(null);
	if (refPicker.current === null) refPicker.current = new PickerSelection(members, { onSelect, onCommit });
	const picker = refPicker.current;

	useEffect(() => {
		const divScrollPicker = refContainer.current;
		if (divScrollPicker === null) return;

		picker.setInitial(divScrollPicker, selection);

		const scroll = picker.scroll.bind(picker, divScrollPicker);
		divScrollPicker.addEventListener("scroll", scroll, { passive: true });
		return divScrollPicker.removeEventListener.bind(divScrollPicker, "scroll", scroll);
		// Runs once on mount only: the initial selection must not be re-applied on later renders
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
					onClick={picker.choose.bind(picker, index)}
				>
					<span className="title">{member.birthday.toLocaleDateString("hy", { month: "short", day: "numeric" })}</span>
					<dfn className="subtitle">{member.name}</dfn>
				</button>
			))}
		</div>
	);
}
//#endregion
