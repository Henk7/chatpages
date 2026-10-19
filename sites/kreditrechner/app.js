import {
  MAX_YEARS,
  buildScenario,
  exploreAnnuities,
  exploreLoans,
  explorePaymentFrequencies,
  exploreRates,
} from './cred-engine.js';

const DEFAULTS = {
  loan: 100_000,
  interest: 1,
  annuity: 1_000,
  ppy: 12,
  fixed: 30,
  follow: 1,
  fee: 0,
  capEnabled: false,
  capAmount: 200_000,
  capRate: 1,
  capYears: 10,
  expert: false,
};

const FIELD_KINDS = {
  loan: 'currency',
  interest: 'percent',
  annuity: 'currency',
  fixed: 'integer',
  follow: 'percent',
  fee: 'currency',
  'cap-amount': 'currency',
  'cap-rate': 'percent',
  'cap-years': 'integer',
};

const ERROR_KEYS = [
  'loan',
  'interest',
  'annuity',
  'fixed',
  'follow',
  'fee',
  'cap-amount',
  'cap-rate',
  'cap-years',
];

const NUMERIC_FIELDS = Object.keys(FIELD_KINDS);

const nfCurrency0 = new Intl.NumberFormat('de-AT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const nfCurrency2 = new Intl.NumberFormat('de-AT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nfPercent2 = new Intl.NumberFormat('de-AT', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nfPercent3 = new Intl.NumberFormat('de-AT', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});
const nfInput2 = new Intl.NumberFormat('de-AT', {
  maximumFractionDigits: 2,
});
const nfInput3 = new Intl.NumberFormat('de-AT', {
  maximumFractionDigits: 3,
});
const nfInput0 = new Intl.NumberFormat('de-AT', {
  maximumFractionDigits: 0,
});
const nfAxis = new Intl.NumberFormat('de-AT', {
  maximumFractionDigits: 1,
});

const els = {
  form: document.getElementById('calc-form'),
  loan: document.getElementById('loan'),
  interest: document.getElementById('interest'),
  annuity: document.getElementById('annuity'),
  ppy: document.getElementById('ppy'),
  fixed: document.getElementById('fixed'),
  follow: document.getElementById('follow'),
  fee: document.getElementById('fee'),
  capEnabled: document.getElementById('cap-enabled'),
  'cap-amount': document.getElementById('cap-amount'),
  'cap-rate': document.getElementById('cap-rate'),
  'cap-years': document.getElementById('cap-years'),
  advanced: document.getElementById('advanced'),
  installmentHint: document.getElementById('installment-hint'),
  paymentHint: document.getElementById('payment-hint'),
  reset: document.getElementById('reset'),
  kpis: document.getElementById('kpis'),
  summarySentence: document.getElementById('summary-sentence'),
  warning: document.getElementById('warning'),
  termPill: document.getElementById('term-pill'),
  chart: document.getElementById('chart'),
  schedule: document.getElementById('schedule'),
  scheduleCount: document.getElementById('schedule-count'),
  exportCsv: document.getElementById('export-csv'),
  copyLink: document.getElementById('copy-link'),
  copyStatus: document.getElementById('copy-status'),
  tableAnnuity: document.getElementById('table-annuity'),
  tableLoan: document.getElementById('table-loan'),
  tableRate: document.getElementById('table-rate'),
  tablePpy: document.getElementById('table-ppy'),
  countAnnuity: document.getElementById('count-annuity'),
  countLoan: document.getElementById('count-loan'),
  countRate: document.getElementById('count-rate'),
  countPpy: document.getElementById('count-ppy'),
};

let latest = null;
let recalcTimer = null;
let resizeTimer = null;
let copyStatusTimer = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function parseNumeric(raw, kind = 'currency') {
  let text = String(raw ?? '').trim();
  if (!text) return Number.NaN;

  text = text.replace(/[\s\u00a0]/g, '').replace(/[%€]/g, '');
  if (!text) return Number.NaN;

  const commaIndex = text.lastIndexOf(',');
  const dotIndex = text.lastIndexOf('.');

  if (commaIndex >= 0 && dotIndex >= 0) {
    if (commaIndex > dotIndex) {
      text = text.replace(/\./g, '').replace(/,/g, '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (commaIndex >= 0) {
    text = text.replace(/,/g, '.');
  } else if (dotIndex >= 0 && kind !== 'percent') {
    if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(text)) {
      text = text.replace(/\./g, '');
    } else if ((text.match(/\./g) ?? []).length > 1) {
      return Number.NaN;
    }
  }

  const value = Number(text);
  return Number.isFinite(value) ? value : Number.NaN;
}

function formatInputValue(value, kind) {
  if (!Number.isFinite(value)) return '';
  if (kind === 'currency') return nfInput2.format(value);
  if (kind === 'percent') return nfInput3.format(value);
  return nfInput0.format(value);
}

function eur0(value) {
  return nfCurrency0.format(Number.isFinite(value) ? value : 0);
}

function eur2(value) {
  return nfCurrency2.format(Number.isFinite(value) ? value : 0);
}

function pct(value, digits = 2) {
  const formatter = digits === 3 ? nfPercent3 : nfPercent2;
  return formatter.format(Number.isFinite(value) ? value : 0);
}

function compactEuro(value) {
  if (!Number.isFinite(value) || value === 0) return eur0(0);
  if (Math.abs(value) >= 1_000_000) {
    return `${nfAxis.format(value / 1_000_000)} Mio. €`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${nfAxis.format(value / 1_000)} Tsd. €`;
  }
  return eur0(value);
}

function compactEuroNarrow(value) {
  if (!Number.isFinite(value) || value === 0) return '0 €';
  if (Math.abs(value) >= 1_000_000) {
    return `${nfAxis.format(value / 1_000_000)}M €`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${nfAxis.format(value / 1_000)}k €`;
  }
  return `${nfAxis.format(value)} €`;
}

function signedCurrency(value) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.005) return '±0 €';
  return `${value > 0 ? '+' : '−'}${nfInput0.format(Math.abs(value))} €`;
}

