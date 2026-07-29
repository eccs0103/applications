"use strict";

import "adaptive-extender/web";

//#region Timer
interface TimerEventMap {
	"trigger": Event;
}

export interface TimerOptions {
	multiple: boolean;
}

export class Timer extends EventTarget {
	#multiple: boolean;
	#remaining: number = 0;
	#previous: number = performance.now();

	constructor();
	constructor(options: Partial<TimerOptions>);
	constructor(options: Partial<TimerOptions> = {}) {
		super();

		this.#multiple = options.multiple ?? false;

		setInterval(this.#callback.bind(this));
	}

	addEventListener<K extends keyof TimerEventMap>(type: K, listener: (this: Timer, ev: TimerEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options: boolean | AddEventListenerOptions = false): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof TimerEventMap>(type: K, listener: (this: Timer, ev: TimerEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options: boolean | EventListenerOptions = false): void {
		return super.removeEventListener(type, listener, options);
	}

	get remaining(): number {
		return this.#remaining;
	}

	setTimeout(milliseconds: number): void {
		this.#remaining = milliseconds.clamp(0, Infinity);
	}

	#callback(): void {
		if (!this.#multiple && this.#remaining === 0) return;
		const current = performance.now();
		const difference = current - this.#previous;
		this.#remaining -= difference;
		if (this.#remaining <= 0) {
			this.#remaining = 0;
			this.dispatchEvent(new Event("trigger"));
		}
		this.#previous = current;
	}
}
//#endregion
