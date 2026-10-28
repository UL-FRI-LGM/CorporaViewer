<template>
  <div class="timeline light-green-container">
    <div class="timeline-toolbar">
      <div class="interval-toggle" role="group" :aria-label="$t('timelineUnit')">
        <button type="button" :class="{active: unit === 'meetings'}" :aria-pressed="unit === 'meetings'"
                @click="emit('unitChange', 'meetings')">{{ $t('timelineUnitMeetings') }}
        </button>
        <button type="button" :class="{active: unit === 'segments'}" :aria-pressed="unit === 'segments'"
                @click="emit('unitChange', 'segments')">{{ $t('timelineUnitSegments') }}
        </button>
        <button type="button" :class="{active: unit === 'sentences'}" :aria-pressed="unit === 'sentences'"
                @click="emit('unitChange', 'sentences')">{{ $t('timelineUnitSentences') }}
        </button>
      </div>

      <div class="interval-toggle" role="group" :aria-label="$t('timelineInterval')">
        <button type="button" :class="{active: interval === 'year'}" :aria-pressed="interval === 'year'"
                @click="emit('intervalChange', 'year')">{{ $t('timelineYear') }}
        </button>
        <button type="button" :class="{active: interval === 'month'}" :aria-pressed="interval === 'month'"
                @click="emit('intervalChange', 'month')">{{ $t('timelineMonth') }}
        </button>
      </div>

      <div class="interval-toggle" role="group" :aria-label="$t('timelineValueMode')">
        <button type="button" :class="{active: valueMode === 'count'}" :aria-pressed="valueMode === 'count'"
                @click="valueMode = 'count'">{{ $t('timelineCount') }}
        </button>
        <button type="button" :class="{active: valueMode === 'share'}" :aria-pressed="valueMode === 'share'"
                :disabled="!shareAvailable" :title="shareAvailable ? '' : shareDisabledLabel"
                @click="valueMode = 'share'">{{ $t('timelineShare') }}
        </button>
      </div>

      <div class="interval-toggle" role="group" :aria-label="$t('timelineChartType')">
        <button type="button" :class="{active: chartType === 'bar'}" :aria-pressed="chartType === 'bar'"
                @click="chartType = 'bar'">{{ $t('timelineBars') }}
        </button>
        <button type="button" :class="{active: chartType === 'line'}" :aria-pressed="chartType === 'line'"
                @click="chartType = 'line'">{{ $t('timelineLines') }}
        </button>
      </div>

      <div class="legend" v-if="isSingle">
        <span class="legend-item"><i class="swatch swatch-match"></i>{{ matchingLabel }}</span>
        <span class="legend-item" v-if="showTotal"><i class="swatch swatch-total"></i>{{ totalLabel }}</span>
      </div>

      <button type="button" class="zoom-range" v-if="rangeActive" :aria-pressed="zoomed" @click="toggleZoom">
        <i class="fa" :class="zoomed ? 'fa-magnifying-glass-minus' : 'fa-magnifying-glass-plus'"></i>
        {{ zoomed ? $t('timelineZoomOut') : $t('timelineZoomIn') }}
      </button>
      <button type="button" class="reset-range" v-if="rangeActive" @click="emit('reset')">
        {{ $t('timelineResetRange') }}
      </button>
    </div>

    <div class="series-bar">
      <span class="series-chip" v-for="item in series" :key="item.current ? 'current' : item.color"
            :class="{failed: item.failed}">
        <i class="swatch" :style="{backgroundColor: item.color}"></i>
        <template v-if="!item.current && editingColor === item.color">
          <input class="rename-input" v-model="draftName" :aria-label="$t('timelineRename')"
                 @keyup.enter="finishRename" @keyup.esc="editingColor = null" @blur="finishRename"/>
        </template>
        <template v-else>
          <span class="series-name">{{ item.name }}</span>
          <button type="button" class="chip-button chip-error" v-if="item.failed" :title="$t('timelineSeriesFailed')"
                  :aria-label="$t('timelineSeriesFailed')" @click="emit('retry')">
            <i class="fa fa-triangle-exclamation"></i> {{ $t('timelineRetry') }}
          </button>
          <button type="button" class="chip-button" v-if="!item.current" :title="$t('timelineRename')"
                  :aria-label="$t('timelineRename')" @click="startRename(item.color, item.name)">
            <i class="fa fa-pen"></i>
          </button>
          <button type="button" class="chip-button" v-if="!item.current" :title="$t('timelineRemoveSeries')"
                  :aria-label="$t('timelineRemoveSeries')" @click="emit('removeSeries', item.color)">
            <i class="fa fa-xmark"></i>
          </button>
        </template>
      </span>

      <button type="button" class="add-series" :disabled="!canAddSeries"
              :title="canAddSeries ? '' : $t('timelineMaxSeries')" @click="emit('addSeries')">
        <i class="fa fa-plus"></i> {{ $t('timelineAddSeries') }}
      </button>
    </div>

    <p class="hint">{{ $t('timelineHint') }}</p>

    <div class="chart-wrapper">
      <div ref="chartEl" class="chart" role="img" :aria-label="summary"></div>
      <div class="chart-overlay" v-if="loading || isEmpty">
        {{ loading ? $t('loading') : emptyLabel }}
      </div>
    </div>

    <p class="summary" aria-live="polite">{{ summary }}</p>

    <details class="series-table" v-if="!isEmpty">
      <summary>{{ $t('timelineShowTable') }}</summary>
      <div class="table-scroll">
        <table>
          <thead>
          <tr>
            <th scope="col">{{ $t('timelinePeriod') }}</th>
            <th scope="col" v-for="(item, i) in series" :key="i">{{ chartNames[i] }}</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="period in periods" :key="period.date" v-show="period.total > 0">
            <th scope="row">{{ label(period.date) }}</th>
            <td v-for="(item, i) in series" :key="i">{{ formatValue(value(bucketAt(i, period.date))) }}</td>
          </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>

