/**
 * Pure amortizing-loan engine.
 *
 * Rates are decimal fractions per year (0.01 = 1 % p.a.).
 * Amounts are nominal euros. Intermediate values are never rounded; the UI
 * rounds only for display.
 */

export const MAX_YEARS = 100;
export const PAYMENT_FREQUENCIES = [1, 2, 4, 12];

const EPSILON = 1e-7;

function failedResult(message) {
  return {
    input: null,
    payments: [],
    yearly: [],
    totals: { interest: 0, fees: 0, principal: 0, payments: 0 },
    complete: false,
    compound: false,
    error: message,
    reason: null,
    paymentAmount: 0,
    termYears: 0,
  };
}

function normalizeInput(source) {
  const input = source ?? {};
  const value = (key, fallback = 0) => {
    const parsed = Number(input[key]);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalized = {
    loan: value('loan'),
    interestRate: value('interestRate'),
    monthlyAnnuity: value('monthlyAnnuity'),
    paymentsPerYear: Math.trunc(value('paymentsPerYear', 12)),
    fixedYears: Math.max(0, value('fixedYears')),
    followUpRate: value('followUpRate'),
    annualFee: Math.max(0, value('annualFee')),
    capAmount: Math.max(0, value('capAmount')),
    capRate: value('capRate'),
    capYears: Math.max(0, value('capYears')),
  };

  if (!Number.isFinite(input.loan) || normalized.loan <= 0) {
    return { error: 'Das Darlehen muss größer als 0 sein.' };
  }
  if (!Number.isFinite(input.monthlyAnnuity) || normalized.monthlyAnnuity <= 0) {
    return { error: 'Die Monatsrate muss größer als 0 sein.' };
  }
  if (!Number.isFinite(input.interestRate) || normalized.interestRate < 0) {
    return { error: 'Der Nominalzins darf nicht negativ sein.' };
  }
  if (!Number.isFinite(input.followUpRate) || normalized.followUpRate < 0) {
    return { error: 'Der Folgezins darf nicht negativ sein.' };
  }
  if (!Number.isFinite(input.annualFee) || normalized.annualFee < 0) {
    return { error: 'Die Kontoführung darf nicht negativ sein.' };
  }
  if (!Number.isFinite(input.capAmount) || normalized.capAmount < 0) {
    return { error: 'Der begünstigte Betrag darf nicht negativ sein.' };
  }
  if (!Number.isFinite(input.capRate) || normalized.capRate < 0) {
    return { error: 'Der begünstigte Zins darf nicht negativ sein.' };
  }
  if (!Number.isFinite(input.capYears) || normalized.capYears < 0) {
    return { error: 'Die Begünstigungsdauer darf nicht negativ sein.' };
  }
  if (!Number.isFinite(input.fixedYears) || normalized.fixedYears < 0) {
    return { error: 'Die Zinsbindung darf nicht negativ sein.' };
  }
  if (
    !Number.isInteger(normalized.paymentsPerYear) ||
    normalized.paymentsPerYear <= 0
  ) {
    return { error: 'Die Zahlungen pro Jahr müssen eine positive ganze Zahl sein.' };
  }

  const paymentAmount =
    (normalized.monthlyAnnuity * 12) / normalized.paymentsPerYear;

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return { error: 'Aus der Monatsrate lässt sich keine gültige Rate berechnen.' };
  }

  return { input: normalized, paymentAmount };
}

function capIsEffective(input) {
  return input.capYears > 0 && input.capAmount > 0 && input.capRate < input.interestRate;
}

function interestForPeriod(input, debt, annualRate, year) {
  const periodRate = annualRate / input.paymentsPerYear;
  const capApplied =
    capIsEffective(input) &&
    year <= input.capYears &&
    debt > 0 &&
    annualRate > input.capRate;

  if (!capApplied) {
    return { interest: debt * periodRate, capApplied: false };
  }

  const underCap = Math.min(input.capAmount, debt);
  const overCap = Math.max(0, debt - underCap);
  const cappedRate = Math.min(input.capRate, annualRate);

  return {
    interest:
      overCap * periodRate + underCap * (cappedRate / input.paymentsPerYear),
    capApplied: true,
  };
}

