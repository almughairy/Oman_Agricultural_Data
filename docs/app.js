(function () {
  'use strict';

  const SHEET_ID = '1n7oWCkQZM9bsEzBRhqRe6Ky3J7VfGa-gjhee-K1B7bk';
  const GID = '1161513038';
  const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

  /**
   * Parse a single CSV row handling quoted fields (commas inside quotes).
   * Follows RFC 4180-style: double quotes escape as "".
   */
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
            if (line[i] === '"') {
              field += '"';
              i++;
            } else {
              break;
            }
          } else {
            field += line[i];
            i++;
          }
        }
        out.push(field);
      } else {
        let field = '';
        while (i < line.length && line[i] !== ',') {
          field += line[i];
          i++;
        }
        out.push(field.trim());
        if (i < line.length) i++;
      }
    }
    return out;
  }

  /**
   * Parse CSV text into array of objects using first row as headers.
   */
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

  /**
   * Build arrays of years and values from parsed rows.
   * Column name from sheet: "Value added in the agricultural sector as percent of GDP"
   */
  function extractSeries(rows) {
    const valueCol = 'Value added in the agricultural sector as percent of GDP';
    const years = [];
    const values = [];
    for (let i = 0; i < rows.length; i++) {
      const y = parseInt(rows[i].Year, 10);
      const v = parseFloat(rows[i][valueCol]);
      if (Number.isFinite(y) && Number.isFinite(v)) {
        years.push(y);
        values.push(v);
      }
    }
    return { years: years, values: values };
  }

  /**
   * Uniform y-axis ticks in steps within [low, high].
   */
  function uniformTicks(low, high, step) {
    const ticks = [];
    let t = Math.floor(low / step) * step;
    while (t <= high) {
      ticks.push(t);
      t += step;
    }
    return ticks.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
  }

  function showError(msg) {
    document.getElementById('loading').style.display = 'none';
    const el = document.getElementById('error');
    el.textContent = msg;
    el.style.display = 'block';
  }

  function renderCharts(years, values) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('charts').style.display = 'block';

    const valueCol = 'Value added in the agricultural sector as percent of GDP';
    const yMin = Math.min.apply(null, values);
    const yMax = Math.max.apply(null, values);
    const yPlotMin = yMin * 0.9;
    const yPlotMax = yMax * 1.1;
    const yTicksFull = uniformTicks(yPlotMin, yPlotMax, 5);

    const hoverText = values.map(function (v, i) {
      return 'Year: ' + years[i] + '<br>Value: ' + v.toFixed(2);
    });

    // Chart 1: Full range (1961–2024)
    const traceFull = {
      x: years,
      y: values,
      mode: 'markers',
      type: 'scatter',
      text: hoverText,
      hoverinfo: 'text'
    };
    Plotly.newPlot('chart-full', [traceFull], {
      title: 'Value Added in the Agricultural Sector as a Percent of Omani GDP Historically',
      xaxis: {
        title: 'Year',
        showgrid: true,
        tickangle: -45
      },
      yaxis: {
        title: valueCol,
        range: [yPlotMin, yPlotMax],
        showgrid: true,
        tickvals: yTicksFull,
        tickformat: '.2f'
      },
      hovermode: 'x unified',
      margin: { t: 60, r: 40, b: 80, l: 100 },
      autosize: true
    }, { responsive: true });

    // Chart 2: Filtered (2011–2024)
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

    const yMinF = Math.min.apply(null, valuesFiltered);
    const yMaxF = Math.max.apply(null, valuesFiltered);
    const yPlotMinF = yMinF * 0.9;
    const yPlotMaxF = yMaxF * 1.1;
    const yTicksFiltered = uniformTicks(yPlotMinF, yPlotMaxF, 0.5);
    const hoverTextFiltered = valuesFiltered.map(function (v, i) {
      return 'Year: ' + yearsFiltered[i] + '<br>Value: ' + v.toFixed(2);
    });

    const xTickYears = [];
    for (let y = 2011; y <= 2025; y++) xTickYears.push(y);

    const traceFiltered = {
      x: yearsFiltered,
      y: valuesFiltered,
      mode: 'markers',
      type: 'scatter',
      text: hoverTextFiltered,
      hoverinfo: 'text'
    };
    Plotly.newPlot('chart-filtered', [traceFiltered], {
      title: 'Value Added in the Agricultural Sector as a Percent of Omani GDP (2011 - 2024)',
      xaxis: {
        title: 'Year',
        showgrid: true,
        tickangle: -45,
        tickvals: xTickYears,
        tickformat: 'd'
      },
      yaxis: {
        title: valueCol,
        range: [yPlotMinF, yPlotMaxF],
        showgrid: true,
        tickvals: yTicksFiltered,
        tickformat: '.2f'
      },
      hovermode: 'x unified',
      margin: { t: 60, r: 40, b: 80, l: 100 },
      autosize: true
    }, { responsive: true });
  }

  async function load() {
    try {
      const res = await fetch(CSV_URL);
      if (!res.ok) throw new Error('Failed to load data: ' + res.status + ' ' + res.statusText);
      const csvText = await res.text();
      const rows = parseCSV(csvText);
      if (rows.length === 0) throw new Error('No data rows in CSV.');
      const series = extractSeries(rows);
      if (series.years.length === 0) throw new Error('No valid Year/Value pairs found.');
      renderCharts(series.years, series.values);
    } catch (e) {
      showError('Error: ' + (e.message || String(e)) + '. Check the sheet URL and CORS if hosted locally.');
    }
  }

  load();
})();
