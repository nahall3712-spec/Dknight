import test from "node:test";
import assert from "node:assert/strict";
import { settleEvent, toDecimalFromAmerican } from "../src/settlement.js";

test("converts american odds", () => {
  assert.equal(toDecimalFromAmerican(150), 2.5);
  assert.equal(toDecimalFromAmerican(-120), 1 + 100 / 120);
});

test("computes even pool obligations", () => {
  const result = settleEvent({
    participantIds: ["a", "b", "c"],
    tiePolicy: "split",
    markets: [
      {
        marketId: "m1",
        oddsType: "even_pool",
        stakeCents: 1000,
        participants: ["a", "b", "c"],
        winnerIds: ["a"],
      },
    ],
  });

  assert.deepEqual(result.participantTotals, { a: 2000, b: -1000, c: -1000 });
  assert.deepEqual(result.obligations, [
    { fromId: "b", toId: "a", amountCents: 1000 },
    { fromId: "c", toId: "a", amountCents: 1000 },
  ]);
});

test("computes decimal and american mixed markets", () => {
  const result = settleEvent({
    participantIds: ["a", "b"],
    tiePolicy: "split",
    markets: [
      {
        marketId: "m2",
        oddsType: "decimal",
        stakeCents: 1000,
        participants: ["a", "b"],
        winnerIds: ["a"],
        oddsByParticipant: { a: 1.8 },
      },
      {
        marketId: "m3",
        oddsType: "american",
        stakeCents: 1000,
        participants: ["a", "b"],
        winnerIds: ["b"],
        oddsByParticipant: { b: 150 },
      },
    ],
  });

  assert.deepEqual(result.participantTotals, { a: -200, b: 500 });
  assert.deepEqual(result.obligations, [{ fromId: "a", toId: "b", amountCents: 200 }]);
});