<style scoped>
.timeline {
  text-align: left;
}

.timeline-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.interval-toggle {
  display: inline-flex;
  border: 2px solid #708d81;
  border-radius: 10px;
  overflow: hidden;
}

.interval-toggle button {
  border: none;
  background: transparent;
  color: #1e1e24;
  padding: 0.25rem 0.9rem;
  cursor: pointer;
}

.interval-toggle button.active {
  background-color: #708d81;
  color: #f0f7ee;
}

.interval-toggle button:disabled,
.add-series:disabled {
  color: #9aa8a1;
  cursor: not-allowed;
}

.interval-toggle button:focus-visible,
.reset-range:focus-visible,
.zoom-range:focus-visible,
.add-series:focus-visible,
.chip-button:focus-visible {
  outline: 3px solid #1e1e24;
  outline-offset: 2px;
}

.legend {
  display: flex;
  gap: 1rem;
  margin-left: auto;
  font-size: 0.9rem;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.swatch {
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 3px;
  flex-shrink: 0;
}

.swatch-match {
  background-color: #708d81;
}

.swatch-total {
  background-color: #c9d8cf;
}

.reset-range {
  border: 2px solid #883636;
  border-radius: 10px;
  background: transparent;
  color: #883636;
  padding: 0.2rem 0.9rem;
  cursor: pointer;
}

.reset-range:hover {
  background-color: #883636;
  color: #f0f7ee;
}

.zoom-range {
  border: 2px solid #708d81;
  border-radius: 10px;
  background: transparent;
  color: #1e1e24;
  padding: 0.2rem 0.9rem;
  cursor: pointer;
}

.zoom-range:hover,
.zoom-range[aria-pressed="true"] {
  background-color: #708d81;
  color: #f0f7ee;
}

.series-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.series-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid #c9d8cf;
  border-radius: 10px;
  padding: 0.15rem 0.5rem;
  font-size: 0.9rem;
  background-color: #ffffff;
}

.chip-button {
  border: none;
  background: transparent;
  color: #4a6b5e;
  cursor: pointer;
  padding: 0 0.15rem;
}

.chip-button:hover {
  color: #1e1e24;
}

.series-chip.failed {
  border-color: #883636;
}

.chip-button.chip-error {
  color: #883636;
}

.rename-input {
  font-size: 0.9rem;
  border: 1px solid #708d81;
  border-radius: 6px;
  padding: 0 0.3rem;
}

.add-series {
  border: 2px solid #708d81;
  border-radius: 10px;
  background: transparent;
  color: #1e1e24;
  padding: 0.15rem 0.8rem;
  cursor: pointer;
}

.add-series:not(:disabled):hover {
  background-color: #708d81;
  color: #f0f7ee;
}

.hint {
  margin: 0.75rem 0 0.25rem 0;
  font-size: 0.9rem;
  color: #4a6b5e;
}