function termLabel(scenario) {
  if (scenario.compound) return 'nicht tilgbar';
  if (!scenario.complete) return `> ${MAX_YEARS} Jahre`;

  const months = Math.round(
    (scenario.payments.length * 12) / scenario.input.paymentsPerYear,
  );
  if (months <= 0) return '—';

  const years = Math.floor(months / 12);
  const remainder = months % 12;
  if (years === 0) return `${months} Mon.`;
  if (remainder === 0) return `${years} J.`;
  return `${years} J. ${remainder} Mon.`;
}

function formatInput(element, kind) {
  if (element.disabled || !element.value.trim()) return;
  const value = parseNumeric(element.value, kind);
  if (Number.isFinite(value)) {
    element.value = formatInputValue(value, kind);
  }
}

function setError(key, message) {
  const input = els[key];
  const error = document.querySelector(`[data-error-for="${key}"]`);
  if (!input || !error) return;

  if (message) {
    input.setAttribute('aria-invalid', 'true');
    error.textContent = message;
    error.hidden = false;
  } else {
    input.removeAttribute('aria-invalid');
    error.textContent = '';
    error.hidden = true;
  }
}

function setErrors(errors) {
  for (const key of ERROR_KEYS) {
    setError(key, errors[key]);
  }
}

function readForm() {
  const values = {
    loan: parseNumeric(els.loan.value, 'currency'),
    interest: parseNumeric(els.interest.value, 'percent'),
    annuity: parseNumeric(els.annuity.value, 'currency'),
    ppy: Number(els.ppy.value),
    fixed: parseNumeric(els.fixed.value, 'integer'),
    follow: parseNumeric(els.follow.value, 'percent'),
    fee: parseNumeric(els.fee.value, 'currency'),
    capEnabled: els.capEnabled.checked,
    capAmount: parseNumeric(els['cap-amount'].value, 'currency'),
    capRate: parseNumeric(els['cap-rate'].value, 'percent'),
    capYears: parseNumeric(els['cap-years'].value, 'integer'),
    expert: els.advanced.open,
  };

  const errors = {};

  if (!(values.loan > 0)) {
    errors.loan = 'Bitte einen Betrag größer als 0 eingeben.';
  }
  if (!(values.interest >= 0)) {
    errors.interest = 'Bitte einen Zins ab 0 eingeben.';
  }
  if (!(values.annuity > 0)) {
    errors.annuity = 'Bitte eine Rate größer als 0 eingeben.';
  }
  if (!Number.isInteger(values.fixed) || values.fixed < 0) {
    errors.fixed = 'Bitte eine ganze Zahl ab 0 eingeben.';
  }
  if (!(values.follow >= 0)) {
    errors.follow = 'Bitte einen Zins ab 0 eingeben.';
  }
  if (!(values.fee >= 0)) {
    errors.fee = 'Bitte einen Betrag ab 0 eingeben.';
  }
  if (values.capEnabled) {
    if (!(values.capAmount >= 0)) {
      errors['cap-amount'] = 'Bitte einen Betrag ab 0 eingeben.';
    }
    if (!(values.capRate >= 0)) {
      errors['cap-rate'] = 'Bitte einen Zins ab 0 eingeben.';
    }
    if (!Number.isInteger(values.capYears) || values.capYears < 0) {
      errors['cap-years'] = 'Bitte eine ganze Zahl ab 0 eingeben.';
    }
  }

  const input = {
    loan: values.loan,
    interestRate: values.interest / 100,
    monthlyAnnuity: values.annuity,
    paymentsPerYear: values.ppy,
    fixedYears: values.fixed,
    followUpRate: values.follow / 100,
    annualFee: values.fee,
    capAmount: values.capEnabled ? values.capAmount : 0,
    capRate: values.capEnabled ? values.capRate / 100 : 0,
    capYears: values.capEnabled ? values.capYears : 0,
  };

  return { values, input, errors };
}

