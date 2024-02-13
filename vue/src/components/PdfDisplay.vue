<template>
    <div id="viewerContainer" ref="pdfContainer" class="pdf-container">
        <div id="viewer" class="pdfViewer"></div>
    </div>
</template>

<script lang="ts">
import * as pdfjs from 'pdfjs-dist';
import * as pdfjsViewer from 'pdfjs-dist/web/pdf_viewer';
import 'pdfjs-dist/build/pdf.worker.entry';
import 'pdfjs-dist/web/pdf_viewer.css';
import { Options, Vue } from 'vue-class-component';
import { Watch, Ref } from 'vue-property-decorator';
import { mapGetters, mapMutations } from 'vuex';
import { PdfHighlights } from '@/types/Highlights';
import { Pagination } from '@/types/Pagination';


@Options({
    props: {
        meeting_id: {
            type: String,
            required: true
        },
        matchLoading: {
            type: Boolean,
            required: true
        },
    },
    computed: {
        ...mapGetters('pdfHighlightsModule', ['pdfHighlightsInstance']),
        ...mapGetters('documentPaginationModule', ['documentPaginationInstance'])
    },
    methods: {
        ...mapMutations('pdfHighlightsModule', [
            'updateEventBus',
            'updateSource',
            'updateMatchesCount',
            'updateNextHighlight',
            'updatePreviousHighlight',
            'updateScrollToHighlight',
            'updatePrepHighlightBeforeScrolling',
            'updateNoMatchesCallback'
        ]),
        ...mapMutations('documentPaginationModule', [
            'updatePageFunctions',
            'resetPagination',
            'syncPageInput',
            'updateScrollPdfToPercent'
        ])
    },
    emits: ['loaded', 'matchLoaded', 'loadingNewMatch', 'loading', 'executeInitialSearch']

})

export default class PdfView extends Vue {
    [x: string]: any;

    get pdfHighlights(): PdfHighlights {
        return this.pdfHighlightsInstance;
    }
    get documentPagination(): Pagination {
        return this.documentPaginationInstance;
    }

    @Ref('pdfContainer') pdfContainer!: HTMLDivElement;

    meeting_id?: string;
    firstLoading = true;

    pdf?: pdfjs.PDFDocumentProxy;
    eventBus?: pdfjsViewer.EventBus;
    pdfLinkService?: pdfjsViewer.PDFLinkService;
    pdfFindController?: pdfjsViewer.PDFFindController;
    pdfViewer?: pdfjsViewer.PDFViewer;
    pdfSource?: string;
    previousWindowWidth = 1;
    scrollingToTranscriptScrollPosition = false;

    pageDimensions: { width: number, height: number } = { width: 0, height: 0 };
    topScrollOffset: number = 0;
    currentPage: number = 1;
    private pageChangingPromise: Promise<void> | undefined = undefined;
    private pageChangingResolve: ((pageNumber: number) => void) = (pageNumber: number) => { };
    private textLayerRenderedPromise: Promise<void> | undefined = undefined;
    private textLayerRenderedResolve: ((pageNumber: number) => void) = (pageNumber: number) => { };
    private highlightChangesPromise: Promise<void> | undefined = undefined;
    private highlightChangesResolve: (() => void) = () => { };

    @Watch('matchLoading') onMatchLoadingChange() {
        if (!this.scrollingToTranscriptScrollPosition && !this.matchLoading && this.previousWindowWidth != window.outerWidth) {
            this.previousWindowWidth = window.outerWidth;
            this.calcualtePageDimensions();
            if (this.pdfHighlights.total > 0) this.pdfHighlights.refreshHighlights();
        }
    }

    @Watch('currentPage') onPageChange() {
        this.syncPageInput(this.currentPage);
        this.pageChangingResolve(this.currentPage);
    }

    mounted() {
        window.addEventListener('resize', () => {
            this.pdfViewer!.currentScaleValue = 'page-width';
            
            if (!this.matchLoading) {
                this.previousWindowWidth = this.pdfViewer!.currentScale;
                this.calcualtePageDimensions();
                if (this.pdfHighlights.total > 0) this.pdfHighlights.refreshHighlights();
            }
        })

        this.pdfSource = process.env.VUE_APP_API_URL + '/pdf/getById/' + this.meeting_id
        this.initPdfViewer();
    }

