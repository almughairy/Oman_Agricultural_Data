(function () {
  'use strict';

  const SHEET_ID = '1n7oWCkQZM9bsEzBRhqRe6Ky3J7VfGa-gjhee-K1B7bk';
  const GID = '1161513038';
  const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

  const COLORS = ['#2d6a4f', '#40916c', '#52b788', '#d4a373', '#1b4332'];
  const VALUE_COL = 'Value added in the agricultural sector as percent of GDP';

  const PRODUCTION_YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];

  const CROP_PRODUCTION_SERIES = [
    { name: 'Fodder Crops', values: [1332874, 1338166, 1648471, 1698706, 1247105, 1528657, 1566390, 1926841] },
    { name: 'Vegetable Crops', values: [830861, 814570, 817940, 825260, 1159540, 1075452, 1137655, 1222082] },
    { name: 'Fruit Crops', values: [444695, 450818, 459695, 468654, 464929, 469790, 473917, 493011] },
    { name: 'Field Crops', values: [18864, 18943, 25008, 25483, 162545, 96425, 117451, 58405] }
  ];

  const CROPS = ['Vegetables', 'Field crops', 'Fruit crops', 'Fodder crops', 'Total'];

  const PRODUCTION = [
    [1137655, 1222082, 1435330],
    [57711, 42762, 47452],
    [473917, 493012, 502683],
    [1821690, 1926841, 1949528],
    [3490973, 3684697, 3935196]
  ];

  let gdpYears = [];
  let gdpValues = [];

  const PLOT_CONFIG = { responsive: true, displayModeBar: true, displaylogo: false };

  function baseLayout(overrides) {
    return Object.assign({
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'DM Sans, sans-serif', color: '#1a1a1a', size: 13 },
      colorway: COLORS,
      hoverlabel: {
        bgcolor: '#1b4332',
        font: { family: 'DM Sans, sans-serif', color: '#fff', size: 12 }
      },
      margin: { t: 24, r: 24, b: 80, l: 72 },
      showlegend: false
    }, overrides);
  }

  function axisStyle(extra) {
    const base = {
      showgrid: true,
      gridcolor: 'rgba(27, 67, 50, 0.08)',
      zeroline: false,
      linecolor: 'rgba(27, 67, 50, 0.2)',
      tickfont: { size: 11 },
      automargin: true,
      title: { standoff: 14, font: { size: 12 } }
    };
    if (extra && typeof extra.title === 'string') {
      extra = Object.assign({}, extra, {
        title: Object.assign({}, base.title, { text: extra.title })
      });
    }
    return Object.assign({}, base, extra);
  }

  function yearDtick(startYear, endYear) {
    const span = endYear - startYear;
    if (span > 40) return 10;
    if (span > 20) return 5;
    if (span > 10) return 2;
    return 1;
  }

  function legendAbove(count) {
    return {
      orientation: 'h',
      x: 0.5,
      xanchor: 'center',
      y: 1,
      yanchor: 'bottom',
      bgcolor: 'rgba(255,255,255,0.9)',
      bordercolor: 'rgba(27, 67, 50, 0.12)',
      borderwidth: 1,
      tracegroupgap: 16,
      itemwidth: 40,
      font: { size: 11 }
    };
  }

  /* ---- CSV parsing ---- */

  function parseCSVRow(line) {
    const out = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let field = '';
        i++;
        while (i < line.length) {
          if (line[i] === '"') {
            i++;
            if (line[i] === '"') { field += '"'; i++; }
            else break;
          } else {
            field += line[i];
            i++;
          }
        }
        out.push(field);
      } else {
        let field = '';
        while (i < line.length && line[i] !== ',') { field += line[i]; i++; }
        out.push(field.trim());
        if (i < line.length) i++;
      }
    }
    return out;
  }

  function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(function (l) { return l.length > 0; });
    if (lines.length === 0) return [];
    const headers = parseCSVRow(lines[0]);
    const rows = [];
    for (let j = 1; j < lines.length; j++) {
      const values = parseCSVRow(lines[j]);
      const row = {};
      headers.forEach(function (h, i) {
        row[h] = values[i] !== undefined ? values[i].trim() : '';
      });
      rows.push(row);
    }
    return rows;
  }

  function extractSeries(rows) {
    const years = [];
    const values = [];
    for (let i = 0; i < rows.length; i++) {
      const y = parseInt(rows[i].Year, 10);
      const v = parseFloat(rows[i][VALUE_COL]);
      if (Number.isFinite(y) && Number.isFinite(v)) {
        years.push(y);
        values.push(v);
      }
    }
    return { years: years, values: values };
  }

  function uniformTicks(low, high, step) {
    const ticks = [];
    let t = Math.floor(low / step) * step;
    while (t <= high) {
      ticks.push(t);
      t += step;
    }
    return ticks.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
  }

  function growthRate(newVal, oldVal) {
    return (newVal - oldVal) / oldVal * 100;
  }

  function formatNumber(n) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  /* ---- UI helpers ---- */

  function showElement(id) {
    document.getElementById(id).classList.remove('hidden');
  }

  function hideElement(id) {
    document.getElementById(id).classList.add('hidden');
  }

  function showError(msg) {
    hideElement('loading');
    hideElement('kpi-skeleton');
    const el = document.getElementById('error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideLoading() {
    hideElement('loading');
    hideElement('kpi-skeleton');
  }

  function showDashboard() {
    showElement('charts');
    showElement('kpi-row');
    hideElement('kpi-skeleton');
  }

  /* ---- KPI cards ---- */

  function updateKPIs(years, values, rangeStart, rangeEnd) {
    if (years.length > 0) {
      const filteredYears = [];
      const filteredValues = [];
      for (let i = 0; i < years.length; i++) {
        if (years[i] >= rangeStart && years[i] <= rangeEnd) {
          filteredYears.push(years[i]);
          filteredValues.push(values[i]);
        }
      }

      const srcYears = filteredYears.length ? filteredYears : years;
      const srcValues = filteredValues.length ? filteredValues : values;

      const latestYear = srcYears[srcYears.length - 1];
      const latestVal = srcValues[srcValues.length - 1];
      document.getElementById('kpi-latest-gdp').textContent = latestVal.toFixed(2) + '%';
      document.getElementById('kpi-latest-year').textContent = 'Year ' + latestYear;

      let peakIdx = 0;
      for (let i = 1; i < srcValues.length; i++) {
        if (srcValues[i] > srcValues[peakIdx]) peakIdx = i;
      }
      document.getElementById('kpi-peak-gdp').textContent = srcValues[peakIdx].toFixed(2) + '%';
      document.getElementById('kpi-peak-year').textContent = 'Year ' + srcYears[peakIdx];
    }

    const growth2423 = PRODUCTION.map(function (row) { return growthRate(row[2], row[1]); });
    let topIdx = 0;
    for (let i = 1; i < CROPS.length - 1; i++) {
      if (growth2423[i] > growth2423[topIdx]) topIdx = i;
    }
    document.getElementById('kpi-top-growth').textContent = growth2423[topIdx].toFixed(1) + '%';
    document.getElementById('kpi-top-growth-detail').textContent = CROPS[topIdx] + ' · 2024/2023';

    const total2024 = PRODUCTION[4][2];
    document.getElementById('kpi-total-prod').textContent = formatNumber(total2024);

    document.getElementById('last-updated').textContent =
      'Last updated: ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ---- GDP charts ---- */

  function buildGdpTrace(years, values, withLine) {
    const hoverText = values.map(function (v, i) {
      return 'Year: ' + years[i] + '<br>Value: ' + v.toFixed(2) + '%';
    });
    return {
      x: years,
      y: values,
      mode: withLine ? 'lines+markers' : 'markers',
      type: 'scatter',
      marker: { size: 8, color: COLORS[0], line: { width: 1, color: '#fff' } },
      line: withLine ? { width: 2, color: COLORS[0] } : undefined,
      text: hoverText,
      hoverinfo: 'text'
    };
  }

  function renderFullGdpChart(years, values, startYear, endYear) {
    const filteredYears = [];
    const filteredValues = [];
    for (let i = 0; i < years.length; i++) {
      if (years[i] >= startYear && years[i] <= endYear) {
        filteredYears.push(years[i]);
        filteredValues.push(values[i]);
      }
    }

    if (filteredYears.length === 0) return;

    const yMin = Math.min.apply(null, filteredValues);
    const yMax = Math.max.apply(null, filteredValues);
    const yPlotMin = yMin * 0.9;
    const yPlotMax = yMax * 1.1;
    const yTicks = uniformTicks(yPlotMin, yPlotMax, 5);

    Plotly.react('chart-full', [buildGdpTrace(filteredYears, filteredValues, false)], baseLayout({
      xaxis: axisStyle({
        title: 'Year',
        tickangle: -45,
        range: [startYear - 0.5, endYear + 0.5],
        dtick: yearDtick(startYear, endYear)
      }),
      yaxis: axisStyle({
        title: '% of GDP',
        range: [yPlotMin, yPlotMax],
        tickvals: yTicks,
        tickformat: '.2f'
      }),
      hovermode: 'x unified',
      margin: { t: 24, r: 24, b: 100, l: 72 }
    }), PLOT_CONFIG);

    updateKPIs(years, values, startYear, endYear);
  }

  function renderFilteredGdpChart(years, values) {
    const yearsFiltered = [];
    const valuesFiltered = [];
    for (let i = 0; i < years.length; i++) {
      if (years[i] >= 2011 && years[i] <= 2024) {
        yearsFiltered.push(years[i]);
        valuesFiltered.push(values[i]);
      }
    }

    if (yearsFiltered.length === 0) {
      document.getElementById('chart-filtered').innerHTML = '<p>No data in 2011–2024.</p>';
      return;
    }

    const yMin = Math.min.apply(null, valuesFiltered);
    const yMax = Math.max.apply(null, valuesFiltered);
    const yPlotMin = yMin * 0.9;
    const yPlotMax = yMax * 1.1;
    const yTicks = uniformTicks(yPlotMin, yPlotMax, 0.5);
    const xTickYears = [];
    for (let y = 2011; y <= 2025; y++) xTickYears.push(y);

    Plotly.newPlot('chart-filtered', [buildGdpTrace(yearsFiltered, valuesFiltered, true)], baseLayout({
      xaxis: axisStyle({
        title: 'Year',
        tickangle: -45,
        tickvals: xTickYears,
        tickformat: 'd',
        dtick: 1
      }),
      yaxis: axisStyle({
        title: '% of GDP',
        range: [yPlotMin, yPlotMax],
        tickvals: yTicks,
        tickformat: '.2f'
      }),
      hovermode: 'x unified',
      margin: { t: 24, r: 24, b: 110, l: 72 }
    }), PLOT_CONFIG);
  }

  function setupYearPresets(years, values) {
    const minYear = Math.min.apply(null, years);
    const maxYear = Math.max.apply(null, years);
    const container = document.getElementById('year-presets');
    container.innerHTML = '';

    const presets = [
      { label: 'All years', start: minYear, end: maxYear, default: true },
      { label: 'Last 20 years', start: Math.max(minYear, maxYear - 19), end: maxYear },
      { label: '2011–2024', start: Math.max(minYear, 2011), end: Math.min(maxYear, 2024) }
    ];

    presets.forEach(function (preset) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-btn' + (preset.default ? ' active' : '');
      btn.textContent = preset.label;
      btn.dataset.start = preset.start;
      btn.dataset.end = preset.end;

      btn.addEventListener('click', function () {
        container.querySelectorAll('.preset-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        const start = parseInt(btn.dataset.start, 10);
        const end = parseInt(btn.dataset.end, 10);
        renderFullGdpChart(years, values, start, end);
      });

      container.appendChild(btn);
    });

    renderFullGdpChart(years, values, minYear, maxYear);
  }

  /* ---- Crop production chart ---- */

  function renderProductionTrendsChart() {
    const traces = CROP_PRODUCTION_SERIES.map(function (series, idx) {
      return {
        name: series.name,
        x: PRODUCTION_YEARS,
        y: series.values,
        type: 'scatter',
        mode: 'lines+markers',
        visible: true,
        line: { width: 2.5, color: COLORS[idx] },
        marker: { size: 7, color: COLORS[idx], line: { width: 1, color: '#fff' } },
        hovertemplate: series.name + '<br>Year: %{x}<br>Production: %{y:,.0f}<extra></extra>'
      };
    });

    Plotly.newPlot('chart-production', traces, baseLayout({
      xaxis: axisStyle({ title: 'Year', tickmode: 'linear', dtick: 1 }),
      yaxis: axisStyle({
        title: 'Production (tons)',
        tickformat: ',.0f',
        separatethousands: true
      }),
      hovermode: 'x unified',
      showlegend: false,
      margin: { t: 24, r: 24, b: 64, l: 96 }
    }), PLOT_CONFIG);

    setupCropToggles();
  }

  function setupCropToggles() {
    const container = document.getElementById('crop-toggles');
    container.innerHTML = '';

    CROP_PRODUCTION_SERIES.forEach(function (series, idx) {
      const label = document.createElement('label');
      label.className = 'toggle-pill active';
      label.style.setProperty('--pill-color', COLORS[idx]);

      const dot = document.createElement('span');
      dot.className = 'toggle-dot';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = true;
      input.dataset.index = idx;

      label.appendChild(input);
      label.appendChild(dot);
      label.appendChild(document.createTextNode(series.name.replace(' Crops', '')));

      input.addEventListener('change', function () {
        const visible = input.checked ? true : 'legendonly';
        Plotly.restyle('chart-production', { visible: visible }, [idx]);
        label.classList.toggle('active', input.checked);
      });

      container.appendChild(label);
    });
  }

  /* ---- Growth rates chart ---- */

  function sortCropsForGrowth(growthLatest) {
    const cropCount = CROPS.length - 1;
    const order = [];
    for (let i = 0; i < cropCount; i++) order.push(i);
    order.sort(function (a, b) { return growthLatest[b] - growthLatest[a]; });
    order.push(cropCount);
    return order;
  }

  function renderGrowthRatesChart() {
    const growth2322 = PRODUCTION.map(function (row) { return growthRate(row[1], row[0]); });
    const growth2423 = PRODUCTION.map(function (row) { return growthRate(row[2], row[1]); });
    const order = sortCropsForGrowth(growth2423);

    const sortedCrops = order.map(function (i) { return CROPS[i]; });
    const sorted2322 = order.map(function (i) { return growth2322[i]; });
    const sorted2423 = order.map(function (i) { return growth2423[i]; });

    const allValues = sorted2322.concat(sorted2423);
    const xMin = Math.min.apply(null, allValues);
    const xMax = Math.max.apply(null, allValues);
    const xPad = Math.max(8, (xMax - xMin) * 0.15);

    const barText = function (vals) {
      return vals.map(function (v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; });
    };

    Plotly.newPlot('chart-growth', [
      {
        name: '2023 vs 2022',
        y: sortedCrops,
        x: sorted2322,
        type: 'bar',
        orientation: 'h',
        marker: {
          color: COLORS[1],
          line: { color: 'rgba(255,255,255,0.6)', width: 1 }
        },
        text: barText(sorted2322),
        textposition: 'outside',
        textfont: { size: 11, color: '#3d5a4a' },
        cliponaxis: false,
        hovertemplate: '<b>%{y}</b><br>2023 vs 2022: %{x:+.1f}%<extra></extra>'
      },
      {
        name: '2024 vs 2023',
        y: sortedCrops,
        x: sorted2423,
        type: 'bar',
        orientation: 'h',
        marker: {
          color: COLORS[3],
          line: { color: 'rgba(255,255,255,0.6)', width: 1 }
        },
        text: barText(sorted2423),
        textposition: 'outside',
        textfont: { size: 11, color: '#6b5344' },
        cliponaxis: false,
        hovertemplate: '<b>%{y}</b><br>2024 vs 2023: %{x:+.1f}%<extra></extra>'
      }
    ], baseLayout({
      barmode: 'group',
      bargap: 0.22,
      bargroupgap: 0.08,
      xaxis: axisStyle({
        title: 'Growth rate (%)',
        ticksuffix: '%',
        zeroline: true,
        zerolinecolor: '#1b4332',
        zerolinewidth: 2,
        gridcolor: 'rgba(27, 67, 50, 0.1)',
        range: [xMin - xPad, xMax + xPad]
      }),
      yaxis: axisStyle({
        autorange: 'reversed',
        showgrid: false,
        tickfont: { size: 12, color: '#1b4332' },
        ticklabelstandoff: 8
      }),
      hovermode: 'y unified',
      showlegend: true,
      legend: legendAbove(2),
      margin: { t: 56, r: 56, b: 48, l: 110 },
      shapes: [{
        type: 'line',
        x0: 0,
        x1: 0,
        y0: -0.5,
        y1: sortedCrops.length - 0.5,
        yref: 'y',
        xref: 'x',
        line: { color: 'rgba(27, 67, 50, 0.25)', width: 1, dash: 'dot' }
      }]
    }), PLOT_CONFIG);
  }

  /* ---- Scroll-spy nav ---- */

  function setupScrollSpy() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.chart-section');

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(function (link) {
            link.classList.toggle('active', link.dataset.section === id);
          });
        }
      });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (section) { observer.observe(section); });

    navLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.getElementById(link.dataset.section);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ---- Init ---- */

  function initStaticCharts() {
    showElement('charts');
    showElement('kpi-row');
    hideElement('kpi-skeleton');
    renderProductionTrendsChart();
    renderGrowthRatesChart();
    updateKPIs([], [], 1961, 2024);
    setupScrollSpy();
  }

  async function loadGdpData() {
    try {
      const res = await fetch(CSV_URL);
      if (!res.ok) throw new Error('Failed to load data: ' + res.status + ' ' + res.statusText);
      const csvText = await res.text();
      const rows = parseCSV(csvText);
      if (rows.length === 0) throw new Error('No data rows in CSV.');
      const series = extractSeries(rows);
      if (series.years.length === 0) throw new Error('No valid Year/Value pairs found.');

      gdpYears = series.years;
      gdpValues = series.values;

      hideLoading();
      showDashboard();
      renderFilteredGdpChart(gdpYears, gdpValues);
      setupYearPresets(gdpYears, gdpValues);
    } catch (e) {
      hideLoading();
      showError('GDP data unavailable: ' + (e.message || String(e)) + '. Crop charts below use local data.');
      showElement('kpi-row');
      updateKPIs([], [], 1961, 2024);
    }
  }

  initStaticCharts();
  loadGdpData();

  window.addEventListener('resize', function () {
    ['chart-full', 'chart-filtered', 'chart-production', 'chart-growth'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el && el.querySelector('.main-svg')) Plotly.Plots.resize(el);
    });
  });
})();
