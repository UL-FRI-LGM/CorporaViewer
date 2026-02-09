import * as PdfJsViewer from 'pdfjs-dist/web/pdf_viewer';
import {reactive} from 'vue';
import {AnnotationFactory} from 'annotpdf';
import {Rect} from "@/types/Rect";
import i18n from '@/data/i18setup';

export abstract class HighlightsAbstract {

    // variables
    looseSearch: boolean = false;
    index?: number;
    touched?: boolean;
    total?: number;


    // functions
    abstract clearMatches: () => void;
    abstract scrollToHighlight: (...params: any) => void;
    abstract nextHighlight: () => void;
    abstract previousHighlight: () => void;
}

// -----------------------------
// Transcript highlights
// -----------------------------

export abstract class TranscriptHighlightsAbstract extends HighlightsAbstract {
    // variables
    highlights?: NodeListOf<Element>;
    container?: HTMLDivElement;
    transcript?: string;
    originalTranscript?: string;

    // functions
    abstract applyTranscript: () => void;
    abstract displayHighlights: (highlightsIds: string[][]) => void;

    // callbacks
    abstract updateTranscriptIndex: (index: number) => void;
    abstract updateTranscriptTotal: (total: number) => void;
}

export class TranscriptHighlights extends TranscriptHighlightsAbstract {

    static create(): TranscriptHighlights {
        return reactive(new TranscriptHighlights()) as TranscriptHighlights;
    }

    touched: boolean = false;
    index: number = -1;
    total: number = 0;
    transcript: string = "";
    originalTranscript: string = "";

    updateAndApplyIndexChanges(index: number) {
        this.index = index;
        this.updateTranscriptIndex(this.index);
        this.applyCurrentHighlightClass();
    }

    updateAndApplyTotalChanges(total: number) {
        this.total = total;
        this.updateTranscriptTotal(this.total);
    }

    applyCurrentHighlightClass = () => {
        if (this.highlights && this.highlights.length > 0) {
            this.highlights.forEach((highlight: Element, i: number) => {
                if (i == this.index) highlight.classList.add('current-transcript-highlight');
                else highlight.classList.remove('current-transcript-highlight');
            });
        }
    }

    displayHighlights: (highlightsIds: string[][]) => void = (highlightsIds: string[][]) => {
        this.clearMatches();

        let transcriptContent = new DOMParser().parseFromString(this.transcript, 'text/html');

        for (const ids of highlightsIds) {

            const firstHighlightId = ids[0];
            const firstChild = transcriptContent.getElementById(firstHighlightId);
            if (!firstChild) {
                continue;
            }

            const newParent = transcriptContent.createElement('span');
            newParent.classList.add('transcript-highlight');
            firstChild.parentNode?.insertBefore(newParent, firstChild);

            ids.forEach((id: string) => {
                const element = transcriptContent.getElementById(id);
                if (element) {
                    const prevTextNode = element.previousSibling;
                    if (prevTextNode && prevTextNode.nodeType === Node.TEXT_NODE) {
                        newParent.appendChild(prevTextNode);
                    }
                    newParent.appendChild(element);
                }
            });
        }

        this.transcript = transcriptContent.body.innerHTML;
        if (this.container) {
            this.container.innerHTML = this.transcript;
            this._saveHighlights(true);
        }
    }

    private _saveHighlights = (shouldScrollToHighlight: boolean) => {
        this.highlights = this.container?.querySelectorAll(`.transcript-highlight`);
        if (this.highlights && this.highlights?.length > 0) {
            this.updateAndApplyIndexChanges(0);
            this.updateAndApplyTotalChanges(this.highlights.length)
            this.touched = true;
            if (shouldScrollToHighlight) this.scrollToHighlight();
        }
    }

    scrollToHighlight = () => {
        if (this.highlights && this.highlights.length > 0) {
            const highlight = this.highlights[this.index];
            highlight.scrollIntoView({block: 'center'});
        }
    }

