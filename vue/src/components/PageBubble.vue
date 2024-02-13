<template>
    <div class="page-bubble" :class="{ 'show-outline': currentPage == page, 'red-digit': !results.isPageLoaded(page) }" @click="applyClick()">
        <h5>{{ page + 1 }}</h5>
    </div>
</template>

<style>
.page-bubble {
    width: 25px;
    height: 25px;
    background-color: #F0F7EE;
    color: #1E1E24;
    text-align: center;
    line-height: 20px;
    font-size: 12px;
    font-weight: bold;
    margin: 0 5px;
    cursor: pointer;
}

.page-bubble h5 {
    margin: 0;
    transition: all 0.1s ease-in-out;
}

.page-bubble.show-outline {
    border-bottom: 4px solid #708D81;
}

.page-bubble.show-outline h5 {
    color: #708D81;
}

.page-bubble:not(.red-digit) h5:hover {
    color: #708D81;
    transform: translateY(-0.1rem);
}

.disable {
    cursor: not-allowed;
    opacity: 0.5;
}

.red-digit {
    color: #F44336;
}

</style>

<script lang="ts">
import { Results } from '@/types/Results';
import { Options, Vue } from 'vue-class-component';
import { mapGetters } from 'vuex';

class Props {
    page!: number;
    currentPage!: number;
    onClick!: (page: number) => void;
}

@Options({
    computed: {
        ...mapGetters('resultsModule', ['resultsInstance']),
    }
})

export default class PageBubble extends Vue.with(Props) {
    [x: string]: any;

    get results(): Results {
        return this.resultsInstance;
    }

    applyClick() {
        if (this.results.isPageLoaded(this.page)) {
            this.onClick(this.page);
        }
    }   
}
</script>