/**
 * Builds the period-by-period schedule.
 *
 * @param {object} source
 * @returns {object}
 */
export function buildSchedule(source) {
  const normalized = normalizeInput(source);
  if (normalized.error) return failedResult(normalized.error);

  const input = normalized.input;
  const paymentAmount = normalized.paymentAmount;
  const period = 1 / input.paymentsPerYear;
  const maxPayments = MAX_YEARS * input.paymentsPerYear;
  const payments = [];

  let debt = input.loan;
  let complete = false;
  let compound = false;
  let reason = null;

  for (let number = 1; number <= maxPayments; number += 1) {
    const year = Math.ceil(number / input.paymentsPerYear);
    const annualRate =
      year <= input.fixedYears ? input.interestRate : input.followUpRate;
    const periodRate = annualRate / input.paymentsPerYear;
    const { interest, capApplied } = interestForPeriod(
      input,
      debt,
      annualRate,
      year,
    );
    const fee = input.annualFee * period;
    const required = interest + fee;

    if (paymentAmount <= required + EPSILON) {
      payments.push({
        number,
        year,
        annualRate,
        periodRate,
        capApplied,
        interest,
        fee,
        principal: 0,
        payment: paymentAmount,
        remainingDebt: debt,
        interestShare: paymentAmount > 0 ? interest / paymentAmount : 0,
      });
      compound = true;
      reason =
        paymentAmount < required - EPSILON
          ? 'Die Rate liegt unter Zinsen und Gebühren. Das Darlehen würde wachsen.'
          : 'Die Rate deckt nur Zinsen und Gebühren. Das Darlehen wird nicht getilgt.';
      break;
    }

    const principalCapacity = paymentAmount - required;

    if (debt <= principalCapacity + EPSILON) {
      const principal = debt;
      const actualPayment = principal + required;
      payments.push({
        number,
        year,
        annualRate,
        periodRate,
        capApplied,
        interest,
        fee,
        principal,
        payment: actualPayment,
        remainingDebt: 0,
        interestShare: actualPayment > 0 ? interest / actualPayment : 0,
      });
      debt = 0;
      complete = true;
      break;
    }

    const principal = principalCapacity;
    const remainingDebt = Math.max(0, debt - principal);
    payments.push({
      number,
      year,
      annualRate,
      periodRate,
      capApplied,
      interest,
      fee,
      principal,
      payment: paymentAmount,
      remainingDebt,
      interestShare: interest / paymentAmount,
    });
    debt = remainingDebt;

    if (debt <= EPSILON) {
      debt = 0;
      complete = true;
      break;
    }
  }

  if (!complete && !compound) {
    reason = `Nach ${MAX_YEARS} Jahren ist das Darlehen noch nicht getilgt.`;
  }

  const totals = payments.reduce(
    (accumulator, payment) => ({
      interest: accumulator.interest + payment.interest,
      fees: accumulator.fees + payment.fee,
      principal: accumulator.principal + payment.principal,
      payments: accumulator.payments + payment.payment,
    }),
    { interest: 0, fees: 0, principal: 0, payments: 0 },
  );

  return {
    input,
    payments,
    totals,
    complete,
    compound,
    error: null,
    reason,
    paymentAmount,
    termYears: payments.length / input.paymentsPerYear,
  };
}

/**
 * Aggregates a period schedule into calendar years.
 *
 * @param {object} schedule
 * @returns {Array<object>}
 */
export function buildYearly(schedule) {
  if (!schedule || schedule.error || schedule.payments.length === 0) return [];

  const input = schedule.input;
  const followUpDiffers =
    Math.abs(input.followUpRate - input.interestRate) > 1e-12;
  const firstFollowUpYear =
    input.fixedYears > 0 && followUpDiffers
      ? Math.floor(input.fixedYears) + 1
      : null;
  const firstUncappedYear =
    capIsEffective(input) ? Math.floor(input.capYears) + 1 : null;
  const groups = new Map();

  for (const payment of schedule.payments) {
    let row = groups.get(payment.year);
    if (!row) {
      row = {
        year: payment.year,
        annualRate: payment.annualRate,
        interest: 0,
        fees: 0,
        principal: 0,
        payments: 0,
        remainingDebt: 0,
        capApplied: false,
      };
      groups.set(payment.year, row);
    }

    row.interest += payment.interest;
    row.fees += payment.fee;
    row.principal += payment.principal;
    row.payments += payment.payment;
    row.remainingDebt = payment.remainingDebt;
    row.capApplied = row.capApplied || payment.capApplied;
  }

  return [...groups.values()].map((row) => ({
    ...row,
    interestShare: row.payments > 0 ? row.interest / row.payments : 0,
    isFixedRateChange: row.year === firstFollowUpYear,
    isCapEnd: row.year === firstUncappedYear,
  }));
}