.chart-wrapper {
  position: relative;
}

.chart {
  width: 100%;
  height: 360px;
}

.chart-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(240, 247, 238, 0.75);
  font-weight: 600;
}

.summary {
  margin: 0.5rem 0 0 0;
  font-weight: 600;
}

.series-table {
  margin-top: 0.5rem;
}

.series-table summary {
  cursor: pointer;
  color: #4a6b5e;
}

.table-scroll {
  max-height: 320px;
  overflow: auto;
  margin-top: 0.5rem;
}

.series-table table {
  border-collapse: collapse;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.series-table th,
.series-table td {
  padding: 0.2rem 0.6rem;
  border-bottom: 1px solid #c9d8cf;
  text-align: right;
  white-space: nowrap;
}

.series-table thead th {
  position: sticky;
  top: 0;
  background-color: #f0f7ee;
}

.series-table th[scope="row"],
.series-table thead th:first-child {
  text-align: left;
}
</style>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import * as echarts from 'echarts/core';
import {BarChart, LineChart} from 'echarts/charts';
import {BrushComponent, GridComponent, LegendComponent, MarkAreaComponent, TooltipComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
import i18n from '@/data/i18setup';
import {formatDate} from '@/data/searchState';
import {TimelineBucket, TimelineInterval, TimelineSeriesData, TimelineUnit} from '@/types/Timeline';

echarts.use([BarChart, LineChart, BrushComponent, GridComponent, LegendComponent, MarkAreaComponent, TooltipComponent,
  CanvasRenderer]);

const props = defineProps<{
  series: TimelineSeriesData[];   // current search first, then saved ones
  unit: TimelineUnit;
  canAddSeries: boolean;
  interval: TimelineInterval;
  loading: boolean;
  dateFrom: Date;
  dateTo: Date;
  rangeActive: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', range: { from: Date, to: Date }): void;
  (e: 'reset'): void;
  (e: 'intervalChange', interval: TimelineInterval): void;
  (e: 'unitChange', unit: TimelineUnit): void;
  (e: 'addSeries'): void;
  (e: 'removeSeries', color: string): void;
  (e: 'renameSeries', change: { color: string, name: string }): void;
  (e: 'retry'): void;
}>();

// count = number of matches, share = percentage of all in the period
const valueMode = ref<'count' | 'share'>('count');
const chartType = ref<'bar' | 'line'>('bar');

const chartEl = ref<HTMLElement | null>(null);
let chart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;
let lastBrushAt = 0;

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params ?? {}) as string;

// buckets of each series by date
const bucketsByDate = computed<Map<string, TimelineBucket>[]>(() =>
    props.series.map(item => new Map(item.buckets.map(bucket => [bucket.date, bucket]))));

// zoomed in: only the selected date range is shown
const zoomed = ref(false);

function toggleZoom() {
  zoomed.value = !zoomed.value;
  if (zoomed.value && props.interval === 'year') emit('intervalChange', 'month');
}

watch(() => props.rangeActive, active => {
  if (!active) zoomed.value = false;
});

// all dates of all series, sorted
const allPeriods = computed<TimelineBucket[]>(() => {
  const totals = new Map<string, number>();
  props.series.forEach(item => item.buckets.forEach(b => totals.set(b.date, Math.max(totals.get(b.date) ?? 0, b.total))));
  return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({date, count: 0, total}));
});

// periods shown on the chart and in the table
const periods = computed<TimelineBucket[]>(() => {
  if (!zoomed.value || !props.rangeActive) return allPeriods.value;
  const from = formatDate(props.dateFrom);
  const to = formatDate(props.dateTo);
  return allPeriods.value.filter(b => formatDate(periodEnd(b)) >= from && formatDate(periodStart(b)) <= to);
});

function bucketAt(seriesIndex: number, date: string): TimelineBucket | undefined {
  return bucketsByDate.value[seriesIndex]?.get(date);
}

// names must be unique for the echarts legend
const chartNames = computed<string[]>(() => {
  const seen = new Map<string, number>();
  return props.series.map(item => {
    const n = (seen.get(item.name) ?? 0) + 1;
    seen.set(item.name, n);
    return n > 1 ? `${item.name} (${n})` : item.name;
  });
});

// names can come from the URL, escape them for the tooltip
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
}

const isEmpty = computed(() => allPeriods.value.length === 0);
const isSingle = computed(() => props.series.length === 1);