    scrollToPage(pageNumber: number) {
        this.pdfContainer.scrollTop = ((pageNumber - 1) * this.pageDimensions.height) + 5;
    }

    /**
     * Initializes the PDF viewer.
     */
    initPdfViewer() {
        this.$emit('loading');

        this.eventBus = new pdfjsViewer.EventBus();

        this.pdfLinkService = new pdfjsViewer.PDFLinkService({
            eventBus: this.eventBus
        });

        this.pdfFindController = new pdfjsViewer.PDFFindController({
            eventBus: this.eventBus,
            linkService: this.pdfLinkService,
            updateMatchesCountOnProgress: false
        });

        this.pdfFindController._scrollMatches = true;

        this.pdfViewer = new pdfjsViewer.PDFViewer({
            container: this.pdfContainer,
            eventBus: this.eventBus,
            linkService: this.pdfLinkService,
            findController: this.pdfFindController
        });

        this.eventBus.on('pagesloaded', (event: any) => {
            this.calcualtePageDimensions();
            this.calcualtePageDimensions();
            this.syncPageInput(this.getPage());
            this.pageChangingResolve(this.getPage());

            this.updatePageFunctions({
                getPage: this.getPage,
                setPage: this.setPage,
                total: this.total
            });
            this.$emit('loaded')
        });

        this.eventBus.on('textlayerrendered', (event: any) => {
            this.textLayerRenderedResolve(event.pageNumber);
            if (this.firstLoading) {
                this.firstLoading = false;
                this.$emit('executeInitialSearch');
            }
        })

        this.eventBus.on('pagesinit', () => {
            this.resetPagination();
            this.pdfViewer!.currentScaleValue = 'page-width';
        });

        this.eventBus.on('updatefindmatchescount', (event: any) => {
            if (event.matchesCount.total == 0) {
                this.pdfHighlights.onNoMatchesFound();
                this.$emit('matchLoaded')
            } else {
                this.updateMatchesCount(event);   
            }
        });

        pdfjs.getDocument({
            url: this.pdfSource!
        }).promise.then((pdf) => {
            this.pdf = pdf;
            this.pdfViewer!.setDocument(pdf);
            this.pdfFindController!.setDocument(pdf);
            this.pdfLinkService!.setViewer(this.pdfViewer);
            this.pdfLinkService!.setDocument(pdf, null);

            this.pdfContainer.addEventListener('scroll', () => {
                this.calculateCurrentPage();
                this.documentPagination.pdfScrollPercent = (
                    this.pdfContainer.scrollTop /
                    (this.pdfContainer.scrollHeight - this.pdfContainer.clientHeight)
                );
            });

            this.initHighlightsParams()
        });
    }

    doClearInterval(interval: any) {
        clearInterval(interval);
    }

    calcualtePageDimensions() {
        this.topScrollOffset = this.pdfContainer.scrollTop

        this.pageDimensions = {
            width: this.pdfContainer.clientWidth,
            height: this.pdfContainer.scrollHeight / this.total()
        }
    }

    calculateCurrentPage() {
        this.currentPage = this.pageDimensions.height == 0 ? 1 : Math.floor(this.pdfContainer.scrollTop / this.pageDimensions.height) + 1;
    }

    getPage() {
        return this.currentPage;
    }

    setPage(newPage: number) {
        if (this.pdfViewer!.currentPageNumber != newPage) {
            this.pdfViewer!.currentPageNumber = newPage;
        }
    }

    total() {
        return this.pdfViewer!.pagesCount;
    }

    getPageOfElement(element: HTMLElement) {
        const topOffset = element.getBoundingClientRect().top + this.pdfContainer.scrollTop;
        return Math.floor(topOffset / this.pageDimensions.height) + 1;
    }

    isElementOnPage(element: HTMLElement, pageNumber: number = this.getPage()) {
        const topOffset = element.getBoundingClientRect().top + this.pdfContainer.scrollTop;
        return this.getPageOfElement(element) == pageNumber || (
            this.getPageOfElement(element) == pageNumber + 1 &&
            (topOffset / this.pageDimensions.height) % 1 < 0.05
        )
    }