    clearMatches = () => {
        this.transcript = this.originalTranscript;
        if (this.container) this.container.innerHTML = this.transcript;
        this.highlights = undefined;
        this.updateAndApplyIndexChanges(-1);
        this.updateAndApplyTotalChanges(0);
        this.touched = true;
    }

    nextHighlight: () => void = () => {
        this.touched = true;
        this.updateAndApplyIndexChanges((this.index + 1) % this.total);
        this.scrollToHighlight();
    }

    previousHighlight: () => void = () => {
        this.touched = true;
        this.updateAndApplyIndexChanges((this.index - 1 + this.total) % this.total);
        this.scrollToHighlight();
    }

    updateTranscriptIndex: (index: number) => void = (index: number) => {
        console.log("updateTranscriptIndex not implemented");
    };

    updateTranscriptTotal: (total: number) => void = (total: number) => {
        console.log("updateTranscriptTotal not implemented");
    };

    applyTranscript: () => void = () => {
        if (this.container && this.transcript) {
            this.container.innerHTML = this.transcript;
            this._saveHighlights(false);
        } else {
            console.error("container not defined");
        }
    }
}

// -----------------------------
// PDF highlights
// -----------------------------


export class PdfHighlight {
    rects: Rect[];
    centerY: number;

    constructor(rects: Rect[]) {
        this.rects = rects;
        this.centerY = rects[0].coordinates[0].y0
    }
}

export abstract class PdfHighlightsAbstract extends HighlightsAbstract {
    // variables
    highlights: PdfHighlight[] = [];
    eventBus?: PdfJsViewer.EventBus;
    pdfViewer?: PdfJsViewer.PDFViewer;
    pdfAnnotationFactory?: AnnotationFactory;
    pdfjsLib?: any;
    source?: any;

    // functions
    abstract displayHighlights: (highlightRects: Rect[][]) => void;
    abstract onMatchesFound: (event: any) => void;
    abstract onNoMatchesFound: () => void;
    abstract refreshHighlights: () => void;
    abstract displayedHighlights: () => string;

    // callbacks
    abstract scrollToHighlight: () => void;
    abstract prepHighlightBeforeScrolling: (performedAction: 'find' | 'resize' | 'next' | 'prev') => void;

}

export class PdfHighlights extends PdfHighlightsAbstract {

    static create(): PdfHighlights {
        return reactive(new PdfHighlights()) as PdfHighlights;
    }

    // variables
    touched: boolean = false;
    index: number = -1;
    total: number = 0;
    eventBus?: PdfJsViewer.EventBus = undefined;
    pdfViewer?: PdfJsViewer.PDFViewer = undefined;
    pdfAnnotationFactory?: AnnotationFactory = undefined;
    originalPdf?: Uint8Array = undefined;

    updateIndexChanges(index: number) {
        this.index = index;
    }

    updateTotalChanges(total: number) {
        this.total = total;
    }

    displayHighlights = async (highlightRects: Rect[][]) => {
        await this.clearMatches();

        for (const rects of highlightRects) {
            if (!rects || rects.length == 0 || !rects[0].coordinates) continue;

            // invert the y coordinates in the highlight rectangles
            for (const rect of rects) {
                let page = rect.page;
                let height = this.pdfViewer?._pages![page].viewport.viewBox[3];
                rect.coordinates.forEach(coordinate => {
                    coordinate.y0 = height - coordinate.y0;
                    coordinate.y1 = height - coordinate.y1;
                });
            }

            // Add the highlight to the highlights array (to keep position on the PDF)
            this.highlights.push(new PdfHighlight(rects));
            // Add the highlight to the PDF
            for (const rect of rects) {
                let quadPoints = rect.coordinates.map(coordinate => {
                    return [
                        coordinate.x0, coordinate.y0,
                        coordinate.x1, coordinate.y0,
                        coordinate.x0, coordinate.y1,
                        coordinate.x1, coordinate.y1
                    ];
                });
                this.pdfAnnotationFactory?.createHighlightAnnotation(
                    {
                        page: rect.page,
                        quadPoints: quadPoints.flat(),
                        opacity: 0.5,
                        color: {r: 255, g: 255, b: 0},

                    },
                );

            }
        }

        if (this.pdfAnnotationFactory !== undefined) {
            this.displayPdf(true);
        }
    }


