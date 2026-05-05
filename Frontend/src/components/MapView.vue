<template>
  <div class="map-wrapper">
    <div ref="mapEl" class="map-container"></div>
    <button class="map-toggle-btn" @click="toggleMode" :title="mode === 'circles' ? 'Preklopi na toplotno karto' : 'Preklopi na pike'">
      {{ mode === 'circles' ? '🌡' : '●' }}
    </button>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 1rem;
}
.map-container {
  height: 300px;
  width: 100%;
}
.map-toggle-btn {
  position: absolute;
  bottom: 28px;
  right: 10px;
  z-index: 1;
  background: white;
  border: 2px solid rgba(0,0,0,0.2);
  border-radius: 4px;
  width: 30px;
  height: 30px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.map-toggle-btn:hover {
  background: #f4f4f4;
}
</style>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import maplibregl, { Map, Popup, GeoJSONSource, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapLocation {
  name: string;
  lat: string;
  lon: string;
  count?: number;
}

const KRANJSKA_CENTER: [number, number] = [14.5, 46.1];
const DEFAULT_ZOOM = 9;
const SINGLE_MARKER_ZOOM = 11;
const SOURCE_ID = 'locations';
const LAYER_ID = 'locations-circle';
const HEATMAP_LAYER_ID = 'locations-heat';

@Options({})
export default class MapView extends Vue {
  @Prop({ default: () => [] }) locations!: MapLocation[];

  private map: Map | null = null;
  private popup: Popup | null = null;
  private mapLoaded = false;
  mode: 'circles' | 'heatmap' = 'circles';

  mounted(): void {
    this.map = new maplibregl.Map({
      container: this.$refs.mapEl as HTMLElement,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: KRANJSKA_CENTER,
      zoom: DEFAULT_ZOOM
    });

    this.popup = new maplibregl.Popup({ closeButton: false, closeOnClick: true });

    this.map.on('load', () => {
      this.mapLoaded = true;

      this.map!.addSource(SOURCE_ID, { type: 'geojson', data: this.buildGeoJson() });

      this.map!.addLayer({
        id: HEATMAP_LAYER_ID,
        type: 'heatmap',
        source: SOURCE_ID,
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 1, 0.4, 100, 1],
          'heatmap-intensity': 1.5,
          'heatmap-radius': 35,
          'heatmap-opacity': 0.85,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(240,247,238,0)',
            0.2, '#a8c5b5',
            0.5, '#708D81',
            0.8, '#4a6b5e',
            1,   '#1e1e24'
          ]
        }
      });

      this.map!.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: { visibility: 'visible' },
        paint: {
          'circle-radius': 8,
          'circle-color': '#708D81',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#1e1e24',
          'circle-opacity': 0.85
        }
      });

      this.map!.on('click', LAYER_ID, (e) => {
        const feature = e.features?.[0];
        if (!feature || !this.map) return;
        const coords = (feature.geometry as any).coordinates as [number, number];
        const name = feature.properties?.name ?? '';
        const count = feature.properties?.count ?? 1;
        this.popup!.setLngLat(coords).setHTML(`${name} (${count})`).addTo(this.map);
      });

      this.map!.on('mouseenter', LAYER_ID, () => { if (this.map) this.map.getCanvas().style.cursor = 'pointer'; });
      this.map!.on('mouseleave', LAYER_ID, () => { if (this.map) this.map.getCanvas().style.cursor = ''; });

      this.fitToLocations();
    });
  }

  unmounted(): void {
    this.popup?.remove();
    this.map?.remove();
    this.map = null;
    this.popup = null;
    this.mapLoaded = false;
  }

  @Watch('locations', { deep: true })
  onLocationsChanged(): void {
    if (!this.mapLoaded || !this.map) return;
    (this.map.getSource(SOURCE_ID) as GeoJSONSource).setData(this.buildGeoJson());
    this.fitToLocations();
  }

  private buildGeoJson(): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: this.locations
        .filter(loc => !isNaN(parseFloat(loc.lat)) && !isNaN(parseFloat(loc.lon)))
        .map(loc => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [parseFloat(loc.lon), parseFloat(loc.lat)] },
          properties: { name: loc.name, count: loc.count ?? 1 }
        })) as GeoJSON.Feature[]
    };
  }

  toggleMode(): void {
    if (!this.mapLoaded || !this.map) return;
    this.mode = this.mode === 'circles' ? 'heatmap' : 'circles';
    this.map.setLayoutProperty(LAYER_ID, 'visibility', this.mode === 'circles' ? 'visible' : 'none');
    this.map.setLayoutProperty(HEATMAP_LAYER_ID, 'visibility', this.mode === 'heatmap' ? 'visible' : 'none');
  }

  private fitToLocations(): void {
    if (!this.map) return;
    const valid = this.locations.filter(loc => !isNaN(parseFloat(loc.lat)) && !isNaN(parseFloat(loc.lon)));
    if (valid.length === 1) {
      this.map.flyTo({ center: [parseFloat(valid[0].lon), parseFloat(valid[0].lat)], zoom: SINGLE_MARKER_ZOOM });
    } else if (valid.length > 1) {
      const bounds = new LngLatBounds();
      valid.forEach(loc => bounds.extend([parseFloat(loc.lon), parseFloat(loc.lat)]));
      this.map.fitBounds(bounds, { padding: 40 });
    } else {
      this.map.flyTo({ center: KRANJSKA_CENTER, zoom: DEFAULT_ZOOM });
    }
  }
}
</script>
