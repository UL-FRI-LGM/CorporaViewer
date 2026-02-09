import {OriginalLanguageSearchStrategy, TranslatedLanguageSearchStrategy} from "./SearchStrategy";

const getSearchStrategy = (lang: string | undefined) => {
    if (lang) {
        return new TranslatedLanguageSearchStrategy();
    } else {
        return new OriginalLanguageSearchStrategy();
    }
};

export default {getSearchStrategy};