// share makes no sense when everything matches
const shareAvailable = computed(() => props.series.some(s => s.buckets.some(b => b.count !== b.total)));
watch(shareAvailable, available => {
  if (!available) valueMode.value = 'count';
}, {immediate: true});

// grey bar with all meetings only for one series
const showTotal = computed(() => isSingle.value && valueMode.value === 'count' && chartType.value === 'bar');

// locale keys for segments and sentences have a suffix
const UNIT_SUFFIX: Record<TimelineUnit, string> = {meetings: '', segments: 'Segments', sentences: 'Sentences'};
const unitText = (key: string) => t(key + UNIT_SUFFIX[props.unit]);

const matchingLabel = computed(() => unitText('timelineMatching'));
const totalLabel = computed(() => unitText('timelineTotal'));
const emptyLabel = computed(() => unitText('timelineEmpty'));
const shareDisabledLabel = computed(() => unitText('timelineShareDisabled'));

function share(bucket: TimelineBucket): number {
  return bucket.total > 0 ? Math.round(1000 * bucket.count / bucket.total) / 10 : 0;
}

function value(bucket: TimelineBucket | undefined): number {
  if (!bucket) return 0;
  return valueMode.value === 'share' ? share(bucket) : bucket.count;
}

function formatValue(n: number): string {
  return valueMode.value === 'share' ? `${n} %` : `${n}`;
}

// series are identified by color
const editingColor = ref<string | null>(null);
const draftName = ref('');

function startRename(color: string, name: string) {
  editingColor.value = color;
  draftName.value = name;
}

function finishRename() {
  if (editingColor.value === null) return;
  emit('renameSeries', {color: editingColor.value, name: draftName.value});
  editingColor.value = null;
}

