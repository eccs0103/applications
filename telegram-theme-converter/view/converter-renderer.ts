"use strict";

import "adaptive-extender/web";
import { Report, KeyOutcome } from "../models/report.js";

//#region Converter renderer
interface ConverterRendererEventMap {
	"sourcechange": CustomEvent<File | null>;
	"convertrequested": Event;
}

export class ConverterRenderer extends EventTarget {
	#container: HTMLElement;
	#inputSource: HTMLInputElement | null = null;
	#definitionSource: HTMLElement | null = null;
	#spanDirection: HTMLSpanElement | null = null;
	#buttonConvert: HTMLButtonElement | null = null;
	#divReport: HTMLDivElement | null = null;
	#spanReportDirect: HTMLSpanElement | null = null;
	#spanReportAnchored: HTMLSpanElement | null = null;
	#spanReportDropped: HTMLSpanElement | null = null;
	#tableReportKeys: HTMLTableElement | null = null;

	constructor(container: HTMLElement) {
		super();
		this.#container = container;
	}

	async initialize(): Promise<void> {
		const container = this.#container;
		this.#inputSource = await container.getElementAsync(HTMLInputElement, "input#input-source");
		this.#definitionSource = await container.getElementAsync(HTMLElement, "dfn#definition-source");
		this.#spanDirection = await container.getElementAsync(HTMLSpanElement, "span#span-direction");
		this.#buttonConvert = await container.getElementAsync(HTMLButtonElement, "button#button-convert");
		this.#divReport = await container.getElementAsync(HTMLDivElement, "div#div-report");
		this.#spanReportDirect = await container.getElementAsync(HTMLSpanElement, "span#span-report-direct");
		this.#spanReportAnchored = await container.getElementAsync(HTMLSpanElement, "span#span-report-anchored");
		this.#spanReportDropped = await container.getElementAsync(HTMLSpanElement, "span#span-report-dropped");
		this.#tableReportKeys = await container.getElementAsync(HTMLTableElement, "table#table-report-keys");

		this.#initializeListeners();
	}

	addEventListener<K extends keyof ConverterRendererEventMap>(type: K, listener: (this: ConverterRenderer, ev: ConverterRendererEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options: boolean | AddEventListenerOptions = false): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof ConverterRendererEventMap>(type: K, listener: (this: ConverterRenderer, ev: ConverterRendererEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options: boolean | EventListenerOptions = false): void {
		return super.removeEventListener(type, listener, options);
	}

	#initializeListeners(): void {
		const inputSource = this.#inputSource!;
		const buttonConvert = this.#buttonConvert!;

		inputSource.addEventListener("change", () => {
			const files = inputSource.files;
			let file: File | null = null;
			if (files !== null && files[0] !== undefined) file = files[0];
			this.dispatchEvent(new CustomEvent("sourcechange", { detail: file }));
		});

		buttonConvert.addEventListener("click", () => {
			this.dispatchEvent(new Event("convertrequested"));
		});
	}

	setStatus(text: string): void {
		this.#definitionSource!.textContent = text;
	}

	setDirection(text: string): void {
		this.#spanDirection!.textContent = text;
	}

	setConvertEnabled(enabled: boolean): void {
		this.#buttonConvert!.disabled = !enabled;
	}

	#renderReportRow(key: string, outcome: KeyOutcome): HTMLTableRowElement {
		const tableReportKeys = this.#tableReportKeys!;
		const trReportKey = tableReportKeys.insertRow();
		trReportKey.insertCell().textContent = key;
		trReportKey.insertCell().textContent = outcome;
		return trReportKey;
	}

	showReport(report: Readonly<Report>): void {
		const divReport = this.#divReport!;
		const tableReportKeys = this.#tableReportKeys!;

		this.#spanReportDirect!.textContent = `${report.countBy(KeyOutcome.direct)}`;
		this.#spanReportAnchored!.textContent = `${report.countBy(KeyOutcome.anchored)}`;
		this.#spanReportDropped!.textContent = `${report.countBy(KeyOutcome.dropped)}`;

		tableReportKeys.replaceChildren();
		for (const outcome of [KeyOutcome.direct, KeyOutcome.anchored, KeyOutcome.dropped]) {
			for (const key of report.keysBy(outcome)) this.#renderReportRow(key, outcome);
		}

		divReport.hidden = false;
	}

	hideReport(): void {
		this.#divReport!.hidden = true;
	}
}
//#endregion