    // observes for highlight changes below current page
    async observeValidHighlightChanges() {
        // watch for changes where higlight class is added
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type == 'attributes' && mutation.attributeName == 'class') {
                    const target = mutation.target as HTMLElement;
                    if (target.classList.contains('highlight')) {
                        console.log('highlight added, resolving promise')
                        this.highlightChangesResolve();
                        observer.disconnect();
                    }
                }
            });
        });

        observer.observe(this.pdfContainer, {
            childList: true,
            subtree: true,
            attributes: true,
        });

        setTimeout(() => {
            this.highlightChangesResolve();
        }, 1000);

        this.highlightChangesPromise = new Promise((resolve) => {
            this.highlightChangesResolve = () => {
                resolve();
            }
        });

        await this.highlightChangesPromise;
        observer.disconnect();
    }

    addSelectedClassToCorrectElement(prev: boolean) {
        const highlights = this.pdfContainer.querySelectorAll(`.highlight`) as NodeListOf<HTMLElement>;
        // console.log('highlights', highlights)
        const distOfElementsFromSelected = this.getDistOfElementsFromSelected(highlights);

        if (distOfElementsFromSelected.length == 0) {
            console.error('no highlights found, should exist')
            return;
        }
        // if new index is 0 and we scrolled to next highlight, it means we scrolled from last to first element 
        else if (this.pdfHighlights.index == 0 && !prev) {
            // console.log('scrolled from last to first element')
            this.pdfContainer.querySelector(`.current-selected-highlight`)?.classList.remove('current-selected-highlight');
            const topMostElement = distOfElementsFromSelected.reduce((prev, current) => {
                return (prev.topOffset < current.topOffset || // different vert offset, we want the smallest one
                    (prev.topOffset == current.topOffset && prev.leftOffset < current.leftOffset)) // same vert offset, we want the leftmost one 
                    ? prev : current
            });
            topMostElement.element.classList.add('current-selected-highlight');
            this.scrollToHighlight();
        }
        // if new index is last and we scrolled to prev highlight, it means we scrolled from first to last element 
        else if (this.pdfHighlights.index == this.pdfHighlights.total - 1 && prev) {
            // console.log('scrolled from first to last element')
            this.pdfContainer.querySelector(`.current-selected-highlight`)?.classList.remove('current-selected-highlight');
            const bottomMostElement = distOfElementsFromSelected.reduce((prev, current) => {
                return (prev.topOffset > current.topOffset || // different vert offset, we want the biggest one
                    (prev.topOffset == current.topOffset && prev.leftOffset > current.leftOffset)) // same vert offset, we want the rightmost one 
                    ? prev : current
            });
            bottomMostElement.element.classList.add('current-selected-highlight');
            this.scrollToHighlight();
        }
        else if (prev) {
            // console.log('scrolled to prev highlight')
            const aboveElements = distOfElementsFromSelected.filter((element) => {
                return (element.above || (element.vertDistance == 0 && element.left));
            });
            if (aboveElements.length == 0) {
                console.error('no above elements found, should exist')
                return;
            }
            const closestAboveElement = aboveElements.reduce((prev, current) => {
                return (prev.vertDistance < current.vertDistance || // different vert distance, we want the closest one
                    (prev.vertDistance == current.vertDistance && prev.leftOffset > current.leftOffset)) // same vert distance, we want the rightmost one  
                    ? prev : current
            });
            this.pdfContainer.querySelector(`.current-selected-highlight`)?.classList.remove('current-selected-highlight');
            closestAboveElement.element.classList.add('current-selected-highlight');
            this.scrollToHighlight();
        }
        else {
            // console.log('scrolled to next highlight')
            const belowElements = distOfElementsFromSelected.filter((element) => {
                return element.below || (element.vertDistance == 0 && element.right);
            });
            if (belowElements.length == 0) {
                console.error('no below elements found, should exist')
                return;
            }
            const closestBelowElement = belowElements.reduce((prev, current) => {
                return (prev.vertDistance < current.vertDistance || // different vert distance, we want the closest one
                    (prev.vertDistance == current.vertDistance && prev.leftOffset < current.leftOffset)) // same vert distance, we want the leftmost one
                    ? prev : current
            });
            this.pdfContainer.querySelector(`.current-selected-highlight`)?.classList.remove('current-selected-highlight');
            closestBelowElement.element.classList.add('current-selected-highlight');
            this.scrollToHighlight();
        }
    }

    scrollToHighlight() {
        const highlightElement = this.pdfContainer.querySelector(`.current-selected-highlight`);
        // console.log(highlightElement)
        if (highlightElement) {
            highlightElement.scrollIntoView({
                behavior: 'instant' as ScrollBehavior,
                block: 'center',
                inline: 'center'
            });
            this.$emit('matchLoaded')
        } else {
            console.warn('no current-selected-highlight element, should be in buffer')
            console.warn(document.querySelectorAll('.highlight'))
            this.prepHighlightBeforeScrolling('resize');
        }
    }

    async prepHighlightBeforeScrolling(
        performedAction: 'find' | 'resize' | 'next' | 'prev'
    ) {
        this.$emit('loadingNewMatch');
        const newPageNumber = this.pdfHighlights.highlights[this.pdfHighlights.index].page + 1 
        
        console.log(newPageNumber)

        if (this.getPage() != newPageNumber) {
            console.log('page not loaded, waiting for it to be loaded')
            this.pageChangingPromise = new Promise((resolve) => {
                this.pageChangingResolve = (pageNumber: number) => {
                    if (pageNumber == newPageNumber) {
                        console.log('page changed')
                        resolve();
                    }
                }
            });

            console.log('scrolling to page', newPageNumber, this.pdfViewer)

            // this.pdfViewer!.scrollPageIntoView({
            //     pageNumber: newPageNumber,
            // })

            this.scrollToPage(newPageNumber);

            await this.pageChangingPromise;
        }

        const isPageCached = [...this.pdfViewer!.getCachedPageViews()].some(page => page.id == this.getPage());
        if (!isPageCached) {
            this.textLayerRenderedPromise = new Promise((resolve) => {
                this.textLayerRenderedResolve = (pageNumber: number) => {
                    if (pageNumber == this.getPage()) {
                        resolve();
                    }
                }
            });
            await this.textLayerRenderedPromise;
        } else if (Array.from(this.pdfContainer.querySelectorAll(`.highlight`)).filter((highlight) => {
            return this.isElementOnPage(highlight as HTMLElement);
        }).length == 0) {
            console.log('highlights not loaded, waiting for them to be loaded')
            await this.observeValidHighlightChanges();
        } else {
            console.log('highlights already loaded')
        }

        switch (performedAction) {
            case 'find':
                let currentHighlightFind = this.pdfContainer.querySelector(`.current-selected-highlight`);
                let highlightsFind = this.pdfContainer.querySelectorAll(`.highlight`) as NodeListOf<HTMLElement>;
                console.log('highlights', highlightsFind)

                // remove current selected highlight
                if (currentHighlightFind) {
                    currentHighlightFind.classList.remove('current-selected-highlight');
                }
                let highlightsOnCurrentPageFind = Array.from(highlightsFind).filter((highlight) => {
                    return this.isElementOnPage(highlight, newPageNumber);
                });

                console.log('highlights on current page', highlightsOnCurrentPageFind)

                // set class current selected highlight to found highlight on current page with topmost and leftmost position
                const topMostElement = highlightsOnCurrentPageFind.length > 1 ? highlightsOnCurrentPageFind.reduce((prev, current) => {
                    const prevBoundingRect = prev.getBoundingClientRect();
                    const currentBoundingRect = current.getBoundingClientRect();
                    return (prevBoundingRect.top < currentBoundingRect.top || // different vert offset, we want the smallest one
                        (prevBoundingRect.top == currentBoundingRect.top && prevBoundingRect.left < currentBoundingRect.left)) // same vert offset, we want the leftmost one 
                        ? prev : current
                }) : (highlightsOnCurrentPageFind.length == 1 ? highlightsOnCurrentPageFind[0] : undefined);

                topMostElement?.classList.add('current-selected-highlight');
                this.scrollToHighlight();
                break;
            case 'resize':
                if (window.outerWidth != this.previousWindowWidth) {
                    console.log('resize scale changed, this wil be handled by another method call')
                    this.$emit('matchLoaded')
                    return;
                }

                let currentHighlightResize = this.pdfContainer.querySelector(`.current-selected-highlight`);
                let highlightsResize = this.pdfContainer.querySelectorAll(`.highlight`) as NodeListOf<HTMLElement>;

                // remove current selected highlight
                if (currentHighlightResize) {
                    currentHighlightResize.classList.remove('current-selected-highlight');
                }

                console.log(this.currentPage)

                let highlightsOnCurrentPageResize = Array.from(highlightsResize).filter((highlight) => {
                    return this.isElementOnPage(highlight, newPageNumber);
                }).sort((a, b) => {
                    if (a.getBoundingClientRect().top == b.getBoundingClientRect().top) {
                        return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
                    }
                    return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
                });
                console.log('highlights on current page', highlightsOnCurrentPageResize)

                const indexOnPage = this.pdfHighlights.index - this.pdfHighlights.highlights.filter((highlight) => {
                    return highlight.page < this.getPage() - 1;
                }).length;
                console.log('index on page', indexOnPage)

                if (highlightsOnCurrentPageResize.length > 0 && indexOnPage < highlightsOnCurrentPageResize.length) {
                    const highlightToSelect = highlightsOnCurrentPageResize[indexOnPage];
                    highlightToSelect.classList.add('current-selected-highlight');
                }
                this.scrollToHighlight();
                break;
            case 'next':
                this.addSelectedClassToCorrectElement(false);
                this.scrollToHighlight();
                break;
            case 'prev':
                this.addSelectedClassToCorrectElement(true);
                this.scrollToHighlight();
                break;
        }

    }

    getDistOfElementsFromSelected(elements: NodeListOf<HTMLElement>): {
        element: HTMLElement,
        vertDistance: number,
        horizontalDistance: number,
        estimatedPagesAway: number,
        above: boolean,
        below: boolean,
        left: boolean,
        right: boolean,
        topOffset: number,
        leftOffset: number
    }[] {
        const selectedElement = this.pdfContainer.querySelector(`.current-selected-highlight`);
        const potentialHiglights = Array.from(elements).filter((element) => {
            return element != selectedElement;
        });

        if (!selectedElement) {
            console.error('no selected element, should be in buffer')
            return [];
        }

        const selectedElementTop = selectedElement!.getBoundingClientRect().top;
        const selectedElementLeft = selectedElement!.getBoundingClientRect().left;

        // calculate distance of each element from selected element
        const distOfElementsFromSelected: {
            element: HTMLElement,
            vertDistance: number,
            horizontalDistance: number,
            estimatedPagesAway: number,
            above: boolean,
            below: boolean,
            left: boolean,
            right: boolean,
            topOffset: number,
            leftOffset: number
        }[] = [];
        potentialHiglights.forEach((element) => {
            const vertDistance = Math.abs(element.getBoundingClientRect().top - selectedElementTop);
            const horizontalDistance = Math.abs(element.getBoundingClientRect().left - selectedElementLeft);
            distOfElementsFromSelected.push({
                element: element,
                vertDistance: vertDistance,
                horizontalDistance: horizontalDistance,
                estimatedPagesAway: Math.floor(vertDistance / this.pageDimensions.height),
                above: element.getBoundingClientRect().top < selectedElementTop,
                below: element.getBoundingClientRect().top > selectedElementTop,
                left: element.getBoundingClientRect().left < selectedElement.getBoundingClientRect().left,
                right: element.getBoundingClientRect().left > selectedElement.getBoundingClientRect().left,
                topOffset: element.getBoundingClientRect().top,
                leftOffset: element.getBoundingClientRect().left
            });
        });

        return distOfElementsFromSelected;
    }

    nextHighlight() {
        this.$emit('loadingNewMatch')

        if (this.pdfHighlights.total < 2) {
            console.error('no highlights to scroll to')
            return;
        } else if (this.matchLoading) {
            console.error('match loading, cannot scroll to next highlight, should not be able to call this')
            return;
        }

        const highlights = this.pdfContainer.querySelectorAll('.highlight') as NodeListOf<HTMLElement>;
        const distOfElementsFromSelected = this.getDistOfElementsFromSelected(highlights);
        const nearbyBelowElements = distOfElementsFromSelected.filter((element) => {
            return (element.below && element.estimatedPagesAway < 3) || (element.vertDistance == 0 && element.right);
        });
        if (nearbyBelowElements.length == 0) {
            this.prepHighlightBeforeScrolling('next');
        } else {
            const closestBelowElement = nearbyBelowElements.reduce((prev, current) => {
                return current.vertDistance < prev.vertDistance || // different vert distance, we want the closest one
                    (current.vertDistance == prev.vertDistance && current.leftOffset < prev.leftOffset) // same vert distance, we want the leftmost one
                    ? current : prev
            });
            this.pdfContainer.querySelector(`.current-selected-highlight`)?.classList.remove('current-selected-highlight');
            closestBelowElement.element.classList.add('current-selected-highlight');
            this.scrollToHighlight();
        }
    }

    previousHighlight() {
        this.$emit('loadingNewMatch')
        if (this.pdfHighlights.total < 2) {
            console.error('no highlights to scroll to')
            return;
        } else if (this.matchLoading) {
            console.log('match loading, cannot scroll to previous highlight, should not be able to call this')
            return;
        }

        const highlights = this.pdfContainer.querySelectorAll('.highlight') as NodeListOf<HTMLElement>;
        const distOfElementsFromSelected = this.getDistOfElementsFromSelected(highlights);
        const nearbyAboveElements = distOfElementsFromSelected.filter((element) => {
            return (element.above && element.estimatedPagesAway < 3) || (element.vertDistance == 0 && element.left);
        });
        if (nearbyAboveElements.length == 0) {
            this.prepHighlightBeforeScrolling('prev');
        } else {
            const closestAboveElement = nearbyAboveElements.reduce((prev, current) => {
                return current.vertDistance < prev.vertDistance || // different vert distance, we want the closest one
                    (current.vertDistance == prev.vertDistance && current.leftOffset > prev.leftOffset) // same vert distance, we want the rightmost one
                    ? current : prev
            });
            this.pdfContainer.querySelector(`.current-selected-highlight`)?.classList.remove('current-selected-highlight');
            closestAboveElement.element.classList.add('current-selected-highlight');
            this.scrollToHighlight();
        }
    }

    async scrollPdfToPercent(percent: number) {
        this.scrollingToTranscriptScrollPosition = true;
        this.$emit('loadingNewMatch')

        const newPageNumber = Math.floor(percent * this.total()) + 1;

        if (this.getPage() != newPageNumber) {
            console.log('page not loaded, waiting for it to be loaded')
            this.pageChangingPromise = new Promise((resolve) => {
                this.pageChangingResolve = (pageNumber: number) => {
                    if (pageNumber == newPageNumber) {
                        resolve();
                    }
                }
            });

            // this.pdfViewer!.scrollPageIntoView({
            //     pageNumber: Math.floor(newPageNumber),
            // });

            this.scrollToPage(Math.floor(newPageNumber));

            await this.pageChangingPromise;
        }

        this.previousWindowWidth = window.outerWidth;
        this.calcualtePageDimensions();
        this.scrollingToTranscriptScrollPosition = false;
        this.$emit('matchLoaded')
    }

    initHighlightsParams() {
        this.updateEventBus(this.eventBus);
        this.updateSource(this);
        this.updateNextHighlight(this.nextHighlight);
        this.updatePreviousHighlight(this.previousHighlight);
        this.pdfHighlights.onNoMatchesFound();
        this.updateScrollToHighlight(this.scrollToHighlight);
        this.updatePrepHighlightBeforeScrolling(this.prepHighlightBeforeScrolling);
        this.updateScrollPdfToPercent(this.scrollPdfToPercent);
    }
}
</script>