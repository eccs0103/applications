"use strict";

import "adaptive-extender/web";
import { Report, KeyOutcome } from "../models/report.js";

//#region Converter renderer
interface ConverterRendererEventMap {
	"sourcechange": CustomEvent<File | null>;
	"convertrequested": Event;
}

export class ConverterRenderer extends EventTarget {
	#inputSource: HTMLInputElement;
	#dfnStatus: HTMLElement;
	#spanDirection: HTMLSpanElement;
	#buttonConvert: HTMLButtonElement;
	#divReport: HTMLDivElement;
	#spanReportBound: HTMLSpanElement;
	#spanReportInherited: HTMLSpanElement;
	#spanReportUnread: HTMLSpanElement;
	#tableReportKeys: HTMLTableElement;

	constructor(inputSource: HTMLInputElement, dfnStatus: HTMLElement, spanDirection: HTMLSpanElement, buttonConvert: HTMLButtonElement, divReport: HTMLDivElement, spanReportBound: HTMLSpanElement, spanReportInherited: HTMLSpanElement, spanReportUnread: HTMLSpanElement, tableReportKeys: HTMLTableElement) {
		super();
		this.#inputSource = inputSource;
		this.#dfnStatus = dfnStatus;
		this.#spanDirection = spanDirection;
		this.#buttonConvert = buttonConvert;
		this.#divReport = divReport;
		this.#spanReportBound = spanReportBound;
		this.#spanReportInherited = spanReportInherited;
		this.#spanReportUnread = spanReportUnread;
		this.#tableReportKeys = tableReportKeys;

		inputSource.addEventListener("change", this.#onSourceChange.bind(this));
		buttonConvert.addEventListener("click", this.#onConvertClick.bind(this));
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

	#onSourceChange(): void {
		const { files } = this.#inputSource;
		let file: File | null = null;
		if (files !== null && files[0] !== undefined) file = files[0];
		this.dispatchEvent(new CustomEvent("sourcechange", { detail: file }));
	}

	#onConvertClick(): void {
		this.dispatchEvent(new Event("convertrequested"));
	}

	setStatus(text: string): void {
		this.#dfnStatus.textContent = text;
	}

	setDirection(text: string): void {
		this.#spanDirection.textContent = text;
	}

	setConvertEnabled(enabled: boolean): void {
		this.#buttonConvert.disabled = !enabled;
	}

	#renderReportRow(key: string, outcome: KeyOutcome, detail: string | null): HTMLTableRowElement {
		const trReportKey = this.#tableReportKeys.insertRow();
		trReportKey.insertCell().textContent = key;
		trReportKey.insertCell().textContent = outcome;
		trReportKey.insertCell().textContent = detail ?? String.empty;
		return trReportKey;
	}

	showReport(report: Readonly<Report>): void {
		this.#spanReportBound.textContent = `${report.countBy(KeyOutcome.bound)}`;
		this.#spanReportInherited.textContent = `${report.countBy(KeyOutcome.inherited)}`;
		this.#spanReportUnread.textContent = `${report.countBy(KeyOutcome.unread)}`;

		this.#tableReportKeys.replaceChildren();
		for (const outcome of [KeyOutcome.bound, KeyOutcome.inherited, KeyOutcome.unread]) {
			for (const key of report.keysBy(outcome)) this.#renderReportRow(key, outcome, report.detailFor(key));
		}

		this.#divReport.hidden = false;
	}

	hideReport(): void {
		this.#divReport.hidden = true;
	}

	download(bytes: Readonly<Uint8Array>, fileName: string, mimeType: string): void {
		const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
		const url = URL.createObjectURL(blob);
		try {
			const anchorDownload = document.createElement("a");
			anchorDownload.href = url;
			anchorDownload.download = fileName;
			anchorDownload.click();
		} finally {
			URL.revokeObjectURL(url);
		}
	}
}
//#endregion
