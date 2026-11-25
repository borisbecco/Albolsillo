import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, maskAmountInput, parseAmount, toDecimal, toInput } from "@/lib/money";

test("parseAmount lee el formato argentino", () => {
  assert.equal(parseAmount("1.150.668"), 1150668);
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("21"), 21);
  assert.equal(parseAmount(""), 0);
  assert.equal(parseAmount("abc"), 0);
});

test("maskAmountInput agrega puntos de miles y limita decimales", () => {
  assert.equal(maskAmountInput("1150668"), "1.150.668");
  assert.equal(maskAmountInput("1.150.668"), "1.150.668");
  assert.equal(maskAmountInput("191778,505"), "191.778,50");
  assert.equal(maskAmountInput("0005"), "5");
  assert.equal(maskAmountInput(",5"), "0,5");
  assert.equal(maskAmountInput("$ 12a3"), "123");
});

test("ida y vuelta entre la API y el campo", () => {
  assert.equal(toDecimal(parseAmount("191.778")), "191778.00");
  assert.equal(toInput("1150668.00"), "1.150.668");
  assert.equal(toInput("1234.5"), "1.234,5");
});

test("formatMoney", () => {
  assert.equal(formatMoney(1500000, "ARS"), "$ 1.500.000");
  assert.equal(formatMoney(500, "USD"), "US$ 500");
  assert.equal(formatMoney(-2500, "ARS"), "−$ 2.500");
});
