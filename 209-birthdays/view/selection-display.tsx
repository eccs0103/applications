"use strict";

import "adaptive-extender/web";
import { type ReactElement, type RefObject, useEffect, useRef } from "react";
import { type SelectionContent } from "../models/selection-content.js";
import { SelectionFade } from "./selection-fade.js";

//#region Selection display
export interface SelectionDisplayProps {
	content: SelectionContent;
}

export function SelectionDisplay({ content }: SelectionDisplayProps): ReactElement {
	const refTitle: RefObject<HTMLHeadingElement | null> = useRef(null);
	const refAuxiliary: RefObject<HTMLElement | null> = useRef(null);
	const refFade: RefObject<SelectionFade | null> = useRef(null);

	// SelectionFade writes the text onto the DOM nodes, not through JSX children: the fade-out must finish showing the old text before the new one is written, which a re-render cannot sequence
	useEffect(() => {
		const h4SelectionTitle = refTitle.current;
		const dfnSelectionAuxiliary = refAuxiliary.current;
		if (h4SelectionTitle === null || dfnSelectionAuxiliary === null) return;
		if (refFade.current === null) refFade.current = new SelectionFade(h4SelectionTitle, dfnSelectionAuxiliary);
		refFade.current.update(content.title, content.auxiliary, content.animate);
	}, [content]);

	return (
		<div id="picker-container" className="with-block-padding flex column main-center">
			<h4 id="selection-title" ref={refTitle}></h4>
			<dfn id="selection-auxiliary" ref={refAuxiliary}></dfn>
		</div>
	);
}
//#endregion