function updatePaymentHint() {
  const annuity = parseNumeric(els.annuity.value, 'currency');
  const ppy = Number(els.ppy.value);
  if (!(annuity > 0) || !(ppy > 0)) {
    els.installmentHint.textContent = '—';
    els.paymentHint.textContent = '—';
    return;
  }

  const perPayment = (annuity * 12) / ppy;
  const phrase =
    ppy === 1 ? 'Bei 1 Zahlung pro Jahr' : `Bei ${ppy} Zahlungen pro Jahr`;
  els.installmentHint.textContent = `${phrase}: ${eur2(perPayment)} pro Rate.`;
  els.paymentHint.textContent = `${eur2(perPayment)} pro Rate`;
}

function setCapFieldsEnabled() {
  const enabled = els.capEnabled.checked;
  for (const key of ['cap-amount', 'cap-rate', 'cap-years']) {
    els[key].disabled = !enabled;
    if (!enabled) setError(key, '');
  }
}

function kpi(label, value, note) {
  return `<div class="kpi"><span class="kpi-label">${escapeHtml(label)}</span><span class="kpi-value">${value}</span><span class="kpi-note">${note}</span></div>`;
}

function renderSummary(values, input, scenario) {
  const totals = scenario.totals;
  const share = totals.payments > 0 ? totals.interest / totals.payments : 0;
  const shareLabel = scenario.compound ? '> 100 %' : pct(share);

  els.termPill.textContent = termLabel(scenario);
  els.kpis.innerHTML = [
    kpi(
      'Gesamtzahlung',
      eur2(totals.payments),
      scenario.complete ? 'Tilgung + Zinsen + Gebühren' : 'im Modellzeitraum',
    ),
    kpi(
      'Zinsen',
      eur2(totals.interest),
      scenario.compound
        ? 'übersteigen die Rate'
        : `${pct(share)} der Gesamtzahlung`,
    ),
    kpi(
      'Gebühren',
      eur2(totals.fees),
      totals.fees > 0 ? 'Kontoführung insgesamt' : 'keine Kontoführung',
    ),
    kpi(
      'Zinsanteil',
      shareLabel,
      scenario.compound ? 'Rate deckt Zinsen nicht' : 'an allen Zahlungen',
    ),
  ].join('');

  if (!scenario.complete) {
    if (scenario.compound) {
      els.summarySentence.innerHTML = `Die Rate von <strong>${eur2(scenario.paymentAmount)}</strong> reicht nicht aus, um Zinsen und Gebühren zu decken. Das Darlehen wird in diesem Modell nicht getilgt.`;
    } else {
      const last = scenario.payments.at(-1);
      els.summarySentence.innerHTML = `Nach <strong>${MAX_YEARS} Jahren</strong> sind noch <strong>${eur2(last?.remainingDebt)}</strong> offen. Erhöhe die Rate oder prüfe die Zinsbegrenzung.`;
    }
  } else {
    const feePart =
      totals.fees > 0.005 ? ` + <strong>${eur2(totals.fees)}</strong> Gebühren` : '';
    els.summarySentence.innerHTML = `<strong>${eur2(input.loan)}</strong> Darlehen + <strong>${eur2(totals.interest)}</strong> Zinsen${feePart} = <strong>${eur2(totals.payments)}</strong> Gesamtzahlung.`;
  }

  let warning = null;
  if (scenario.compound) {
    warning = {
      type: 'warn',
      title: 'Keine Tilgung',
      text: `${scenario.reason} Erhöhe die Rate, senke das Darlehen oder prüfe die Zinsbegrenzung.`,
    };
  } else if (!scenario.complete) {
    warning = {
      type: 'warn',
      title: 'Laufzeitgrenze',
      text: `${scenario.reason} Erhöhe die Rate, damit das Darlehen innerhalb des Modellzeitraums getilgt wird.`,
    };
  } else {
    const capNotes = [];
    if (values.capEnabled && values.capYears === 0) {
      capNotes.push('Die Begünstigungsdauer ist 0 Jahre; die Zinsbegrenzung wirkt daher nicht.');
    }
    if (values.capEnabled && values.capAmount === 0) {
      capNotes.push('Der begünstigte Betrag ist 0 €; die Zinsbegrenzung wirkt daher nicht.');
    }
    if (values.capEnabled && values.capRate >= values.interest) {
      capNotes.push('Der begünstigte Zins ist nicht niedriger als der Nominalzins; es entsteht kein Vorteil.');
    }
    if (capNotes.length > 0) {
      warning = {
        type: 'info',
        title: 'Zinsbegrenzung ohne Wirkung',
        text: capNotes.join(' '),
      };
    }
  }

  if (warning) {
    els.warning.hidden = false;
    els.warning.className = `notice ${warning.type}`;
    els.warning.innerHTML = `<strong>${escapeHtml(warning.title)}</strong> ${escapeHtml(warning.text)}`;
  } else {
    els.warning.hidden = true;
    els.warning.className = 'notice';
    els.warning.innerHTML = '';
  }
}

