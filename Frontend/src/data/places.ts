import axios from 'axios';
import { Place } from '@/types/Place';

let placesPromise: Promise<Place[]> | null = null;

// all places, loaded once
export function fetchPlaces(): Promise<Place[]> {
  if (!placesPromise) {
    placesPromise = axios.get(process.env.VUE_APP_API_URL + '/krajevnaImena/getAll')
      .then(response => response.data.map((entity: any) => {
        const corpusRaw = entity._source.corpus;
        return {
          ...entity._source,
          corpus: Array.isArray(corpusRaw) ? corpusRaw : [corpusRaw]
        } as Place;
      }))
      .catch(error => {
        placesPromise = null;
        throw error;
      });
  }
  return placesPromise;
}
