"use strict";

import "adaptive-extender/web";
import { Controller, MetadataInjector } from "adaptive-extender/web";
import { ConverterRenderer } from "../view/converter-renderer.js";
import { ClientBridge } from "../services/client-bridge.js";
import { VocabularyService } from "../services/vocabulary-service.js";
import { Converter } from "../services/converter.js";
import { type Platform } from "../models/platform.js";

const { baseURI, body } = document;

//#region App controller
class AppController extends Controller {
	#renderer: ConverterRenderer;
	#converter: Converter;
	#platforms: Platform[];

	#fileSource: File | null = null;
	#platformSource: Platform | null = null;

	#detectPlatform(fileName: string): Platform | null {
		return this.#platforms.find(platform => platform.matches(fileName)) ?? null;
	}

	#otherPlatform(platform: Readonly<Platform>): Platform {
		return ReferenceError.suppress(this.#platforms.find(candidate => candidate !== platform), `No conversion target registered alongside platform '${platform.id}'`);
	}

	async run(): Promise<void> {
		const inputSource = await body.getElementAsync(HTMLInputElement, "input#source");
		const dfnStatus = await body.getElementAsync(HTMLElement, "dfn#status");
		const spanDirection = await body.getElementAsync(HTMLSpanElement, "span#direction");
		const buttonConvert = await body.getElementAsync(HTMLButtonElement, "button#convert");
		const divReport = await body.getElementAsync(HTMLDivElement, "div#report");
		const spanReportBound = await body.getElementAsync(HTMLSpanElement, "span#report-bound");
		const spanReportInherited = await body.getElementAsync(HTMLSpanElement, "span#report-inherited");
		const spanReportUnread = await body.getElementAsync(HTMLSpanElement, "span#report-unread");
		const tableReportKeys = await body.getElementAsync(HTMLTableElement, "table#report-keys");
		this.#renderer = new ConverterRenderer(inputSource, dfnStatus, spanDirection, buttonConvert, divReport, spanReportBound, spanReportInherited, spanReportUnread, tableReportKeys);

		const bridge = new ClientBridge();
		const service = new VocabularyService(bridge, new URL(baseURI));
		const [roles, androidPlatform, desktopPlatform] = await Promise.all([
			service.loadRoles(),
			service.loadAndroidPlatform(),
			service.loadDesktopPlatform(),
		]);
		this.#platforms = [androidPlatform, desktopPlatform];
		this.#converter = new Converter(roles);

		this.#renderer.addEventListener("sourcechange", this.#onSourceChange.bind(this));
		this.#renderer.addEventListener("convertrequested", this.#onConvertRequested.bind(this));
		this.#renderer.hideReport();

		MetadataInjector.inject({
			type: "Application",
			name: "Telegram theme converter",
			webpage: new URL(baseURI),
			preview: new URL("../icons/swap.png", baseURI),
			description: "Converts Telegram themes between Android (.attheme) and Desktop (.tdesktop-theme) through a hand-authored, semantically verified color mapping.",
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

		if (platform === null) {
			const extensions = this.#platforms.map(candidate => candidate.extension).join(" or ");
			this.#renderer.setDirection(String.empty);
			this.#renderer.setConvertEnabled(false);
			this.#renderer.setStatus(`Unrecognized file '${file.name}' - expected ${extensions}.`);
			return;
		}

		const target = this.#otherPlatform(platform);
		this.#renderer.setDirection(`${platform.label} → ${target.label}`);
		this.#renderer.setConvertEnabled(true);
	}

	async #convert(): Promise<void> {
		const file = this.#fileSource;
		const platform = this.#platformSource;
		if (file === null || platform === null) return;

		const target = this.#otherPlatform(platform);

		this.#renderer.setStatus("Converting…");
		const bytes = new Uint8Array(await file.arrayBuffer());

		const source = await platform.parse(bytes);
		const { theme, report } = this.#converter.convert(source, platform, target);
		const output = await theme.serialize(target.order());
		this.#renderer.download(output, platform.swapExtension(file.name, target), target.mimeType);
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
