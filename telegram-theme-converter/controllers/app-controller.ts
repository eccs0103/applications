"use strict";

import "adaptive-extender/web";
import { Controller, MetadataInjector, URI } from "adaptive-extender/web";
import { ConverterRenderer } from "../view/converter-renderer.js";
import { ClientBridge } from "../services/client-bridge.js";
import { ClientCodec } from "../services/client-codec.js";
import { type Codec } from "../services/codec.js";
import { VocabularyService } from "../services/vocabulary-service.js";
import { Converter } from "../services/converter.js";
import { AndroidTheme } from "../models/android-theme.js";
import { DesktopTheme } from "../models/desktop-theme.js";
import { Vocabulary } from "../models/vocabulary.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const { baseURI, body } = document;

enum SourcePlatform {
	android = "android",
	desktop = "desktop",
}

//#region App controller
class AppController extends Controller {
	static #attheme: string = ".attheme";
	static #tdesktop: string = ".tdesktop-theme";

	#renderer: ConverterRenderer = new ConverterRenderer(body);
	#codec: Codec = new ClientCodec();
	#converter: Converter | null = null;
	#androidVocabulary: Vocabulary | null = null;
	#desktopVocabulary: Vocabulary | null = null;

	#file: File | null = null;
	#platform: SourcePlatform | null = null;

	get #requiredConverter(): Converter {
		return ReferenceError.suppress(this.#converter, "AppController.run() must complete first");
	}

	get #requiredAndroidVocabulary(): Vocabulary {
		return ReferenceError.suppress(this.#androidVocabulary, "AppController.run() must complete first");
	}

	get #requiredDesktopVocabulary(): Vocabulary {
		return ReferenceError.suppress(this.#desktopVocabulary, "AppController.run() must complete first");
	}

	#detect(fileName: string): SourcePlatform | null {
		const lowered = fileName.toLowerCase();
		if (lowered.endsWith(AppController.#attheme)) return SourcePlatform.android;
		if (lowered.endsWith(AppController.#tdesktop)) return SourcePlatform.desktop;
		return null;
	}

	async run(): Promise<void> {
		void AnalyticsController.launch();
		const bridge = new ClientBridge();
		const service = new VocabularyService(bridge, new URI(baseURI));
		const [androidVocabulary, desktopVocabulary, ruleTable] = await Promise.all([
			service.loadAndroidVocabulary(),
			service.loadDesktopVocabulary(),
			service.loadRuleTable(),
		]);
		this.#androidVocabulary = androidVocabulary;
		this.#desktopVocabulary = desktopVocabulary;
		this.#converter = new Converter(androidVocabulary, desktopVocabulary, ruleTable);

		const renderer = this.#renderer;
		await renderer.initialize();
		renderer.addEventListener("sourcechange", this.#onSourceChange.bind(this));
		renderer.addEventListener("convertrequested", this.#onConvertRequested.bind(this));
		renderer.hideReport();

		MetadataInjector.inject({
			type: "Application",
			name: "Telegram theme converter",
			webpage: new URI(baseURI),
			description: "Perfect two-way conversion between Telegram Android and Telegram Desktop themes.",
			category: "Utility",
			os: "Any",
		});
	}

	#onSourceChange(event: CustomEvent<File | null>): void {
		const renderer = this.#renderer;
		const file = event.detail;
		this.#file = file;
		renderer.hideReport();

		if (file === null) {
			this.#platform = null;
			renderer.setDirection(String.empty);
			renderer.setConvertEnabled(false);
			return;
		}

		const platform = this.#detect(file.name);
		this.#platform = platform;

		if (platform === SourcePlatform.android) {
			renderer.setDirection("Android → Desktop");
			renderer.setConvertEnabled(true);
			return;
		}
		if (platform === SourcePlatform.desktop) {
			renderer.setDirection("Desktop → Android");
			renderer.setConvertEnabled(true);
			return;
		}

		renderer.setDirection(String.empty);
		renderer.setConvertEnabled(false);
		renderer.setStatus(`Unrecognized file '${file.name}' - expected ${AppController.#attheme} or ${AppController.#tdesktop}.`);
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
		const renderer = this.#renderer;
		const attheme = AppController.#attheme;
		const tdesktop = AppController.#tdesktop;
		const file = this.#file;
		const platform = this.#platform;
		const converter = this.#requiredConverter;
		const desktopVocabulary = this.#requiredDesktopVocabulary;
		const codec = this.#codec;

		if (file === null || platform === null) return;

		renderer.setStatus("Converting…");
		const bytes = new Uint8Array(await file.arrayBuffer());

		if (platform === SourcePlatform.android) {
			const source = AndroidTheme.parse(bytes, codec);
			const { theme, report } = converter.androidToDesktop(source);
			const order = desktopVocabulary.entries.map(entry => entry.name);
			const output = await theme.serialize(order, codec);
			this.#download(output, this.#swapExtension(file.name, attheme, tdesktop), "application/zip");
			renderer.showReport(report);
			renderer.setStatus(`Converted '${file.name}'.`);
			return;
		}

		const source = await DesktopTheme.parse(bytes, codec, desktopVocabulary.lightColors());
		const { theme, report } = converter.desktopToAndroid(source);
		const order = this.#requiredAndroidVocabulary.entries.map(entry => entry.name);
		const output = await theme.serialize(order, codec);
		this.#download(output, this.#swapExtension(file.name, tdesktop, attheme), "text/plain");
		renderer.showReport(report);
		renderer.setStatus(`Converted '${file.name}'.`);
	}

	async #onConvertRequested(event: Event): Promise<void> {
		try {
			await this.#convert();
		} catch (reason) {
			const error = Error.from(reason);
			console.error(error);
			this.#renderer.setStatus(`Failed: ${error}`);
		}
	}

	async catch(error: Error): Promise<void> {
		console.error(error);
		this.#renderer.setStatus(`Failed: ${error.message}`);
	}
}
//#endregion

await AppController.launch();
