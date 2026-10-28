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
  height: 70vh;
  min-height: 400px;
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
import maplibregl, { Map, Popup, GeoJSONSource, LngLatBounds, MapLayerMouseEvent } from 'maplibre-gl';
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
// heatmap uses its own source without clustering
const HEATMAP_SOURCE_ID = 'locations-heatmap-source';
const LAYER_ID = 'locations-circle';
const HEATMAP_LAYER_ID = 'locations-heat';
const CLUSTER_LAYER_ID = 'locations-cluster';
const CLUSTER_COUNT_LAYER_ID = 'locations-cluster-count';
// clusters have "sum", single points have "count"
const WEIGHT_EXPR: maplibregl.ExpressionSpecification = ['case', ['has', 'point_count'], ['get', 'sum'], ['get', 'count']];

@Options({})
export default class MapView extends Vue {
  @Prop({ default: () => [] }) locations!: MapLocation[];
  // true when the map tab is shown (map needs a resize)
  @Prop({ default: true }) active!: boolean;

  private map: Map | null = null;
  private popup: Popup | null = null;
  private resizeObserver: ResizeObserver | null = null;
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

    // resize map when the container size changes
    this.resizeObserver = new ResizeObserver(() => this.map?.resize());
    this.resizeObserver.observe(this.$refs.mapEl as HTMLElement);

    this.map.on('load', () => {
      this.mapLoaded = true;

      this.map!.addSource(SOURCE_ID, {
        type: 'geojson',
        data: this.buildGeoJson(),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
        clusterProperties: { sum: ['+', ['get', 'count']] }
      });

      this.map!.addSource(HEATMAP_SOURCE_ID, { type: 'geojson', data: this.buildGeoJson() });

      this.map!.addLayer({
        id: HEATMAP_LAYER_ID,
        type: 'heatmap',
        source: HEATMAP_SOURCE_ID,
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
        id: CLUSTER_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: { visibility: 'visible' },
        paint: {
          'circle-radius': ['step', WEIGHT_EXPR, 14, 50, 18, 500, 24, 5000, 30],
          'circle-color': ['step', WEIGHT_EXPR, '#a8c5b5', 50, '#708D81', 500, '#4a6b5e', 5000, '#1e1e24'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.85
        }
      });

      this.map!.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          visibility: 'visible',
          'text-field': ['get', 'point_count'],
          'text-size': 12,
          'text-font': ['Noto Sans Bold']
        },
        paint: { 'text-color': '#ffffff' }
      });

      this.map!.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
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
        this.popup!.setLngLat(coords).setDOMContent(this.buildLocationRow(name, count)).addTo(this.map);
      });

      this.map!.on('click', CLUSTER_LAYER_ID, (e) => this.onClusterClick(e));

      this.map!.on('mouseenter', LAYER_ID, () => { if (this.map) this.map.getCanvas().style.cursor = 'pointer'; });
      this.map!.on('mouseleave', LAYER_ID, () => { if (this.map) this.map.getCanvas().style.cursor = ''; });
      this.map!.on('mouseenter', CLUSTER_LAYER_ID, () => { if (this.map) this.map.getCanvas().style.cursor = 'pointer'; });
      this.map!.on('mouseleave', CLUSTER_LAYER_ID, () => { if (this.map) this.map.getCanvas().style.cursor = ''; });

      this.fitToLocations();
    });
  }

  unmounted(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.popup?.remove();
    this.map?.remove();
    this.map = null;
    this.popup = null;
    this.mapLoaded = false;
  }

  @Watch('active')
  onActiveChanged(active: boolean): void {
    if (!active || !this.map) return;
    // wait until the container is visible
    this.$nextTick(() => {
      this.map?.resize();
      if (this.mapLoaded) this.fitToLocations();
    });
  }

  @Watch('locations', { deep: true })
  onLocationsChanged(): void {
    if (!this.mapLoaded || !this.map) return;
    (this.map.getSource(SOURCE_ID) as GeoJSONSource).setData(this.buildGeoJson());
    (this.map.getSource(HEATMAP_SOURCE_ID) as GeoJSONSource).setData(this.buildGeoJson());
    this.fitToLocations();
  }

  private async onClusterClick(e: MapLayerMouseEvent): Promise<void> {
    const feature = e.features?.[0];
    if (!feature || !this.map) return;
    const coords = (feature.geometry as any).coordinates as [number, number];
    const clusterId = feature.properties?.cluster_id;
    const pointCount = feature.properties?.point_count as number;
    const source = this.map.getSource(SOURCE_ID) as GeoJSONSource;

    const leaves = await source.getClusterLeaves(clusterId, pointCount, 0);
    const total = leaves.reduce((sum, leaf) => sum + (leaf.properties?.count ?? 1), 0);
    const rows = leaves
      .map(leaf => ({ name: leaf.properties?.name ?? '', count: leaf.properties?.count ?? 1 }))
      .sort((a, b) => b.count - a.count);

    const MAX_ROWS = 10;
    const shown = rows.slice(0, MAX_ROWS);
    const hiddenCount = rows.length - shown.length;

    const container = document.createElement('div');
    shown.forEach(r => container.appendChild(this.buildLocationRow(r.name, r.count)));
    if (hiddenCount > 0) {
      const more = document.createElement('div');
      more.textContent = `… + ${hiddenCount}`;
      more.style.opacity = '0.7';
      more.style.fontSize = '12px';
      container.appendChild(more);
    }
    const hr = document.createElement('hr');
    hr.style.margin = '4px 0';
    container.appendChild(hr);
    container.appendChild(this.buildLocationRow('Skupaj', total, { bold: true, addable: false }));

    if (!this.map) return;
    this.popup!.setLngLat(coords).setDOMContent(container).addTo(this.map);
  }

  // popup row: place name, count and button to add it to the filter
  private buildLocationRow(name: string, count: number, options: { bold?: boolean; addable?: boolean } = {}): HTMLElement {
    const { bold = false, addable = true } = options;
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '10px';

    const label = document.createElement('span');
    label.textContent = `${name} (${count})`;
    if (bold) label.style.fontWeight = 'bold';
    row.appendChild(label);

    if (addable) {
      const addBtn = document.createElement('button');
      addBtn.textContent = '➕';
      addBtn.title = 'Dodaj v filter lokacij';
      addBtn.style.border = 'none';
      addBtn.style.background = 'transparent';
      addBtn.style.cursor = 'pointer';
      addBtn.style.fontSize = '13px';
      addBtn.style.padding = '0 2px';
      addBtn.addEventListener('click', () => {
        this.$emit('select-location', name);
        this.popup?.remove();
      });
      row.appendChild(addBtn);
    }

    return row;
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
    const circlesVisible = this.mode === 'circles' ? 'visible' : 'none';
    this.map.setLayoutProperty(LAYER_ID, 'visibility', circlesVisible);
    this.map.setLayoutProperty(CLUSTER_LAYER_ID, 'visibility', circlesVisible);
    this.map.setLayoutProperty(CLUSTER_COUNT_LAYER_ID, 'visibility', circlesVisible);
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
