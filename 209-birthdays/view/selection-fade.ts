"use strict";

import "adaptive-extender/web";

//#region Selection fade
export class SelectionFade {
	#h4SelectionTitle: HTMLElement;
	#dfnSelectionAuxiliary: HTMLElement;
	#animation: Animation | null = null;
	#animation2: Animation | null = null;

	static #appearance: Keyframe = { opacity: "1", easing: "ease-out" };
	static #disappearance: Keyframe = { opacity: "0", easing: "ease-in" };
	static #duration: number = 500;
	static #fill: FillMode = "both";

	constructor(h4SelectionTitle: HTMLElement, dfnSelectionAuxiliary: HTMLElement) {
		this.#h4SelectionTitle = h4SelectionTitle;
		this.#dfnSelectionAuxiliary = dfnSelectionAuxiliary;
	}

	#cancel(): void {
		const animation = this.#animation;
		if (animation !== null) animation.cancel();
		const animation2 = this.#animation2;
		if (animation2 !== null) animation2.cancel();
	}

	#write(title: string, auxiliary: string): void {
		this.#h4SelectionTitle.textContent = title;
		this.#dfnSelectionAuxiliary.textContent = auxiliary;
	}

	#animate(keyframes: Keyframe[]): Animation {
		const options: KeyframeAnimationOptions = { duration: SelectionFade.#duration, fill: SelectionFade.#fill };
		const animation = this.#h4SelectionTitle.animate(keyframes, options);
		this.#animation = animation;
		this.#animation2 = this.#dfnSelectionAuxiliary.animate(keyframes, options);
		return animation;
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
