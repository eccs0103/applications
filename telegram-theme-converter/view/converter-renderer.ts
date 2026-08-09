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

	get #elementInputSource(): HTMLInputElement {
		return ReferenceError.suppress(this.#inputSource, "ConverterRenderer.initialize() must run first");
	}

	get #elementDefinitionSource(): HTMLElement {
		return ReferenceError.suppress(this.#definitionSource, "ConverterRenderer.initialize() must run first");
	}

	get #elementSpanDirection(): HTMLSpanElement {
		return ReferenceError.suppress(this.#spanDirection, "ConverterRenderer.initialize() must run first");
	}

	get #elementButtonConvert(): HTMLButtonElement {
		return ReferenceError.suppress(this.#buttonConvert, "ConverterRenderer.initialize() must run first");
	}

	get #elementDivReport(): HTMLDivElement {
		return ReferenceError.suppress(this.#divReport, "ConverterRenderer.initialize() must run first");
	}

	get #elementSpanReportDirect(): HTMLSpanElement {
		return ReferenceError.suppress(this.#spanReportDirect, "ConverterRenderer.initialize() must run first");
	}

	get #elementSpanReportAnchored(): HTMLSpanElement {
		return ReferenceError.suppress(this.#spanReportAnchored, "ConverterRenderer.initialize() must run first");
	}

	get #elementSpanReportDropped(): HTMLSpanElement {
		return ReferenceError.suppress(this.#spanReportDropped, "ConverterRenderer.initialize() must run first");
	}

	get #elementTableReportKeys(): HTMLTableElement {
		return ReferenceError.suppress(this.#tableReportKeys, "ConverterRenderer.initialize() must run first");
	}

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
		const inputSource = this.#elementInputSource;
		const buttonConvert = this.#elementButtonConvert;

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
		this.#elementDefinitionSource.textContent = text;
	}

	setDirection(text: string): void {
		this.#elementSpanDirection.textContent = text;
	}

	setConvertEnabled(enabled: boolean): void {
		this.#elementButtonConvert.disabled = !enabled;
	}

	#renderReportRow(key: string, outcome: KeyOutcome): HTMLTableRowElement {
		const trReportKey = this.#elementTableReportKeys.insertRow();
		trReportKey.insertCell().textContent = key;
		trReportKey.insertCell().textContent = outcome;
		return trReportKey;
	}

	showReport(report: Readonly<Report>): void {
		this.#elementSpanReportDirect.textContent = `${report.countBy(KeyOutcome.direct)}`;
		this.#elementSpanReportAnchored.textContent = `${report.countBy(KeyOutcome.anchored)}`;
		this.#elementSpanReportDropped.textContent = `${report.countBy(KeyOutcome.dropped)}`;

		this.#elementTableReportKeys.replaceChildren();
		for (const outcome of [KeyOutcome.direct, KeyOutcome.anchored, KeyOutcome.dropped]) {
			for (const key of report.keysBy(outcome)) this.#renderReportRow(key, outcome);
		}

		this.#elementDivReport.hidden = false;
	}

	hideReport(): void {
		this.#elementDivReport.hidden = true;
	}
}
//#endregion