function parseIso(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function periodStart(bucket: { date: string }): Date {
  return parseIso(bucket.date);
}

function periodEnd(bucket: { date: string }): Date {
  const start = parseIso(bucket.date);
  return props.interval === 'year'
      ? new Date(start.getFullYear(), 11, 31)
      : new Date(start.getFullYear(), start.getMonth() + 1, 0);
}

function label(date: string): string {
  return props.interval === 'year' ? date.slice(0, 4) : `${date.slice(5, 7)}.${date.slice(0, 4)}`;
}

function displayDate(date: Date): string {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

// first and last index of the selected date range
const selectedIndices = computed<[number, number] | null>(() => {
  const buckets = periods.value;
  if (!props.rangeActive || buckets.length === 0) return null;
  const from = formatDate(props.dateFrom);
  const to = formatDate(props.dateTo);
  const start = buckets.findIndex(b => formatDate(periodEnd(b)) >= from);
  let end = -1;
  buckets.forEach((b, i) => {
    if (formatDate(periodStart(b)) <= to) end = i;
  });
  return start === -1 || end === -1 || end < start ? null : [start, end];
});

// summary text for the current search
const summary = computed(() => {
  const current = props.series[0]?.buckets ?? [];
  if (current.length === 0) return emptyLabel.value;
  const selected = selectedIndices.value;
  if (selected) {
    return t('timelineSummaryRange' + UNIT_SUFFIX[props.unit], {
      from: displayDate(props.dateFrom),
      to: displayDate(props.dateTo),
      count: periods.value.slice(selected[0], selected[1] + 1).reduce((sum, p) => sum + (bucketAt(0, p.date)?.count ?? 0), 0)
    });
  }
  return t('timelineSummaryAll' + UNIT_SUFFIX[props.unit], {
    count: current.reduce((sum, b) => sum + b.count, 0),
    total: current.reduce((sum, b) => sum + b.total, 0)
  });
});

const BRUSH_OPTION = {
  xAxisIndex: 0,
  brushType: 'lineX',
  brushMode: 'single',
  transformable: false,
  throttleType: 'debounce',
  throttleDelay: 100,
  brushStyle: {color: 'rgba(136, 54, 54, 0.15)', borderColor: '#883636', borderWidth: 1}
};

function selectionMarkArea(dates: string[]) {
  const selected = selectedIndices.value;
  // when zoomed in the whole chart is the selection
  return selected && !zoomed.value ? {
    silent: true,
    itemStyle: {color: 'rgba(136, 54, 54, 0.15)', borderColor: '#883636', borderWidth: 1},
    data: [[{xAxis: dates[selected[0]]}, {xAxis: dates[selected[1]]}]]
  } : {data: []};
}

function render() {
  if (!chart) return;

  const dates = periods.value.map(b => b.date);
  const isShare = valueMode.value === 'share';
  const isLine = chartType.value === 'line';
  const single = isSingle.value;

  const names = chartNames.value;
  const dataSeries = props.series.map((item, index) => ({
    name: names[index],
    type: isLine ? 'line' : 'bar',
    data: dates.map(date => value(bucketAt(index, date))),
    // one series uses the default color
    itemStyle: {color: item.color},
    lineStyle: {width: 2, color: item.color},
    symbolSize: 8,
    showSymbol: dates.length <= 60,
    barGap: single ? '-100%' : '10%',
    barCategoryGap: '20%',
    z: 2,
    ...(index === 0 ? {markArea: selectionMarkArea(dates)} : {})
  }));

  chart.setOption({
    animationDuration: 250,
    grid: {left: 8, right: 16, top: 16, bottom: single ? 8 : 36, containLabel: true},
    legend: single ? {show: false} : {
      bottom: 0,
      type: 'scroll',
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 12,
      textStyle: {color: '#1e1e24'},
      data: names
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {type: isLine ? 'line' : 'shadow'},
      formatter: (params: any) => {
        const p = params[0].dataIndex;
        const rows = props.series.map((item, index) => {
          const bucket = bucketAt(index, dates[p]);
          const color = item.color;
          const text = bucket ? `${bucket.count} / ${bucket.total} (${share(bucket)} %)` : '–';
          return `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;background:${color}"></span>`
              + `${escapeHtml(single ? matchingLabel.value : names[index])}: <strong>${text}</strong>`;
        });
        return `<strong>${label(dates[p])}</strong><br>${rows.join('<br>')}`;
      }
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: !isLine,
      axisLabel: {formatter: (date: string) => label(date), hideOverlap: true},
      axisTick: {alignWithLabel: true}
    },
    // no max on the share axis, shares of sentences are small
    yAxis: isShare
        ? {type: 'value', min: 0, axisLabel: {formatter: '{value} %'}}
        : {type: 'value', minInterval: 1},
    brush: BRUSH_OPTION,
    series: [
      // grey bar with all meetings
      ...(showTotal.value ? [{
        name: 'total',
        type: 'bar',
        data: periods.value.map(b => b.total),
        itemStyle: {color: '#c9d8cf'},
        barGap: '-100%',
        barCategoryGap: '20%',
        z: 1
      }] : []),
      ...dataSeries
    ]
  }, true);

  // enable brush selection by default
  chart.dispatchAction({
    type: 'takeGlobalCursor',
    key: 'brush',
    brushOption: {brushType: 'lineX', brushMode: 'single'}
  });
}

function selectRange(startIndex: number, endIndex: number) {
  const buckets = periods.value;
  const last = buckets.length - 1;
  const start = Math.max(0, Math.min(startIndex, endIndex));
  const end = Math.min(last, Math.max(startIndex, endIndex));
  if (last < 0 || start > last || end < 0) return;
  emit('select', {from: periodStart(buckets[start]), to: periodEnd(buckets[end])});
}

function createChart() {
  if (chart || !chartEl.value || chartEl.value.clientWidth === 0) return;

  chart = echarts.init(chartEl.value);

  chart.on('brushEnd', (event: any) => {
    const range = event.areas?.[0]?.coordRange as [number, number] | undefined;
    if (!range) return;
    lastBrushAt = Date.now();
    // categories are on integer positions
    selectRange(Math.round(Math.min(...range)), Math.round(Math.max(...range)));
    // selection is shown with markArea
    chart?.dispatchAction({type: 'brush', areas: []});
  });

  chart.on('click', (params: any) => {
    if (params.componentType !== 'series' || Date.now() - lastBrushAt < 300) return;
    selectRange(params.dataIndex, params.dataIndex);
  });

  render();
}

onMounted(() => {
  // tab can be hidden on mount, create the chart when it has a size
  resizeObserver = new ResizeObserver(() => {
    if (!chart) createChart(); else chart.resize();
  });
  if (chartEl.value) resizeObserver.observe(chartEl.value);
  createChart();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  chart?.dispose();
  chart = null;
});

watch(() => [props.series, props.unit, props.interval, props.dateFrom, props.dateTo, props.rangeActive,
  valueMode.value, chartType.value, zoomed.value], render, {deep: true});
</script>
