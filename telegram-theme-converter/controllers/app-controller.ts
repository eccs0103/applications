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
import { type Color } from "adaptive-extender/core";

const { baseURI, body } = document;

const extensionAttheme = ".attheme";
const extensionTdesktopTheme = ".tdesktop-theme";

enum SourcePlatform {
	android = "android",
	desktop = "desktop",
}

//#region App controller
class AppController extends Controller {
	#renderer: ConverterRenderer = new ConverterRenderer(body);
	#converter: Converter | null = null;
	#androidVocabulary: Vocabulary | null = null;
	#desktopVocabulary: Vocabulary | null = null;

	#sourceFile: File | null = null;
	#sourcePlatform: SourcePlatform | null = null;

	#detectSourcePlatform(fileName: string): SourcePlatform | null {
		const lowered = fileName.toLowerCase();
		if (lowered.endsWith(extensionAttheme)) return SourcePlatform.android;
		if (lowered.endsWith(extensionTdesktopTheme)) return SourcePlatform.desktop;
		return null;
	}

	async run(): Promise<void> {
		const bridge = new ClientBridge();
		const vocabularyService = new VocabularyService(bridge, new URL(baseURI));
		const [androidVocabulary, desktopVocabulary, ruleTable] = await Promise.all([
			vocabularyService.loadAndroidVocabulary(),
			vocabularyService.loadDesktopVocabulary(),
			vocabularyService.loadRuleTable(),
		]);
		this.#androidVocabulary = androidVocabulary;
		this.#desktopVocabulary = desktopVocabulary;
		this.#converter = new Converter(androidVocabulary, desktopVocabulary, ruleTable);

		await this.#renderer.initialize();
		this.#renderer.addEventListener("sourcechange", this.#onSourceChange.bind(this));
		this.#renderer.addEventListener("convertrequested", this.#onConvertRequested.bind(this));
		this.#renderer.hideReport();

		MetadataInjector.inject({
			type: "Application",
			name: "Telegram theme converter",
			webpage: new URL(baseURI),
			description: "Perfect two-way conversion between Telegram Android and Telegram Desktop themes.",
			category: "Utility",
			os: "Any",
		});
	}

	#onSourceChange(event: CustomEvent<File | null>): void {
		const file = event.detail;
		this.#sourceFile = file;
		this.#renderer.hideReport();

		if (file === null) {
			this.#sourcePlatform = null;
			this.#renderer.setDirection(String.empty);
			this.#renderer.setConvertEnabled(false);
			return;
		}

		const platform = this.#detectSourcePlatform(file.name);
		this.#sourcePlatform = platform;

		if (platform === SourcePlatform.android) {
			this.#renderer.setDirection("Android → Desktop");
			this.#renderer.setConvertEnabled(true);
			return;
		}
		if (platform === SourcePlatform.desktop) {
			this.#renderer.setDirection("Desktop → Android");
			this.#renderer.setConvertEnabled(true);
			return;
		}

		this.#renderer.setDirection(String.empty);
		this.#renderer.setConvertEnabled(false);
		this.#renderer.setStatus(`Unrecognized file '${file.name}' - expected ${extensionAttheme} or ${extensionTdesktopTheme}.`);
	}

	#lightColors(vocabulary: Readonly<Vocabulary>): Map<string, Color> {
		const colors = new Map<string, Color>();
		for (const entry of vocabulary.entries) colors.set(entry.name, entry.lightColor());
		return colors;
	}

	#download(bytes: Readonly<Uint8Array>, fileName: string, mimeType: string): void {
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

	#swapExtension(fileName: string, fromExtension: string, toExtension: string): string {
		if (fileName.toLowerCase().endsWith(fromExtension)) return `${fileName.slice(0, -fromExtension.length)}${toExtension}`;
		return `${fileName}${toExtension}`;
	}

	async #convert(): Promise<void> {
		const file = this.#sourceFile;
		const platform = this.#sourcePlatform;
		const converter = this.#converter!;
		const desktopVocabulary = this.#desktopVocabulary!;

		if (file === null || platform === null) return;

		this.#renderer.setStatus("Converting…");
		const bytes = new Uint8Array(await file.arrayBuffer());

		if (platform === SourcePlatform.android) {
			const source = AndroidTheme.parse(bytes);
			const { theme, report } = converter.androidToDesktop(source);
			const order = desktopVocabulary.entries.map(entry => entry.name);
			const output = await theme.serialize(order);
			this.#download(output, this.#swapExtension(file.name, extensionAttheme, extensionTdesktopTheme), "application/zip");
			this.#renderer.showReport(report);
			this.#renderer.setStatus(`Converted '${file.name}'.`);
			return;
		}

		const source = await DesktopTheme.parse(bytes, this.#lightColors(desktopVocabulary));
		const { theme, report } = converter.desktopToAndroid(source);
		const order = this.#androidVocabulary!.entries.map(entry => entry.name);
		const output = await theme.serialize(order);
		this.#download(output, this.#swapExtension(file.name, extensionTdesktopTheme, extensionAttheme), "text/plain");
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