    displayPdf = (shouldScrollToHighlight: boolean) => {
        this.eventBus!.on("pagesinit", () => {
            if (this.highlights && this.highlights.length > 0) {
                // scroll to the first highlight
                this.updateIndexChanges(0);
                this.updateTotalChanges(this.highlights.length);
                if (shouldScrollToHighlight) {
                    this.scrollToHighlight();
                }
            }
        });

        /*Don't ask me why or how... the main thing is that it works*/
        try {
            this.pdfjsLib.getDocument({
                data: this.pdfAnnotationFactory!.write().slice(0)
            }).promise.then((pdf: any) => {
                this.pdfViewer!.setDocument(pdf);
                this.touched = true;
            });
        } catch (error) {
            this.pdfjsLib.getDocument({
                data: this.pdfAnnotationFactory!.write().slice(0)
            }).promise.then((pdf: any) => {
                this.pdfViewer!.setDocument(pdf);
                this.touched = true;
            });
        }
    }

    onMatchesFound = (event: any) => {
        console.log("onMatchesFound", event);
        if (event.matchesCount.total == 0) {
            console.error('calling onMatchesFound with no matches, should not happen');
            return;
        }
        if (this.touched) {
            this.total = event.matchesCount.total;
            this.touched = false;
            //this._createPageMatches(event.source.pageMatches);
            this.index = 0;
            this.prepHighlightBeforeScrolling('find');
        }
    }

    refreshHighlights = () => {
        if (this.total > 0) this.prepHighlightBeforeScrolling('resize');
    }

    _reset = () => {
        this.index = -1;
        this.total = 0;
        this.highlights = [];
        this.touched = false;
    }

    onNoMatchesFound = () => {
        this._reset();
    }

    clearMatches = async () => {
        this._reset();
        const existingAnnotations = await this.pdfAnnotationFactory?.getAnnotations();
        if (!existingAnnotations) return;
        const flattenedAnnotations = existingAnnotations.flat();
        if (flattenedAnnotations && flattenedAnnotations.length > 0) {
            const annotationIdsToDelete = flattenedAnnotations.map(annot => annot.id);
            const deletePromises = annotationIdsToDelete.map(annotationId => this.pdfAnnotationFactory?.deleteAnnotation(annotationId));
            await Promise.all(deletePromises);
        }
    }


    scrollToHighlight: () => void = () => {
        if (!this.highlights || this.highlights!.length === 0)
            return;

        const currentHighlight = this.highlights[this.index];
        const pageNumber = currentHighlight.rects[0].page;
        const containerHeight = this.pdfViewer!._pages![pageNumber].viewport.viewBox[3];
        const centerOffsetY = currentHighlight.centerY + containerHeight / 6;

        this.pdfViewer!.scrollPageIntoView({
            pageNumber: pageNumber + 1,
            destArray: [null, {name: "XYZ"}, 0, centerOffsetY, null],
            allowNegativeOffset: true
        });
    }

    prepHighlightBeforeScrolling: (performedAction: 'find' | 'resize' | 'next' | 'prev') => void = () => {
        console.log("prepHighlightBeforeScrolling not implemented");
    }

    nextHighlight = () => {
        this.updateIndexChanges((this.index + 1) % this.total);
        this.scrollToHighlight();
    }

    previousHighlight = () => {
        this.updateIndexChanges((this.index - 1 + this.total) % this.total);
        this.scrollToHighlight();
    }

    displayedHighlights = () => {
        if (this.total == 0) {
            return "";
        } else {
            return i18n.global.t('highlights.count', {
                current: this.index + 1,
                total: this.total
            }) as string;
        }
    }
}
