import { test } from "node:test";
import assert from "node:assert/strict";
import { learnableKey, merchantKey } from "@/lib/merchant-key";

test("el mismo comercio aunque venga con el procesador de pago adelante", () => {
  assert.equal(merchantKey("MERPAGO*PANALAURITA"), "panalaurita");
  assert.equal(merchantKey("Panalaurita"), "panalaurita");
  assert.equal(merchantKey("DLO*RAPPI"), "rappi");
  assert.equal(merchantKey("PROPINA*RAPPI"), "rappi");
  assert.equal(merchantKey("CEN*LIBRERIA PELUF"), "libreria peluf");
  assert.equal(merchantKey("Café Martínez"), "cafe martinez");
});

test("la cuota no es parte del comercio", () => {
  assert.equal(merchantKey("Heladera (cuota 2/3)"), "heladera");
  assert.equal(merchantKey("Heladera cuota 2 de 3"), "heladera");
});

test("no se aprenden nombres genéricos", () => {
  assert.equal(learnableKey(merchantKey("Varios")), false);
  assert.equal(learnableKey(merchantKey("Pago")), false);
  assert.equal(learnableKey(merchantKey("12345")), false);
  assert.equal(learnableKey(merchantKey("x")), false);
  assert.equal(learnableKey(merchantKey("Panalaurita")), true);
});
