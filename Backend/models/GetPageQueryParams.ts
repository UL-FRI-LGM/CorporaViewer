import {PlaceName} from "./PlaceName";
import {CorpusSearchFilters} from "./CorpusSearchFilters";

export interface GetPageQueryParams {
    words: string;
    speaker: string[];
    placeNames: PlaceName[];
    personEntities: string;
    locationEntities: string;
    capTopics: string[];
    filters: CorpusSearchFilters;
    page: number;
    pitId?: string;
    searchAfterScore?: string;
    searchAfterDate?: string;
    searchAfterIndex?: string;
}