function groupYearly(rows, maxGroups = 42) {
  if (rows.length <= maxGroups) {
    return rows.map((row) => ({
      ...row,
      label: String(row.year),
      years: 1,
    }));
  }

  const size = Math.ceil(rows.length / maxGroups);
  const groups = [];

  for (let index = 0; index < rows.length; index += size) {
    const slice = rows.slice(index, index + size);
    groups.push({
      label:
        slice.length > 1
          ? `${slice[0].year}–${slice.at(-1).year}`
          : String(slice[0].year),
      years: slice.length,
      interest: slice.reduce((sum, row) => sum + row.interest, 0),
      fees: slice.reduce((sum, row) => sum + row.fees, 0),
      principal: slice.reduce((sum, row) => sum + row.principal, 0),
      payments: slice.reduce((sum, row) => sum + row.payments, 0),
      remainingDebt: slice.at(-1).remainingDebt,
    });
  }

  return groups;
}

function renderChart(input, scenario) {
  const groups = groupYearly(scenario.yearly);
  if (groups.length === 0) {
    els.chart.innerHTML =
      '<div class="empty-state"><strong>Kein Verlauf verfügbar</strong>Für diese Eingaben lässt sich kein Tilgungsverlauf zeichnen.</div>';
    return;
  }

  const narrow = window.matchMedia('(max-width: 640px)').matches;
  const width = narrow ? 360 : 820;
  const height = narrow ? 320 : 340;
  const margin = narrow
    ? { top: 32, right: 54, bottom: 46, left: 50 }
    : { top: 32, right: 72, bottom: 48, left: 68 };
  const tickCount = narrow ? 3 : 4;
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const baseline = margin.top + plotHeight;
  const maxPayment = Math.max(
    1,
    ...groups.map((group) => group.principal + group.interest + group.fees),
  );
  const maxDebt = Math.max(
    1,
    input.loan,
    ...groups.map((group) => group.remainingDebt),
  );
  const yPayment = (value) => baseline - (value / maxPayment) * plotHeight;
  const yDebt = (value) => baseline - (value / maxDebt) * plotHeight;
  const slot = plotWidth / groups.length;
  const barWidth = Math.max(
    2,
    Math.min(narrow ? 18 : 30, slot * 0.62),
  );
  const axisLabel = (value) =>
    narrow ? compactEuroNarrow(value) : compactEuro(value);
  const parts = [];

  parts.push(
    `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-desc">`,
  );
  parts.push('<title id="chart-title">Verlauf von Rate und Restschuld</title>');
  parts.push(
    '<desc id="chart-desc">Gestapelte Balken zeigen Tilgung, Zinsen und Gebühren pro Jahr. Die Linie zeigt die Restschuld am Jahresende.</desc>',
  );

  for (let tick = 0; tick <= tickCount; tick += 1) {
    const value = (maxPayment * tick) / tickCount;
    const y = yPayment(value);
    parts.push(
      `<line class="chart-grid" x1="${margin.left}" x2="${margin.left + plotWidth}" y1="${y}" y2="${y}"/>`,
    );
    parts.push(
      `<text class="chart-text" x="${margin.left - 8}" y="${y + 4}" text-anchor="end">${escapeHtml(axisLabel(value))}</text>`,
    );
  }

  for (let tick = 0; tick <= tickCount; tick += 1) {
    const value = (maxDebt * tick) / tickCount;
    const y = yDebt(value);
    parts.push(
      `<text class="chart-text" x="${margin.left + plotWidth + 8}" y="${y + 4}" text-anchor="start">${escapeHtml(axisLabel(value))}</text>`,
    );
  }

  parts.push(
    `<text class="chart-title" x="${margin.left}" y="${margin.top - 14}" text-anchor="start">€ / Jahr</text>`,
  );
  parts.push(
    `<text class="chart-title" x="${margin.left + plotWidth}" y="${margin.top - 14}" text-anchor="end">Restschuld</text>`,
  );

  groups.forEach((group, index) => {
    const centerX = margin.left + slot * (index + 0.5);
    const x = centerX - barWidth / 2;
    const principalY = yPayment(group.principal);
    const interestY = yPayment(group.principal + group.interest);
    const feeY = yPayment(
      group.principal + group.interest + group.fees,
    );
    const total = group.principal + group.interest + group.fees;
    const title = `${group.label}: Rate ${eur0(total)}, Zinsen ${eur0(group.interest)}, Tilgung ${eur0(group.principal)}, Restschuld ${eur0(group.remainingDebt)}`;

    parts.push(`<g><title>${escapeHtml(title)}</title>`);
    if (group.principal > 0) {
      parts.push(
        `<rect class="bar-principal" x="${x}" y="${principalY}" width="${barWidth}" height="${Math.max(0, baseline - principalY)}"/>`,
      );
    }
    if (group.interest > 0) {
      parts.push(
        `<rect class="bar-interest" x="${x}" y="${interestY}" width="${barWidth}" height="${Math.max(0, principalY - interestY)}"/>`,
      );
    }
    if (group.fees > 0) {
      parts.push(
        `<rect class="bar-fees" x="${x}" y="${feeY}" width="${barWidth}" height="${Math.max(0, interestY - feeY)}"/>`,
      );
    }
    parts.push('</g>');
  });

  const debtPoints = groups
    .map(
      (group, index) =>
        `${margin.left + slot * (index + 0.5)},${yDebt(group.remainingDebt)}`,
    )
    .join(' ');
  parts.push(`<polyline class="chart-debt-line" points="${debtPoints}"/>`);

  if (groups.length <= 42) {
    groups.forEach((group, index) => {
      const cx = margin.left + slot * (index + 0.5);
      const cy = yDebt(group.remainingDebt);
      parts.push(
        `<circle class="chart-debt-dot" cx="${cx}" cy="${cy}" r="2.5"><title>${escapeHtml(group.label)}: Restschuld ${eur0(group.remainingDebt)}</title></circle>`,
      );
    });
  }

  parts.push(
    `<line class="chart-axis" x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${baseline}"/>`,
  );
  parts.push(
    `<line class="chart-axis" x1="${margin.left}" x2="${margin.left + plotWidth}" y1="${baseline}" y2="${baseline}"/>`,
  );

  const labelCount = Math.min(narrow ? 4 : 8, groups.length);
  const labelIndices = new Set();
  if (labelCount === 1) {
    labelIndices.add(0);
  } else {
    for (let index = 0; index < labelCount; index += 1) {
      labelIndices.add(
        Math.round(((groups.length - 1) * index) / (labelCount - 1)),
      );
    }
  }

  for (const index of labelIndices) {
    const cx = margin.left + slot * (index + 0.5);
    parts.push(
      `<text class="chart-text" x="${cx}" y="${baseline + 20}" text-anchor="middle">${escapeHtml(groups[index].label)}</text>`,
    );
  }

  parts.push('</svg>');

  const step = Math.ceil(scenario.yearly.length / groups.length);
  if (step > 1) {
    parts.push(
      `<p class="micro">Hinweis: Die Jahre sind in ${step}-Jahres-Schritten zusammengefasst.</p>`,
    );
  }

  els.chart.innerHTML = parts.join('');
}

