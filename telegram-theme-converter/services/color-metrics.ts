"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";

//#region Color metrics
/**
 * Perceptual color metrics used for polarity detection and contrast/accuracy assertions.
 * `Color.lightness` from `adaptive-extender` is HSL lightness, not perceptual luminance -
 * `#ffff00` reads as 50% HSL lightness but 93% relative luminance - so polarity detection and
 * WCAG contrast both need these, not the HSL channel.
 */
export class ColorMetrics {
	static #linearize(channel: number): number {
		const normalized = channel / 255;
		if (normalized <= 0.04045) return normalized / 12.92;
		return ((normalized + 0.055) / 1.055) ** 2.4;
	}

	/**
	 * WCAG relative luminance in [0 - 1]. Ignores alpha: callers that care about a color's
	 * effect over a background must composite first.
	 */
	static relativeLuminance(color: Readonly<Color>): number {
		const red = ColorMetrics.#linearize(color.red);
		const green = ColorMetrics.#linearize(color.green);
		const blue = ColorMetrics.#linearize(color.blue);
		return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
	}

	/**
	 * WCAG contrast ratio in [1 - 21]. 4.5:1 is the WCAG AA threshold for normal text,
	 * 3:1 for large text and graphical/icon elements.
	 */
	static contrastRatio(first: Readonly<Color>, second: Readonly<Color>): number {
		const firstLuminance = ColorMetrics.relativeLuminance(first);
		const secondLuminance = ColorMetrics.relativeLuminance(second);
		const lighter = Math.max(firstLuminance, secondLuminance);
		const darker = Math.min(firstLuminance, secondLuminance);
		return (lighter + 0.05) / (darker + 0.05);
	}

	static #pivot(value: number): number {
		return value > 0.008856 ? Math.cbrt(value) : (7.787 * value) + (16 / 116);
	}

	static #toLab(color: Readonly<Color>): readonly [number, number, number] {
		const red = ColorMetrics.#linearize(color.red);
		const green = ColorMetrics.#linearize(color.green);
		const blue = ColorMetrics.#linearize(color.blue);

		const x = ColorMetrics.#pivot(((red * 0.4124) + (green * 0.3576) + (blue * 0.1805)) / 0.95047);
		const y = ColorMetrics.#pivot((red * 0.2126) + (green * 0.7152) + (blue * 0.0722));
		const z = ColorMetrics.#pivot(((red * 0.0193) + (green * 0.1192) + (blue * 0.9505)) / 1.08883);

		return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
	}

	/**
	 * CIE76 perceptual distance (Delta E) between two colors in CIE Lab space. Ignores alpha.
	 * A difference below ~2.3 is generally imperceptible; the accuracy oracle in the test suite
	 * uses a wider threshold because it compares colors across two independently designed platforms,
	 * not the same color under measurement noise.
	 */
	static perceptualDistance(first: Readonly<Color>, second: Readonly<Color>): number {
		const [firstLightness, firstA, firstB] = ColorMetrics.#toLab(first);
		const [secondLightness, secondA, secondB] = ColorMetrics.#toLab(second);
		return Math.sqrt(((firstLightness - secondLightness) ** 2) + ((firstA - secondA) ** 2) + ((firstB - secondB) ** 2));
	}
}
//#endregion
