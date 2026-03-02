import { describe, expect, it } from "vitest";
import { settleEvent } from "../src/settlement.js";

describe("settleEvent", () => {
  it("computes even_pool distribution and minimized obligations", () => {
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

    expect(result.participantTotals).toEqual({ a: 2000, b: -1000, c: -1000 });
    expect(result.obligations).toEqual([
      { fromId: "b", toId: "a", amountCents: 1000 },
      { fromId: "c", toId: "a", amountCents: 1000 },
    ]);
  });

  it("computes decimal odds payouts", () => {
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
      ],
    });

    expect(result.participantTotals).toEqual({ a: 800, b: -1000 });
  });

  it("computes american odds payouts", () => {
    const result = settleEvent({
      participantIds: ["a", "b"],
      tiePolicy: "split",
      markets: [
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

    expect(result.participantTotals).toEqual({ a: -1000, b: 1500 });
  });
});