function renderSchedule(scenario) {
  const rows = scenario.yearly;
  if (rows.length === 0) {
    els.schedule.innerHTML =
      '<div class="empty-state"><strong>Kein Tilgungsplan</strong>Für diese Eingaben lässt sich kein Plan aufstellen.</div>';
    els.scheduleCount.textContent = '';
    return;
  }

  const totals = scenario.totals;
  const share = totals.payments > 0 ? totals.interest / totals.payments : 0;
  const shareLabel = scenario.compound ? '> 100 %' : pct(share);
  const finalRemaining = scenario.payments.at(-1)?.remainingDebt ?? 0;
  const parts = [];

  parts.push(
    '<table><caption class="sr-only">Jährlicher Tilgungsplan</caption><thead><tr>',
  );
  parts.push('<th scope="col">Jahr</th>');
  parts.push('<th scope="col" class="num">Zins p. a.</th>');
  parts.push('<th scope="col" class="num">Zinsen</th>');
  parts.push('<th scope="col" class="num">Gebühren</th>');
  parts.push('<th scope="col" class="num">Tilgung</th>');
  parts.push('<th scope="col" class="num">Rate</th>');
  parts.push('<th scope="col" class="num">Restschuld</th>');
  parts.push('<th scope="col" class="num">Zinsanteil</th>');
  parts.push('</tr></thead><tbody>');

  for (const row of rows) {
    const badges = [];
    if (row.isFixedRateChange) {
      badges.push('<span class="badge">Zinsbindung endet</span>');
    }
    if (row.isCapEnd) {
      badges.push('<span class="badge gold">Begünstigung endet</span>');
    }
    if (row.capApplied && row.year === 1) {
      badges.push('<span class="badge green">begünstigt</span>');
    }

    const rateTitle = row.capApplied
      ? 'Für einen Teil der Restschuld gilt der begünstigte Zins.'
      : '';

    parts.push('<tr>');
    parts.push(
      `<th scope="row">${row.year}${badges.join('')}</th>`,
    );
    parts.push(
      `<td class="num"${rateTitle ? ` title="${escapeHtml(rateTitle)}"` : ''}>${pct(row.annualRate)}</td>`,
    );
    parts.push(`<td class="num">${eur2(row.interest)}</td>`);
    parts.push(`<td class="num">${eur2(row.fees)}</td>`);
    parts.push(`<td class="num">${eur2(row.principal)}</td>`);
    parts.push(`<td class="num">${eur2(row.payments)}</td>`);
    parts.push(`<td class="num">${eur2(row.remainingDebt)}</td>`);
    parts.push(
      `<td class="num">${scenario.compound && row.interestShare > 1 ? '> 100 %' : pct(row.interestShare)}</td>`,
    );
    parts.push('</tr>');
  }

  parts.push('</tbody><tfoot><tr>');
  parts.push(
    `<th scope="row">${scenario.complete ? 'Gesamt' : 'Gesamt (Modellzeitraum)'}</th>`,
  );
  parts.push('<td class="num">—</td>');
  parts.push(`<td class="num">${eur2(totals.interest)}</td>`);
  parts.push(`<td class="num">${eur2(totals.fees)}</td>`);
  parts.push(`<td class="num">${eur2(totals.principal)}</td>`);
  parts.push(`<td class="num">${eur2(totals.payments)}</td>`);
  parts.push(`<td class="num">${eur2(finalRemaining)}</td>`);
  parts.push(`<td class="num">${shareLabel}</td>`);
  parts.push('</tr></tfoot></table>');

  els.schedule.innerHTML = parts.join('');
  const rateWord = scenario.payments.length === 1 ? 'Rate' : 'Raten';
  els.scheduleCount.textContent = `${termLabel(scenario)} · ${scenario.payments.length} ${rateWord}`;
}

