import {PlaceName} from "./PlaceName";
import {CorpusSearchFilters} from "./CorpusSearchFilters";
import {AdvancedQuery} from "./AdvancedQuery";

export interface GetPageQueryParams {
    words: string;
    speaker: string[];
    placeNames: PlaceName[];
    personEntities: string;
    locationEntities: string;
    capTopics: string[];
    // advanced search, used instead of words and entity filters
    advanced?: AdvancedQuery;
    filters: CorpusSearchFilters;
    page: number;
    pitId?: string;
    searchAfterScore?: string;
    searchAfterDate?: string;
    searchAfterIndex?: string;
}
