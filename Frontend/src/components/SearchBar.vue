<template>
  <!-- search runs on Enter or button click -->
  <form class="search-bar" role="search" @submit.prevent="search">
    <div class="search-input-wrapper">
      <i class="fa fa-search search-icon" aria-hidden="true"></i>
      <input
          type="text"
          class="form-control input-field search-input"
          :placeholder="$t('searchBarPlaceholder')"
          :aria-label="$t('searchBarPlaceholder')"
          v-model="wordSearchQuery"
      />
      <i class="fa fa-xmark clear-icon" v-show="wordSearchQuery" @click="clearText" :title="$t('clearText')"></i>
    </div>
    <button class="btn search-button" type="submit">{{ $t('searchButton') }}</button>
  </form>
</template>

<style scoped>
.search-bar {
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
}

.search-input {
  height: 100%;
  padding-left: 2.5rem;
  padding-right: 2.5rem;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #708d81;
  pointer-events: none;
}

.clear-icon {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #708d81;
  cursor: pointer;
}

.search-button {
  padding: 0.5rem 1.75rem;
  font-weight: 600;
}
</style>

<script lang="ts">
import {Options, Vue} from 'vue-class-component';
import {Watch} from 'vue-property-decorator';
import {mapGetters, mapMutations} from 'vuex';

@Options({
  emits: ['newsearch'],
  computed: {
    ...mapGetters('searchParamsModule', ['searchParamsInstance'])
  },
  methods: {
    ...mapMutations('searchParamsModule', ['updateSearchWords'])
  }
})
export default class SearchBar extends Vue {
  [x: string]: any;

  wordSearchQuery: string = ''

  mounted(): void {
    this.wordSearchQuery = this.searchParamsInstance.words;
  }

  // words can also be changed from outside (URL, clear all)
  @Watch('searchParamsInstance.words') onAppliedWordsChanged(words: string) {
    this.wordSearchQuery = words;
  }

  search() {
    this.updateSearchWords(this.wordSearchQuery.trim());
    this.$emit('newsearch');
  }

  clearText() {
    this.wordSearchQuery = '';
    this.search();
  }
}
</script>
