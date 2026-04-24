export interface GetPageRequestQuery {
    words?: string;
    speaker?: string;
    place?: string;
    personEntities?: string;
    locationEntities?: string;
    capTopics?: string | string[];
    dateFrom?: string;
    dateTo?: string;
    languages?: string;
    corpora?: string;
    sort?: string;
    pitId?: string;
    searchAfterScore?: string;
    searchAfterDate?: string;
    searchAfterIndex?: string;
}
