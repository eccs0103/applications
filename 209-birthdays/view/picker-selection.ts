"use strict";

import "adaptive-extender/web";
import { type GroupMember } from "../models/group.js";

//#region Picker selection
export interface PickerSelectionDelegate {
	onSelect(member: GroupMember | null): void;
	onCommit(index: number): void;
}

/**
 * Owns the scroll picker's imperative DOM state — which button is highlighted, and how the list scrolls to it —
 * the same responsibility BirthdaysRenderer held directly on its class fields before this page was React.
 * One instance per mounted ScrollPicker; React only ever calls its public methods.
 */
export class PickerSelection {
	#members: readonly GroupMember[];
	#delegate: PickerSelectionDelegate;
	#buttons: (HTMLButtonElement | null)[] = [];
	#index: number | null = null;

	constructor(members: readonly GroupMember[], delegate: PickerSelectionDelegate) {
		this.#members = members;
		this.#delegate = delegate;
	}

	/** Mirrors `Array.prototype.at` so an out-of-range or negative index resolves the same way it did against the old pair array. */
	static #normalizeIndex(length: number, index: number): number | null {
		let normalized = index;
		if (normalized < 0) normalized += length;
		if (normalized < 0 || normalized >= length) return null;
		return normalized;
	}

	setButton(index: number, element: HTMLButtonElement | null): void {
		this.#buttons[index] = element;
	}

	#button(index: number): HTMLButtonElement | null {
		const button = this.#buttons.at(index);
		if (button === undefined) return null;
		return button;
	}

	#mark(index: number, selected: boolean): void {
		const button = this.#button(index);
		if (button === null) return;
		button.classList.toggle("selected", selected);
	}

	#highlight(index: number | null): void {
		const previous = this.#index;
		if (previous !== null) this.#mark(previous, false);
		this.#index = index;
		if (index !== null) this.#mark(index, true);
	}

	#scrollTo(smooth: boolean): void {
		const index = this.#index;
		if (index === null) return;
		const button = this.#button(index);
		if (button === null) return;
		let behavior: ScrollBehavior = "auto";
		if (smooth) behavior = "smooth";
		button.scrollIntoView({ behavior, block: "center", inline: "center" });
	}

	#findClosest(divScrollPicker: Readonly<HTMLDivElement>): number | null {
		const { y, height } = divScrollPicker.getBoundingClientRect();
		const center = y + height / 2;
		const buttons = this.#buttons;
		for (let index = 0; index < buttons.length; index++) {
			const button = buttons[index];
			if (button === null) continue;
			const { y: itemY, height: itemHeight } = button.getBoundingClientRect();
			if (itemY <= center && center < itemY + itemHeight) return index;
		}
		return null;
	}

	#select(index: number | null): void {
		this.#highlight(index);
		const delegate = this.#delegate;
		if (index === null) return delegate.onSelect(null);
		delegate.onSelect(this.#members[index]);
	}

	setInitial(divScrollPicker: Readonly<HTMLDivElement>, selection: number): void {
		let index = PickerSelection.#normalizeIndex(this.#members.length, selection);
		if (index === null) index = this.#findClosest(divScrollPicker);
		this.#select(index);
		this.#scrollTo(false);
	}

	handleScroll(divScrollPicker: Readonly<HTMLDivElement>): void {
		const closest = this.#findClosest(divScrollPicker);
		if (closest === this.#index) return;
		this.#select(closest);
	}

	handleClick(index: number): void {
		this.#select(index);
		this.#scrollTo(true);
		this.#delegate.onCommit(index);
	}
}
//#endregion
