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
import {Options, Vue} from 'vue-class-component';
import {Ref, Watch} from 'vue-property-decorator';
import {mapGetters, mapMutations} from 'vuex';
import {PdfHighlights, TranscriptHighlights} from '@/types/Highlights';
import {Pagination} from '@/types/Pagination';
import {AnnotationFactory} from "annotpdf";


@Options({
  props: {
    meeting_id: {
      type: String,
      required: true
    }
  },
  computed: {
    ...mapGetters('transcriptHighlightsModule', ['transcriptHighlightsInstance']),
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
      'updateNoMatchesCallback',
      'updatePdfViewer',
      'updatePdfJsLib',
      'updateOriginalPdfData',
      'updatePdfAnnotationFactory'
    ]),
    ...mapMutations('documentPaginationModule', [
      'updatePageFunctions',
      'resetPagination',
      'syncPageInput',
      'updateScrollPdfToPercent'
    ])
  },
  emits: ['loaded', 'loading', 'executeInitialSearch']

})

export default class PdfView extends Vue {
  [x: string]: any;

  get transcriptHighlights(): TranscriptHighlights {
    return this.transcriptHighlightsInstance;
  }

  get pdfHighlights(): PdfHighlights {
    return this.pdfHighlightsInstance;
  }

  get documentPagination(): Pagination {
    return this.documentPaginationInstance;
  }

  @Ref('pdfContainer') pdfContainer!: HTMLDivElement;

  meeting_id?: string;
  firstLoading = true;

  eventBus?: pdfjsViewer.EventBus;
  pdfLinkService?: pdfjsViewer.PDFLinkService;
  pdfViewer?: pdfjsViewer.PDFViewer;
  pdfSource?: string;
  previousWindowWidth = 1;

  pageDimensions: { width: number, height: number } = {width: 0, height: 0};
  topScrollOffset: number = 0;
  currentPage: number = 1;


  @Watch('currentPage') onPageChange() {
    this.syncPageInput(this.updateMatchesCount);
  }

  mounted() {
    window.addEventListener('resize', () => {
      this.pdfViewer!.currentScaleValue = 'page-width';

      if (!this.matchLoading) {
        this.previousWindowWidth = this.pdfViewer!.currentScale;
        this.calculatePageDimensions();
      }
    })

    this.pdfSource = process.env.VUE_APP_API_URL + '/pdf/getById/' + this.meeting_id
    this.initPdfViewer();
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

    this.pdfViewer = new pdfjsViewer.PDFViewer({
      container: this.pdfContainer,
      eventBus: this.eventBus,
      linkService: this.pdfLinkService,
    });

    this.eventBus.on('pagesinit', () => {
      this.pdfViewer!.currentScaleValue = 'page-width';
    });

    this.eventBus.on('textlayerrendered', (event: any) => {
      if (this.firstLoading) {
        this.firstLoading = false;
        this.$emit('executeInitialSearch');
      }
    })

    this.eventBus.on('pagesloaded', (event: any) => {
      this.calculatePageDimensions();
      this.syncPageInput(this.getPage());

      this.updatePageFunctions({
        getPage: this.getPage,
        setPage: this.setPage,
        total: this.total
      });

      this.pdfContainer.addEventListener('scroll', () => {
        this.calculateCurrentPage();
        this.documentPagination.pdfScrollPercent = (
            this.pdfContainer.scrollTop /
            (this.pdfContainer.scrollHeight - this.pdfContainer.clientHeight)
        );
      });

      this.pdfContainer.style.scrollBehavior = 'auto';
      if (this.pdfHighlights.total === 0) {
        this.pdfContainer.scrollTop = this.documentPagination.transcriptScrollPercent * (this.pdfContainer.scrollHeight - this.pdfContainer.clientHeight);
      } else {
        this.findHighlight();
      }
      this.pdfContainer.style.scrollBehavior = 'smooth';

      this.$emit('loaded');
    });

    // Get the PDF data from the server or cache
    let src = this.pdfHighlights.pdfAnnotationFactory === undefined ?
        {url: this.pdfSource!} : {data: this.pdfHighlights.pdfAnnotationFactory.write().slice(0)};
    pdfjs.getDocument(src).promise.then((pdf: any) => {
      // Display the PDF
      this.pdfViewer!.setDocument(pdf);
      // Cache the original PDF data for highlighting
      if (this.pdfHighlights.pdfAnnotationFactory === undefined) {
        pdf.getData().then((data: any) => {
          this.updatePdfAnnotationFactory(new AnnotationFactory(data));
        });
      }
    });

    this.initHighlightsParams();
  }

  findHighlight() {
    const currentIndex = Math.min(Math.max(this.transcriptHighlights.index, 0), this.pdfHighlights.highlights.length - 1);
    this.pdfHighlights.updateIndexChanges(currentIndex);
    this.pdfHighlights.scrollToHighlight();
  }

  calculatePageDimensions() {
    this.topScrollOffset = this.pdfContainer.scrollTop
    this.pageDimensions = {
      width: this.pdfContainer.clientWidth,
      height: this.pdfContainer.scrollHeight / this.total()
    }
  }

  calculateCurrentPage() {
    this.currentPage = 1;
    this.currentPage = this.pageDimensions.height == 0 ? 1 : Math.round(this.pdfContainer.scrollTop / this.pageDimensions.height) + 1;
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


  initHighlightsParams() {
    this.updateSource(this);
    this.updatePdfJsLib(pdfjs);
    this.updateEventBus(this.eventBus);
    this.updatePdfViewer(this.pdfViewer);
  }
}
</script>