function renderComparisonTable(container, countElement, rows, options) {
  if (!container || !countElement) return;

  countElement.textContent = `${rows.length} Varianten`;
  let previousTotal = null;
  const parts = [];

  parts.push(
    `<table><caption class="sr-only">${escapeHtml(options.caption)}</caption><thead><tr>`,
  );
  parts.push(`<th scope="col">${escapeHtml(options.label)}</th>`);
  parts.push('<th scope="col" class="num">Zinsen</th>');
  parts.push('<th scope="col" class="num">Gebühren</th>');
  parts.push('<th scope="col" class="num">Gesamtzahlung</th>');
  parts.push('<th scope="col" class="num">Zinsanteil</th>');
  parts.push('<th scope="col">Laufzeit</th>');
  parts.push('<th scope="col" class="num">Δ Gesamtzahlung</th>');
  parts.push('</tr></thead><tbody>');

  for (const row of rows) {
    const scenario = row.scenario;
    const current =
      Math.abs(row.value - options.base) <= (options.epsilon ?? 0.005);
    const valid = !scenario.error && scenario.complete;
    let delta = null;

    if (valid) {
      if (previousTotal !== null) {
        delta = scenario.totals.payments - previousTotal;
      }
      previousTotal = scenario.totals.payments;
    } else {
      previousTotal = null;
    }

    const rowClass = current ? 'current-row' : valid ? '' : 'muted-row';
    const currentBadge = current
      ? ' <span class="badge gold">aktuell</span>'
      : '';
    const reason = scenario.reason
      ? ` title="${escapeHtml(scenario.reason)}"`
      : '';

    parts.push(`<tr class="${rowClass}"${reason}>`);
    parts.push(
      `<th scope="row">${options.format(row.value, row)}${currentBadge}</th>`,
    );

    if (valid) {
      parts.push(`<td class="num">${eur0(scenario.totals.interest)}</td>`);
      parts.push(`<td class="num">${eur0(scenario.totals.fees)}</td>`);
      parts.push(`<td class="num">${eur0(scenario.totals.payments)}</td>`);
      parts.push(
        `<td class="num">${pct(scenario.totals.interest / scenario.totals.payments)}</td>`,
      );
      parts.push(`<td>${termLabel(scenario)}</td>`);
      parts.push(
        `<td class="num">${delta === null ? '—' : signedCurrency(delta)}</td>`,
      );
    } else {
      parts.push('<td class="num">—</td>');
      parts.push('<td class="num">—</td>');
      parts.push('<td class="num">—</td>');
      parts.push('<td class="num">—</td>');
      parts.push('<td><span class="badge red">nicht tilgbar</span></td>');
      parts.push('<td class="num">—</td>');
    }

    parts.push('</tr>');
  }

  parts.push('</tbody></table>');
  container.innerHTML = parts.join('');
}

function renderComparisons(input) {
  renderComparisonTable(els.tableAnnuity, els.countAnnuity, exploreAnnuities(input), {
    base: input.monthlyAnnuity,
    epsilon: 0.005,
    label: 'Monatsrate',
    caption: 'Vergleich verschiedener Monatsraten',
    format: (value) => eur0(value),
  });

  renderComparisonTable(els.tableLoan, els.countLoan, exploreLoans(input), {
    base: input.loan,
    epsilon: 0.5,
    label: 'Darlehen',
    caption: 'Vergleich verschiedener Darlehenssummen',
    format: (value) => eur0(value),
  });

  renderComparisonTable(els.tableRate, els.countRate, exploreRates(input), {
    base: input.fixedYears > 0 ? input.interestRate : input.followUpRate,
    epsilon: 1e-9,
    label: 'Zins p. a.',
    caption: 'Vergleich verschiedener Zinssätze',
    format: (value) => pct(value, 3),
  });

  renderComparisonTable(
    els.tablePpy,
    els.countPpy,
    explorePaymentFrequencies(input),
    {
      base: input.paymentsPerYear,
      epsilon: 0.01,
      label: 'Zahlungen pro Jahr',
      caption: 'Vergleich verschiedener Zahlungsweisen',
      format: (value) => {
        const perPayment = (input.monthlyAnnuity * 12) / value;
        return `<span class="row-main">${value}× pro Jahr</span><span class="row-sub">${eur2(perPayment)} pro Rate</span>`;
      },
    },
  );
}

