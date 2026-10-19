import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_YEARS,
  buildScenario,
  exploreAnnuities,
  exploreLoans,
  explorePaymentFrequencies,
  exploreRates,
} from '../cred-engine.js';

const BASE = {
  loan: 100_000,
  interestRate: 0.01,
  monthlyAnnuity: 1_000,
  paymentsPerYear: 12,
  fixedYears: 30,
  followUpRate: 0.01,
  annualFee: 0,
  capAmount: 200_000,
  capRate: 0.01,
  capYears: 0,
};

function scenario(overrides = {}) {
  return buildScenario({ ...BASE, ...overrides });
}

test('matches the original monthly regression anchor', () => {
  const result = scenario({ paymentsPerYear: 12 });
  assert.equal(result.error, null);
  assert.equal(result.complete, true);
  assert.ok(Math.abs(result.totals.payments - 104_457.26) < 0.01);
  assert.ok(Math.abs(result.totals.interest - 4_457.26) < 0.01);
});

test('matches the original semiannual regression anchor', () => {
  const result = scenario({ paymentsPerYear: 2 });
  assert.ok(Math.abs(result.totals.payments - 104_678.17) < 0.01);
});

test('matches the original quarterly regression anchor', () => {
  const result = scenario({ paymentsPerYear: 4 });
  assert.ok(Math.abs(result.totals.payments - 104_544.6) < 0.01);
});

test('matches the original annual regression anchor', () => {
  const result = scenario({ paymentsPerYear: 1 });
  assert.ok(Math.abs(result.totals.payments - 104_946.2) < 0.01);
});

test('yearly rows add up to the period totals', () => {
  const result = scenario();
  const sums = result.yearly.reduce(
    (accumulator, row) => ({
      interest: accumulator.interest + row.interest,
      fees: accumulator.fees + row.fees,
      principal: accumulator.principal + row.principal,
      payments: accumulator.payments + row.payments,
    }),
    { interest: 0, fees: 0, principal: 0, payments: 0 },
  );

  for (const key of Object.keys(sums)) {
    assert.ok(Math.abs(sums[key] - result.totals[key]) < 0.0001, key);
  }
});

test('the final payment never exceeds the remaining debt plus interest and fees', () => {
  const result = scenario({
    loan: 10_000,
    monthlyAnnuity: 3_000,
    annualFee: 120,
  });
  const last = result.payments.at(-1);

  assert.equal(result.complete, true);
  assert.equal(last.remainingDebt, 0);
  assert.ok(last.principal <= 10_000);
  assert.ok(last.payment <= (3_000 * 12) / 12 + 0.0001);
});

test('a rate below the interest is reported as compound interest', () => {
  const result = scenario({ monthlyAnnuity: 10 });

  assert.equal(result.compound, true);
  assert.equal(result.complete, false);
  assert.equal(result.payments.length, 1);
  assert.match(result.reason, /Zinsen und Gebühren/);
});

test('a rate exactly covering interest is not amortized', () => {
  const result = scenario({ monthlyAnnuity: 100_000 * 0.01 / 12 });

  assert.equal(result.compound, true);
  assert.equal(result.complete, false);
  assert.equal(result.payments.length, 1);
});

test('a schedule that cannot finish within 100 years is stopped', () => {
  const result = scenario({ monthlyAnnuity: 84 });

  assert.equal(result.complete, false);
  assert.equal(result.compound, false);
  assert.equal(result.payments.length, MAX_YEARS * 12);
  assert.match(result.reason, /100 Jahren/);
});

test('the interest cap lowers interest only while it is active', () => {
  const withoutCap = scenario({ capYears: 0 });
  const withCap = scenario({
    capAmount: 50_000,
    capRate: 0,
    capYears: 5,
  });
  const longCap = scenario({
    capAmount: 50_000,
    capRate: 0,
    capYears: MAX_YEARS,
  });

  assert.ok(withCap.totals.interest < withoutCap.totals.interest);
  assert.ok(longCap.totals.interest < withCap.totals.interest);
  assert.equal(withCap.yearly.filter((row) => row.capApplied).length, 5);
});

test('the follow-up rate starts after the fixed period', () => {
  const result = scenario({
    fixedYears: 1,
    followUpRate: 0.1,
    monthlyAnnuity: 2_000,
  });
  const firstYear = result.payments.find((payment) => payment.year === 1);
  const secondYear = result.payments.find((payment) => payment.year === 2);

  assert.equal(firstYear.annualRate, 0.01);
  assert.equal(secondYear.annualRate, 0.1);
  assert.equal(result.yearly[0].isFixedRateChange, false);
  assert.equal(result.yearly[1].isFixedRateChange, true);
});

test('payment frequency changes the installment amount', () => {
  const result = scenario({ paymentsPerYear: 1 });
  assert.equal(result.paymentAmount, 12_000);
  assert.equal(result.payments[0].payment, 12_000);
});

test('rejects invalid inputs instead of returning NaN values', () => {
  assert.ok(scenario({ loan: 0 }).error);
  assert.ok(scenario({ loan: -1 }).error);
  assert.ok(scenario({ monthlyAnnuity: 0 }).error);
  assert.ok(scenario({ interestRate: -0.01 }).error);
  assert.ok(scenario({ paymentsPerYear: 0 }).error);
});

test('explorations are sorted and include the current values', () => {
  const annuityValues = exploreAnnuities(BASE).map((row) => row.value);
  const loanValues = exploreLoans(BASE).map((row) => row.value);
  const rateValues = exploreRates(BASE).map((row) => row.value);

  for (const values of [annuityValues, loanValues, rateValues]) {
    assert.deepEqual(values, [...values].sort((left, right) => left - right));
  }

  assert.ok(annuityValues.includes(1_000));
  assert.ok(loanValues.includes(100_000));
  assert.ok(rateValues.some((value) => Math.abs(value - 0.01) < 1e-9));
  assert.equal(explorePaymentFrequencies(BASE).length, 4);
});

test('the rate exploration varies the rate that applies first', () => {
  const fixedRows = exploreRates({ ...BASE, followUpRate: 0.05 });
  assert.ok(fixedRows.length > 0);
  for (const row of fixedRows) {
    assert.equal(row.scenario.input.followUpRate, 0.05);
    assert.equal(row.scenario.input.interestRate, row.value);
  }

  const variableRows = exploreRates({
    ...BASE,
    fixedYears: 0,
    interestRate: 0.01,
    followUpRate: 0.05,
  });
  assert.ok(variableRows.length > 0);
  for (const row of variableRows) {
    assert.equal(row.scenario.input.interestRate, 0.01);
    assert.equal(row.scenario.input.followUpRate, row.value);
  }
});

test('an off-grid current value is still shown in the exploration', () => {
  const annuityValues = exploreAnnuities({
    ...BASE,
    monthlyAnnuity: 1_050,
  }).map((row) => row.value);
  const rateValues = exploreRates({
    ...BASE,
    interestRate: 0.01005,
  }).map((row) => row.value);

  assert.ok(annuityValues.includes(1_050));
  assert.ok(rateValues.some((value) => Math.abs(value - 0.01005) < 1e-9));
});
