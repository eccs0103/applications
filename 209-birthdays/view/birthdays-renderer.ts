"use strict";

import "adaptive-extender/web";
import { type GroupMember } from "../models/group.js";

//#region Birthdays renderer
interface BirthdaysRendererEventMap {
	"selectionchange": CustomEvent<GroupMember | null>;
	"selectioncommit": Event;
}

export class BirthdaysRenderer extends EventTarget {
	#container: HTMLElement;
	#divScrollPicker: HTMLDivElement | null = null;
	#h4SelectionTitle: HTMLHeadingElement | null = null;
	#dfnSelectionAuxiliary: HTMLElement | null = null;

	#pairMemberWithButton: [GroupMember, HTMLButtonElement][] = [];
	#buttonPickerSelection: HTMLButtonElement | null = null;

	static #appearance: Keyframe = BirthdaysRenderer.#createAppearanceKeyframe("1", "ease-out");
	static #disappearance: Keyframe = BirthdaysRenderer.#createAppearanceKeyframe("0", "ease-in");
	static #duration: number = 500;
	static #fill: FillMode = "both";

	constructor(container: HTMLElement) {
		super();
		this.#container = container;
	}

	async initialize(): Promise<void> {
		const container = this.#container;
		this.#divScrollPicker = await container.getElementAsync(HTMLDivElement, "div#scroll-picker");
		this.#h4SelectionTitle = await container.getElementAsync(HTMLHeadingElement, "h4#selection-title");
		this.#dfnSelectionAuxiliary = await container.getElementAsync(HTMLElement, "dfn#selection-auxiliary");
		
		this.#initializeListeners();
	}

	addEventListener<K extends keyof BirthdaysRendererEventMap>(type: K, listener: (this: BirthdaysRenderer, ev: BirthdaysRendererEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options: boolean | AddEventListenerOptions = false): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof BirthdaysRendererEventMap>(type: K, listener: (this: BirthdaysRenderer, ev: BirthdaysRendererEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options: boolean | EventListenerOptions = false): void {
		return super.removeEventListener(type, listener, options);
	}

	static #createAppearanceKeyframe(opacity: string, easing: string): Keyframe {
		return { opacity, easing };
	}

	static #createPickerItem(member: GroupMember): HTMLButtonElement {
		const buttonPickerItem = document.createElement("button");
		buttonPickerItem.type = "button";
		buttonPickerItem.title = String.empty;
		buttonPickerItem.classList.add("picker-item", "flex", "column", "main-center");

		const spanItemTitle = buttonPickerItem.appendChild(document.createElement("span"));
		spanItemTitle.classList.add("title");
		spanItemTitle.textContent = `${member.birthday.toLocaleDateString("hy", { month: "short", day: "numeric" })}`;

		const spanItemSubtitle = buttonPickerItem.appendChild(document.createElement("dfn"));
		spanItemSubtitle.classList.add("subtitle");
		spanItemSubtitle.textContent = `${member.name}`;

		return buttonPickerItem;
	}

	async render(members: readonly GroupMember[]): Promise<void> {
		const divScrollPicker = this.#divScrollPicker!;
		this.#pairMemberWithButton = members.map(member => [member, divScrollPicker.appendChild(BirthdaysRenderer.#createPickerItem(member))]);
	}

	#findPickerClosest(): [GroupMember, HTMLButtonElement] | null {
		const divScrollPicker = this.#divScrollPicker!;
		const pairMemberWithButton = this.#pairMemberWithButton;

		const { y, height } = divScrollPicker.getBoundingClientRect();
		const center = y + height / 2;
		return pairMemberWithButton.find(([, buttonPickerItem]) => {
			const { y, height } = buttonPickerItem.getBoundingClientRect();
			return (y <= center && center < y + height);
		}) ?? null;
	}

	setInitialSelection(selectionIndex: number): void {
		const pair = this.#pairMemberWithButton.at(selectionIndex) ?? this.#findPickerClosest();
		this.#highlightSelection(pair);
		this.#scrollToSelection(false);
	}

	#highlightSelection(pair: [GroupMember, HTMLButtonElement] | null): void {
		if (this.#buttonPickerSelection !== null) this.#buttonPickerSelection.classList.remove("selected");
		const [, button] = pair ?? [, null];
		this.#buttonPickerSelection = button;
		if (this.#buttonPickerSelection !== null) this.#buttonPickerSelection.classList.add("selected");
	}

	#setPickerSelection(pair: [GroupMember, HTMLButtonElement] | null): void {
		this.#highlightSelection(pair);
		const [member] = pair ?? [null];
		this.dispatchEvent(new CustomEvent("selectionchange", { detail: member }));
	}

	#initializeListeners(): void {
		const divScrollPicker = this.#divScrollPicker!;
		divScrollPicker.addEventListener("scroll", (event) => {
			const pair = this.#findPickerClosest();
			if (pair?.[1] === this.#buttonPickerSelection) return;
			this.#setPickerSelection(pair);
		}, { passive: true });

		divScrollPicker.addEventListener("click", (event) => {
			const { target } = event;
			if (!(target instanceof Element)) return;
			const button = target.closest("button");
			if (button === null) return;
			const pair = this.#pairMemberWithButton.find(([, b]) => b === button);
			if (pair === undefined) return;
			
			this.#setPickerSelection(pair);
			this.#scrollToSelection(true);
			this.dispatchEvent(new Event("selectioncommit"));
		});
	}

	#scrollToSelection(smooth: boolean): void {
		if (this.#buttonPickerSelection === null) return;
		this.#buttonPickerSelection.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center", inline: "center" });
	}

	updateContent(title: string, auxiliary: string, animate: boolean, duration: number = 500): void {
		const h4SelectionTitle = this.#h4SelectionTitle!;
		const dfnSelectionAuxiliary = this.#dfnSelectionAuxiliary!;

		if (!animate) {
			h4SelectionTitle.textContent = title;
			dfnSelectionAuxiliary.textContent = auxiliary;
			return;
		}

		const keyframesOut = [BirthdaysRenderer.#appearance, BirthdaysRenderer.#disappearance];
		const optionsOut: KeyframeAnimationOptions = { duration, fill: BirthdaysRenderer.#fill };
		const animationOut = h4SelectionTitle.animate(keyframesOut, optionsOut);
		dfnSelectionAuxiliary.animate(keyframesOut, optionsOut);

		animationOut.onfinish = () => {
			h4SelectionTitle.textContent = title;
			dfnSelectionAuxiliary.textContent = auxiliary;

			const keyframesIn = [BirthdaysRenderer.#disappearance, BirthdaysRenderer.#appearance];
			const optionsIn: KeyframeAnimationOptions = { duration, fill: BirthdaysRenderer.#fill };
			h4SelectionTitle.animate(keyframesIn, optionsIn);
			dfnSelectionAuxiliary.animate(keyframesIn, optionsIn);
		};
	}
}
//#endregion