function clearResults(message) {
  latest = null;
  els.termPill.textContent = '—';
  els.kpis.innerHTML = `<div class="empty-state"><strong>Bitte Eingaben prüfen</strong>${escapeHtml(message)}</div>`;
  els.summarySentence.textContent = '';
  els.warning.hidden = true;
  els.warning.className = 'notice';
  els.warning.innerHTML = '';
  els.chart.innerHTML = `<div class="empty-state"><strong>Kein Verlauf</strong>${escapeHtml(message)}</div>`;
  els.schedule.innerHTML = `<div class="empty-state"><strong>Kein Tilgungsplan</strong>${escapeHtml(message)}</div>`;
  els.scheduleCount.textContent = '';
  els.exportCsv.disabled = true;

  for (const [table, count] of [
    [els.tableAnnuity, els.countAnnuity],
    [els.tableLoan, els.countLoan],
    [els.tableRate, els.countRate],
    [els.tablePpy, els.countPpy],
  ]) {
    table.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    count.textContent = '';
  }
}

function recalc({ updateUrl = true } = {}) {
  const { values, input, errors } = readForm();
  setErrors(errors);
  updatePaymentHint();

  if (Object.keys(errors).length > 0) {
    clearResults('Bitte prüfe die markierten Eingaben.');
    return;
  }

  const scenario = buildScenario(input);
  if (scenario.error) {
    clearResults(scenario.error);
    return;
  }

  latest = { values, input, scenario };
  renderSummary(values, input, scenario);
  renderChart(input, scenario);
  renderSchedule(scenario);
  renderComparisons(input);
  els.exportCsv.disabled = false;

  if (updateUrl) writeUrl(values);
}

function param(value, decimals) {
  if (!Number.isFinite(value)) return '0';
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
}

function buildUrl(values) {
  const params = new URLSearchParams();
  params.set('loan', param(values.loan, 2));
  params.set('interest', param(values.interest, 4));
  params.set('annuity', param(values.annuity, 2));
  params.set('ppy', String(values.ppy));
  params.set('fixed', param(values.fixed, 0));
  params.set('follow', param(values.follow, 4));
  params.set('fee', param(values.fee, 2));
  params.set('capOn', values.capEnabled ? '1' : '0');
  params.set('cap', param(values.capAmount, 2));
  params.set('capRate', param(values.capRate, 4));
  params.set('capYears', param(values.capYears, 0));
  params.set('expert', els.advanced.open ? '1' : '0');

  const url = new URL(window.location.href);
  url.search = params.toString();
  return url.toString();
}

function writeUrl(values) {
  try {
    window.history.replaceState(null, '', buildUrl(values));
  } catch {
    // A file:// preview may forbid history changes; the calculator still works.
  }
}

function scheduleRecalc() {
  window.clearTimeout(recalcTimer);
  recalcTimer = window.setTimeout(() => recalc(), 160);
}

function setFormValues(values) {
  els.loan.value = formatInputValue(values.loan, 'currency');
  els.interest.value = formatInputValue(values.interest, 'percent');
  els.annuity.value = formatInputValue(values.annuity, 'currency');
  els.ppy.value = String(values.ppy);
  els.fixed.value = formatInputValue(values.fixed, 'integer');
  els.follow.value = formatInputValue(values.follow, 'percent');
  els.fee.value = formatInputValue(values.fee, 'currency');
  els.capEnabled.checked = Boolean(values.capEnabled);
  els['cap-amount'].value = formatInputValue(values.capAmount, 'currency');
  els['cap-rate'].value = formatInputValue(values.capRate, 'percent');
  els['cap-years'].value = formatInputValue(values.capYears, 'integer');
  els.advanced.open = Boolean(values.expert);
  setCapFieldsEnabled();
  updatePaymentHint();
}

function loadFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const read = (key, kind, fallback, predicate) => {
    if (!params.has(key)) return fallback;
    const parsed = parseNumeric(params.get(key), kind);
    return Number.isFinite(parsed) && predicate(parsed) ? parsed : fallback;
  };

  const ppyValue = Number(params.get('ppy'));
  const values = {
    loan: read('loan', 'currency', DEFAULTS.loan, (value) => value > 0),
    interest: read('interest', 'percent', DEFAULTS.interest, (value) => value >= 0),
    annuity: read('annuity', 'currency', DEFAULTS.annuity, (value) => value > 0),
    ppy: [1, 2, 4, 12].includes(ppyValue) ? ppyValue : DEFAULTS.ppy,
    fixed: read(
      'fixed',
      'integer',
      DEFAULTS.fixed,
      (value) => Number.isInteger(value) && value >= 0,
    ),
    follow: read('follow', 'percent', DEFAULTS.follow, (value) => value >= 0),
    fee: read('fee', 'currency', DEFAULTS.fee, (value) => value >= 0),
    capEnabled: params.get('capOn') === '1',
    capAmount: read('cap', 'currency', DEFAULTS.capAmount, (value) => value >= 0),
    capRate: read('capRate', 'percent', DEFAULTS.capRate, (value) => value >= 0),
    capYears: read(
      'capYears',
      'integer',
      DEFAULTS.capYears,
      (value) => Number.isInteger(value) && value >= 0,
    ),
    expert: params.get('expert') === '1',
  };

  setFormValues(values);
  recalc({ updateUrl: false });
}

function showCopyStatus(message, isError = false) {
  window.clearTimeout(copyStatusTimer);
  els.copyStatus.textContent = message;
  els.copyStatus.style.color = isError ? 'var(--red)' : 'var(--green)';
  if (message) {
    copyStatusTimer = window.setTimeout(() => {
      els.copyStatus.textContent = '';
      els.copyStatus.style.color = '';
    }, 2600);
  }
}

async function copyLink() {
  const { values, errors } = readForm();
  if (Object.keys(errors).length > 0) {
    showCopyStatus('Bitte zuerst gültige Eingaben machen.', true);
    return;
  }

  const url = buildUrl(values);
  try {
    await navigator.clipboard.writeText(url);
    showCopyStatus('Link kopiert.');
  } catch {
    window.prompt('Link zum Kopieren:', url);
  }
}

function csvNumber(value) {
  return (Number.isFinite(value) ? value : 0)
    .toFixed(2)
    .replace('.', ',');
}

function csvPercent(value) {
  return `${(Number.isFinite(value) ? value * 100 : 0)
    .toFixed(2)
    .replace('.', ',')} %`;
}

function exportCsv() {
  const { input, errors } = readForm();
  if (Object.keys(errors).length > 0) return;

  const scenario = buildScenario(input);
  if (scenario.error) return;

  const lines = [
    'Jahr;Zinssatz;Zinsen;Gebuehren;Tilgung;Rate;Restschuld;Zinsanteil',
  ];

  for (const row of scenario.yearly) {
    lines.push(
      [
        row.year,
        csvPercent(row.annualRate),
        csvNumber(row.interest),
        csvNumber(row.fees),
        csvNumber(row.principal),
        csvNumber(row.payments),
        csvNumber(row.remainingDebt),
        csvPercent(row.interestShare),
      ].join(';'),
    );
  }

  lines.push(
    [
      scenario.complete ? 'Gesamt' : 'Gesamt (Modellzeitraum)',
      '',
      csvNumber(scenario.totals.interest),
      csvNumber(scenario.totals.fees),
      csvNumber(scenario.totals.principal),
      csvNumber(scenario.totals.payments),
      csvNumber(0),
      csvPercent(
        scenario.totals.payments > 0
          ? scenario.totals.interest / scenario.totals.payments
          : 0,
      ),
    ].join(';'),
  );

  const content = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const rate = (input.interestRate * 100).toFixed(2).replace('.', '-');
  anchor.href = url;
  anchor.download = `tilgungsplan-${Math.round(input.loan)}-${rate}prozent.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resetAll() {
  setFormValues({ ...DEFAULTS });
  els.advanced.open = false;
  try {
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.hash}`,
    );
  } catch {
    // Ignore file:// restrictions.
  }
  showCopyStatus('');
  recalc({ updateUrl: false });
  els.loan.focus();
}

function init() {
  loadFromUrl();

  for (const key of NUMERIC_FIELDS) {
    const element = els[key];
    element.addEventListener('input', () => {
      updatePaymentHint();
      scheduleRecalc();
    });
    element.addEventListener('change', () => {
      window.clearTimeout(recalcTimer);
      formatInput(element, FIELD_KINDS[key]);
      updatePaymentHint();
      recalc();
    });
  }

  els.ppy.addEventListener('change', () => {
    window.clearTimeout(recalcTimer);
    updatePaymentHint();
    recalc();
  });

  els.capEnabled.addEventListener('change', () => {
    window.clearTimeout(recalcTimer);
    setCapFieldsEnabled();
    recalc();
  });

  els.advanced.addEventListener('toggle', () => {
    const { values, errors } = readForm();
    if (Object.keys(errors).length === 0) writeUrl(values);
  });

  els.reset.addEventListener('click', resetAll);
  els.exportCsv.addEventListener('click', exportCsv);
  els.copyLink.addEventListener('click', copyLink);
  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    window.clearTimeout(recalcTimer);
    recalc();
  });

  window.addEventListener('popstate', loadFromUrl);
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (latest) renderChart(latest.input, latest.scenario);
    }, 150);
  });
}

init();
