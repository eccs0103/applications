"use strict";

import "adaptive-extender/web";
import { Controller, MetadataInjector } from "adaptive-extender/web";
import { ConverterRenderer } from "../view/converter-renderer.js";
import { ClientBridge } from "../services/client-bridge.js";
import { VocabularyService } from "../services/vocabulary-service.js";
import { Converter } from "../services/converter.js";
import { AndroidTheme } from "../models/android-theme.js";
import { DesktopTheme } from "../models/desktop-theme.js";
import { Vocabulary } from "../models/vocabulary.js";
import { Platform } from "../models/platform.js";
import { type Color } from "adaptive-extender/core";

const { baseURI, body } = document;

//#region App controller
class AppController extends Controller {
	static #extensionAttheme: string = ".attheme";
	static #extensionTdesktopTheme: string = ".tdesktop-theme";

	#renderer: ConverterRenderer;
	#converter: Converter;
	#androidVocabulary: Vocabulary;
	#desktopVocabulary: Vocabulary;

	#fileSource: File | null = null;
	#platformSource: Platform | null = null;

	#detectPlatform(fileName: string): Platform | null {
		const lowered = fileName.toLowerCase();
		if (lowered.endsWith(AppController.#extensionAttheme)) return Platform.android;
		if (lowered.endsWith(AppController.#extensionTdesktopTheme)) return Platform.desktop;
		return null;
	}

	async run(): Promise<void> {
		const inputSource = await body.getElementAsync(HTMLInputElement, "input#source");
		const dfnStatus = await body.getElementAsync(HTMLElement, "dfn#status");
		const spanDirection = await body.getElementAsync(HTMLSpanElement, "span#direction");
		const buttonConvert = await body.getElementAsync(HTMLButtonElement, "button#convert");
		const divReport = await body.getElementAsync(HTMLDivElement, "div#report");
		const spanReportDirect = await body.getElementAsync(HTMLSpanElement, "span#report-direct");
		const spanReportAnchored = await body.getElementAsync(HTMLSpanElement, "span#report-anchored");
		const spanReportDropped = await body.getElementAsync(HTMLSpanElement, "span#report-dropped");
		const tableReportKeys = await body.getElementAsync(HTMLTableElement, "table#report-keys");
		this.#renderer = new ConverterRenderer(inputSource, dfnStatus, spanDirection, buttonConvert, divReport, spanReportDirect, spanReportAnchored, spanReportDropped, tableReportKeys);

		const bridge = new ClientBridge();
		const service = new VocabularyService(bridge, new URL(baseURI));
		const [androidVocabulary, desktopVocabulary, ruleTable] = await Promise.all([
			service.loadAndroidVocabulary(),
			service.loadDesktopVocabulary(),
			service.loadRuleTable(),
		]);
		this.#androidVocabulary = androidVocabulary;
		this.#desktopVocabulary = desktopVocabulary;
		this.#converter = new Converter(androidVocabulary, desktopVocabulary, ruleTable);

		this.#renderer.addEventListener("sourcechange", this.#onSourceChange.bind(this));
		this.#renderer.addEventListener("convertrequested", this.#onConvertRequested.bind(this));
		this.#renderer.hideReport();

		MetadataInjector.inject({
			type: "Application",
			name: "Telegram theme converter",
			webpage: new URL(baseURI),
			preview: new URL("../icons/swap.png", baseURI),
			description: "Perfect two-way conversion between Telegram Android and Telegram Desktop themes.",
			keywords: ["telegram theme", "theme converter", "attheme", "tdesktop-theme"],
			category: "Utility",
			os: "Any",
		});
	}

	#onSourceChange(event: CustomEvent<File | null>): void {
		const file = event.detail;
		this.#fileSource = file;
		this.#renderer.hideReport();

		if (file === null) {
			this.#platformSource = null;
			this.#renderer.setDirection(String.empty);
			this.#renderer.setConvertEnabled(false);
			return;
		}

		const platform = this.#detectPlatform(file.name);
		this.#platformSource = platform;

		if (platform === Platform.android) {
			this.#renderer.setDirection("Android → Desktop");
			this.#renderer.setConvertEnabled(true);
			return;
		}
		if (platform === Platform.desktop) {
			this.#renderer.setDirection("Desktop → Android");
			this.#renderer.setConvertEnabled(true);
			return;
		}

		this.#renderer.setDirection(String.empty);
		this.#renderer.setConvertEnabled(false);
		this.#renderer.setStatus(`Unrecognized file '${file.name}' - expected ${AppController.#extensionAttheme} or ${AppController.#extensionTdesktopTheme}.`);
	}

	#lightColors(vocabulary: Readonly<Vocabulary>): Map<string, Color> {
		const colors = new Map<string, Color>();
		for (const entry of vocabulary.entries) colors.set(entry.name, entry.lightColor());
		return colors;
	}

	#swapExtension(fileName: string, fromExtension: string, toExtension: string): string {
		if (fileName.toLowerCase().endsWith(fromExtension)) return `${fileName.slice(0, -fromExtension.length)}${toExtension}`;
		return `${fileName}${toExtension}`;
	}

	async #convert(): Promise<void> {
		const file = this.#fileSource;
		const platform = this.#platformSource;
		const converter = this.#converter;
		const desktopVocabulary = this.#desktopVocabulary;

		if (file === null || platform === null) return;

		this.#renderer.setStatus("Converting…");
		const bytes = new Uint8Array(await file.arrayBuffer());

		if (platform === Platform.android) {
			const source = AndroidTheme.parse(bytes);
			const { theme, report } = converter.androidToDesktop(source);
			const order = desktopVocabulary.entries.map(entry => entry.name);
			const output = await theme.serialize(order);
			this.#renderer.download(output, this.#swapExtension(file.name, AppController.#extensionAttheme, AppController.#extensionTdesktopTheme), "application/zip");
			this.#renderer.showReport(report);
			this.#renderer.setStatus(`Converted '${file.name}'.`);
			return;
		}

		const source = await DesktopTheme.parse(bytes, this.#lightColors(desktopVocabulary));
		const { theme, report } = converter.desktopToAndroid(source);
		const order = this.#androidVocabulary.entries.map(entry => entry.name);
		const output = await theme.serialize(order);
		this.#renderer.download(output, this.#swapExtension(file.name, AppController.#extensionTdesktopTheme, AppController.#extensionAttheme), "text/plain");
		this.#renderer.showReport(report);
		this.#renderer.setStatus(`Converted '${file.name}'.`);
	}

	#onConvertRequested(): void {
		this.#convert().catch(reason => {
			console.error(Error.from(reason));
			this.#renderer.setStatus(`Failed: ${Error.from(reason)}`);
		});
	}

	async catch(error: Error): Promise<void> {
		console.error(error);
		this.#renderer.setStatus(`Failed: ${error.message}`);
	}
}
//#endregion

await AppController.launch();