/**
 * Builds the schedule plus its yearly aggregation.
 *
 * @param {object} input
 * @returns {object}
 */
export function buildScenario(input) {
  const schedule = buildSchedule(input);
  return { ...schedule, yearly: buildYearly(schedule) };
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function withCurrent(values, current, decimals = 2) {
  if (!Number.isFinite(current) || current < 0) return values;
  const rounded = round(current, decimals);
  const exists = values.some((value) => Math.abs(value - rounded) < 10 ** -decimals / 2);
  if (exists) return values;
  return [...values, current].sort((left, right) => left - right);
}

/**
 * Explores monthly annuities in 100 € steps around the current value.
 */
export function exploreAnnuities(input) {
  const base = Number.isFinite(input?.monthlyAnnuity) ? input.monthlyAnnuity : 0;
  const step = 100;
  const count = 10;
  const minimum = 100;
  const start = Math.max(minimum, Math.floor((base - step * count) / step) * step);
  const end = Math.ceil((base + step * count) / step) * step;
  const values = [];

  for (let value = start; value <= end + EPSILON; value += step) {
    values.push(round(value, 2));
  }

  return withCurrent(values, base).map((value) => ({
    value,
    scenario: buildScenario({ ...input, monthlyAnnuity: value }),
  }));
}

/**
 * Explores principals in 20.000 € steps around the current value.
 */
export function exploreLoans(input) {
  const base = Number.isFinite(input?.loan) ? input.loan : 0;
  const step = 20_000;
  const count = 10;
  const minimum = 20_000;
  const start = Math.max(minimum, Math.floor((base - step * count) / step) * step);
  const end = Math.ceil((base + step * count) / step) * step;
  const values = [];

  for (let value = start; value <= end + EPSILON; value += step) {
    values.push(round(value, 2));
  }

  return withCurrent(values, base).map((value) => ({
    value,
    scenario: buildScenario({ ...input, loan: value }),
  }));
}

/**
 * Explores the rate that applies from the first year in 0.1 percentage-point
 * steps. The other rate stays unchanged.
 */
export function exploreRates(input) {
  const fixedYears = Number.isFinite(input?.fixedYears) ? input.fixedYears : 0;
  const rateKey = fixedYears > 0 ? 'interestRate' : 'followUpRate';
  const baseRate = Number.isFinite(input?.[rateKey]) ? input[rateKey] : 0;
  const stepBasisPoints = 10;
  const count = 20;
  const minimumBasisPoints = 10;
  const baseBasisPoints = Math.round(baseRate * 10_000);
  const startBasisPoints = Math.max(
    minimumBasisPoints,
    Math.floor(
      (baseBasisPoints - stepBasisPoints * count) / stepBasisPoints,
    ) * stepBasisPoints,
  );
  const endBasisPoints = Math.ceil(
    (baseBasisPoints + stepBasisPoints * count) / stepBasisPoints,
  ) * stepBasisPoints;
  const values = [];

  for (
    let basisPoints = startBasisPoints;
    basisPoints <= endBasisPoints;
    basisPoints += stepBasisPoints
  ) {
    values.push(round(basisPoints / 10_000, 6));
  }

  return withCurrent(values, baseRate, 6).map((value) => ({
    value,
    scenario: buildScenario({
      ...input,
      [rateKey]: value,
    }),
  }));
}

/**
 * Compares the four supported payment frequencies.
 */
export function explorePaymentFrequencies(input) {
  return PAYMENT_FREQUENCIES.map((frequency) => ({
    value: frequency,
    scenario: buildScenario({ ...input, paymentsPerYear: frequency }),
  }));
}
