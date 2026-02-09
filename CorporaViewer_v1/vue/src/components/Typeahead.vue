<template>
    <div class="typeahead-container">
        <input
            class="form-control input-field"
            type="text"
            v-model="searchedItem"
            @focus="clearAndShow()"
            @blur="hideList()"
            @input="filterItems()"
            @keyup.esc="hideList()"
            :placeholder="placeholder"
        />
        <div class="reset-icon">
            <i class="fa fa-xmark" v-show="searchedItem" @click="reset"></i>    
        </div>
        <div class="autocomplete-dropdown" v-show="isDropdownVisible" @mouseenter.native="preventBlur" @mouseleave.native="enableBlur">
            <div
                class="autocomplete-item"
                v-for="item in filteredList"
                @click="selectItem(item)"
            >
                {{ displayFn(item) }}
            </div>
        </div>
    </div>
</template>

<style scoped>
.input-field {
    overflow-x: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    padding-right: 2rem;
}
.typeahead-container {
    position: relative;
    width: 100%;
}

.autocomplete-dropdown {
    text-align: left;
    position: absolute;
    width: 100%;
    height: max-content;
    max-height: 30rem;
    overflow-y: scroll;
    background-color: #39393b;
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
    padding: 20px;
    color: #f0f7ee;
    z-index: 10;
}

.autocomplete-item {
    padding: 0.2rem;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    overflow-x: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.autocomplete-item:hover {
    background-color: #f0f7ee30;
    border-radius: 5px;
}

.reset-icon {
    position: absolute;
    right: 0.5rem;
    top: 0.5rem;
    color: #708d81;
    cursor: pointer;
    z-index: 10;
}

</style>

<script setup lang="ts" generic="T">
import { ref, defineProps, Ref, computed, watch } from 'vue';
import { useStore } from 'vuex';

const props = defineProps<{
    placeholder: string
    list: T[]
    displayFn: (item: T) => string
    emptyItem?: T
    getter: () => T
    clearOnFocus?: boolean
}>()

const emits = defineEmits([
    'selectedChange',
    'searchChange'
])

watch(() => props.getter(), () => {
    searchedItem.value = props.getter() ? props.displayFn(props.getter()) : ''
})

const placeholder = computed(() => props.placeholder)
const list = computed(() => props.list)
const displayFn = computed(() => props.displayFn)
const emptyItem = computed(() => props.emptyItem)
const getter = computed(() => props.getter)
const clearOnFocus = computed(() => props.clearOnFocus || true)

const store = useStore()

const searchedItem = ref(getter.value() ? displayFn.value(getter.value()) : '') as Ref<string>
const filteredList = ref<T[]>([]) as Ref<T[]>
const isDropdownVisible = ref(false)
const blurEnabled = ref(true)


watch(() => searchedItem.value, () => {
    emits('searchChange', searchedItem.value)
})

const filterItems = () => {
    filteredList.value = list.value.filter((item: T) => {
        return displayFn.value(item).toLowerCase().includes(searchedItem.value.toLowerCase() || '')
    })
    if (filteredList.value.length > 0) {
        isDropdownVisible.value = true
    } else {
        hideList()
    }
}

const clearAndShow = () => {
    if (clearOnFocus.value) {
        searchedItem.value = ''
        emits('selectedChange', emptyItem.value)
        filterItems()
    }
}

const reset = () => {
    searchedItem.value = ''
    emits('selectedChange', emptyItem.value)
    hideList()
}

const selectItem = (item: T) => {
    blurEnabled.value = true
    searchedItem.value = displayFn.value(item)
    emits('selectedChange', item)
    hideList()
}

const hideList = () => {
    if (blurEnabled.value) {
        isDropdownVisible.value = false
    }
}

const preventBlur = () => {
    blurEnabled.value = false
}

const enableBlur = () => {
    blurEnabled.value = true
}

</script>