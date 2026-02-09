<template>
    <div class="paging" v-if="numOfDocuments > 0">
        <div class="paging-content row">
            <div class="paging-row col-md-6">
                <PageBubble
                    v-if="displayFirstPage"
                    v-bind:page="0"
                    v-bind:currentPage="currentPage"
                    v-bind:onClick="onPageClick"
                ></PageBubble>
                <div v-if="displayFirstDots">
                    <h5> . . . </h5>
                </div>
                <div v-for="page in getShownPages()">
                    <PageBubble
                        v-bind:page="page"
                        v-bind:currentPage="currentPage"
                        v-bind:onClick="onPageClick"
                    ></PageBubble>
                </div>
                <div v-if="displayLastDots">
                    <h5> . . . </h5>
                </div>
            </div>
            <div class="paging-row col-md-6">
                <div class="paging-info">
                    <h5>{{ currentPage + 1}} {{ $t('of') }} {{ getLastPage() + 1 }}</h5>
                </div>
                <div class="paging-arrows">
                    <div class="paging-arrow" v-if="currentPage > 0" @click="onPreviousPageClick">
                        <i class="fas fa-chevron-left"></i>
                    </div>
                    <div class="paging-arrow" v-if="currentPage < getLastPage()" @click="onNextPageClick">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
.paging {
    margin-top: 20px;
    margin-bottom: 20px;
}

.paging-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.paging-row {
    background-color: #F0F7EE;
    border-radius: 30px;
    padding: 0.5rem 2rem;
    color: #1E1E24;
    display: flex;
    width: fit-content;
    align-items: center;
}

.paging-info {
    margin-right: 10px;
}

.paging-info h5 {
    margin: 0px;
}

.paging-arrows {
    display: flex;
    justify-content: flex-end;
    align-items: center;
}

.paging-arrow {
    margin-left: 10px;
    cursor: pointer;
}

.paging-arrow i {
    color: #1E1E24;
    transition: all 0.1s ease-in-out;
    font-size: large;
}

.paging-arrow i:hover {
    color: #708D81;
    transform: translateY(-0.1rem);
}

@media (max-width: 768px) {
    .paging-row {
        margin-top: 0.5rem;
    }
}
</style>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';
import PageBubble from '@components/PageBubble.vue';
import { mapGetters } from 'vuex';
import { Results } from '@/types/Results';

class Props {
    numOfDocuments!: number;
    currentPage!: number;
    pageSize!: number;
    pagesShown!: number;
}

@Options({
    components: {
        PageBubble
    },
    computed: {
        ...mapGetters('resultsModule', ['resultsInstance']),
    }
})

export default class Paging extends Vue.with(Props) {
    [x: string]: any;
    // booleans for displaying first and last page and dots

    get results(): Results {
        return this.resultsInstance;
    }

    displayFirstPage: boolean = false;
    displayFirstDots: boolean = false;

    displayLastPage: boolean = true;
    displayLastDots: boolean = true;

    onPageClick(page: number) {
        this.$emit('page-click', page);
    }

    onPreviousPageClick() {
        this.$emit('page-click', this.currentPage - 1);
    }

    onNextPageClick() {
        this.$emit('page-click', this.currentPage + 1);
    }

    getShownPages() {
        // calc start and end page
        let lastPage = this.getLastPage();
        let startPage = Math.max(0, this.currentPage - Math.floor(this.pagesShown / 2));
        let endPage = Math.min(lastPage, startPage + this.pagesShown - 1);
        startPage = Math.max(0, endPage - this.pagesShown + 1);

        // check if current page is far enough from the end to display last page
        if (endPage != lastPage) this.displayLastPage = true;
        else this.displayLastPage = false;

        // check if current page is far enough from the end to display last dots
        if (endPage < lastPage - 1) this.displayLastDots = true;
        else this.displayLastDots = false;

        // check if current page is far enough from the start to display first page
        if (startPage > 0) this.displayFirstPage = true;
        else this.displayFirstPage = false;

        // check if current page is far enough from the start to display first dots
        if (startPage > 1) this.displayFirstDots = true;
        else this.displayFirstDots = false;

        // return array of pages to be shown
        return Array.from({length: (endPage - startPage + 1)}, (_, i) => startPage + i);
    }

    getLastPage() {
        return Math.ceil(this.numOfDocuments / this.pageSize) - 1;
    }
}

</script>
