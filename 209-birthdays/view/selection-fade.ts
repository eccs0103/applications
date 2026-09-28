"use strict";

import "adaptive-extender/web";

//#region Selection fade
/**
 * Owns the fade-out-then-swap-text-then-fade-in choreography — the same responsibility BirthdaysRenderer's
 * `updateContent` held directly, now scoped to the two DOM nodes it was handed once at construction.
 */
export class SelectionFade {
	#h4SelectionTitle: HTMLElement;
	#dfnSelectionAuxiliary: HTMLElement;
	#titleAnimation: Animation | null = null;
	#auxiliaryAnimation: Animation | null = null;

	static #appearance: Keyframe = { opacity: "1", easing: "ease-out" };
	static #disappearance: Keyframe = { opacity: "0", easing: "ease-in" };
	static #duration: number = 500;
	static #fill: FillMode = "both";

	constructor(h4SelectionTitle: HTMLElement, dfnSelectionAuxiliary: HTMLElement) {
		this.#h4SelectionTitle = h4SelectionTitle;
		this.#dfnSelectionAuxiliary = dfnSelectionAuxiliary;
	}

	#cancel(): void {
		const titleAnimation = this.#titleAnimation;
		if (titleAnimation !== null) titleAnimation.cancel();
		const auxiliaryAnimation = this.#auxiliaryAnimation;
		if (auxiliaryAnimation !== null) auxiliaryAnimation.cancel();
	}

	#write(title: string, auxiliary: string): void {
		this.#h4SelectionTitle.textContent = title;
		this.#dfnSelectionAuxiliary.textContent = auxiliary;
	}

	/** Starts the same keyframes on both nodes and returns the title's animation, which paces the text swap. */
	#animate(keyframes: Keyframe[]): Animation {
		const options: KeyframeAnimationOptions = { duration: SelectionFade.#duration, fill: SelectionFade.#fill };
		const titleAnimation = this.#h4SelectionTitle.animate(keyframes, options);
		this.#titleAnimation = titleAnimation;
		this.#auxiliaryAnimation = this.#dfnSelectionAuxiliary.animate(keyframes, options);
		return titleAnimation;
	}

	#onFadeOutFinish(title: string, auxiliary: string): void {
		this.#write(title, auxiliary);
		this.#animate([SelectionFade.#disappearance, SelectionFade.#appearance]);
	}

	update(title: string, auxiliary: string, animate: boolean): void {
		this.#cancel();

		if (!animate) return this.#write(title, auxiliary);

		const fadeOut = this.#animate([SelectionFade.#appearance, SelectionFade.#disappearance]);
		fadeOut.onfinish = this.#onFadeOutFinish.bind(this, title, auxiliary);
	}
}
//#endregion
