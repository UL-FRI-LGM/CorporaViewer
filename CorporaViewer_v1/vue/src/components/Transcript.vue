<template>
    <div class="transcript-container" ref="transcriptContainer">
    </div>
</template>

<style>
.title-text {
    line-height: 2rem;
    text-align: center;
    border-bottom: 5px solid #708d81;
    color: #708d81;
    padding-bottom: 1rem;
}
.agendas-title {
    text-align: left;
    padding: 0.5rem;
    font-weight: bold;
}
.agenda-text {
    font-size: 1.1rem;
    line-height: 2rem;
    text-align: left;
    padding-left: 1rem;
    text-indent: 1rem;
}
.agendas {
    padding-bottom: 1rem;
    border-bottom: 5px solid #708d81;   
}
.segment-text {
    text-align: justify;
}
.speaker-text {
    text-align: left;
    padding-left: 2rem;
    font-weight: bold;
}
.transcript-highlight {
  background-color: rgb(255, 244, 161);
  color: #1e1e24;
  padding: 2px;
  border-radius: 5px;
}

.current-transcript-highlight {
    background-color: rgba(255, 169, 41, 0.847);
    padding: 2px;
    border-radius: 5px;
}
</style>

<script lang="ts">
import { PdfHighlights, TranscriptHighlights } from '@/types/Highlights';
import { Pagination } from '@/types/Pagination';
import { Options, Vue } from 'vue-class-component';
import { Watch, Ref } from 'vue-property-decorator';
import { mapGetters, mapMutations } from 'vuex';

@Options({
    emits: ['matchesChange'],
    computed: {
        ...mapGetters('transcriptHighlightsModule', ['transcriptHighlightsInstance']),
        ...mapGetters('documentPaginationModule', ['documentPaginationInstance']),
        ...mapGetters('pdfHighlightsModule', ['pdfHighlightsInstance'])
    },
    methods: {
        ...mapMutations('transcriptHighlightsModule', ['updateContainer'])
    }
})

export default class Transcript extends Vue {
    [x: string]: any;

    @Ref('transcriptContainer') transcriptContainer!: HTMLDivElement;
    transcriptScrollPercent!: number;

    get transcriptHighlights(): TranscriptHighlights {
        return this.transcriptHighlightsInstance;
    }
    get pagination(): Pagination {
        return this.documentPaginationInstance;
    }
    get pdfHighlights(): PdfHighlights {
        return this.pdfHighlightsInstance;
    }

    mounted() {
        this.initHighlightsParams();

        this.transcriptContainer.addEventListener('scroll', () => {
            this.pagination.transcriptScrollPercent = (
                this.transcriptContainer.scrollTop /
                (this.transcriptContainer.scrollHeight - this.transcriptContainer.clientHeight)
            );
        });

        if (this.transcriptHighlights.total === 0) {
            this.transcriptContainer.scrollTop = this.pagination.pdfScrollPercent * (this.transcriptContainer.scrollHeight - this.transcriptContainer.clientHeight);
        }
        else if (this.pdfHighlights.total === 0 && this.transcriptHighlights.total > 0) {
            this.findClosestHighlight();
        }
        else {
            this.transcriptContainer.scrollTop = this.pagination.pdfScrollPercent * (this.transcriptContainer.scrollHeight - this.transcriptContainer.clientHeight);
            this.findClosestHighlight();
        }
    }

    findClosestHighlight() {
        const highlights = this.transcriptContainer.querySelectorAll('.transcript-highlight') as NodeListOf<HTMLElement>;

        if (highlights.length === 0) {
            return;
        }

        // closest highlight to the center point of the container
        let containerCenterPoint = {
            verticalOffset: this.transcriptContainer.getBoundingClientRect().top + ( this.transcriptContainer.clientHeight / 2 ),
            horizontalOffset: this.transcriptContainer.getBoundingClientRect().left + ( this.transcriptContainer.clientWidth / 2 )
        };
        let closest = Array.from(highlights).reduce((prev, curr) => {
            const prevVertDist = Math.abs(prev.getBoundingClientRect().top - containerCenterPoint.verticalOffset);
            const currVertDist = Math.abs(curr.getBoundingClientRect().top - containerCenterPoint.verticalOffset);
            const prevHorizDist = Math.abs(prev.getBoundingClientRect().left - containerCenterPoint.horizontalOffset);
            const currHorizDist = Math.abs(curr.getBoundingClientRect().left - containerCenterPoint.horizontalOffset);
            return (
                prevVertDist < currVertDist || 
                (prevVertDist === currVertDist && prevHorizDist < currHorizDist)
            ) ? prev : curr;
        });

        let closestIndex = Array.from(highlights).indexOf(closest);
        
        closest.scrollIntoView({
            behavior: 'instant' as ScrollBehavior,
            block: 'center',
            inline: 'center'
        });

        this.transcriptHighlights.updateAndApplyIndexChanges(closestIndex);
    }

    initHighlightsParams() {
        this.updateContainer(this.transcriptContainer);
        this.transcriptHighlights.applyTranscript();
    }
}
</script>