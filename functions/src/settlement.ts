export type TiePolicy = "split" | "multiple_winners" | "tiebreaker_required";

export type OddsType =
  | "even_pool"
  | "decimal"
  | "american"
  | "winner_take_all_event_points";

export interface MarketSettlementInput {
  marketId: string;
  oddsType: OddsType;
  stakeCents: number;
  participants: string[];
  winnerIds: string[];
  oddsByParticipant?: Record<string, number>;
  pointsByParticipant?: Record<string, number>;
}

export interface EventSettlementInput {
  participantIds: string[];
  markets: MarketSettlementInput[];
  tiePolicy: TiePolicy;
  tiebreakerMarketIds?: string[];
}

export interface Obligation {
  fromId: string;
  toId: string;
  amountCents: number;
}

export interface EventSettlementResult {
  participantTotals: Record<string, number>;
  obligations: Obligation[];
}

function validateStake(stakeCents: number): void {
  if (!Number.isInteger(stakeCents) || stakeCents < 0) {
    throw new Error(`Invalid stakeCents: ${stakeCents}`);
  }
}

function toDecimalFromAmerican(american: number): number {
  if (american === 0) throw new Error("American odds cannot be 0");
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

function computeEvenPool(
  participantIds: string[],
  winnerIds: string[],
  stakeCents: number
): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(participantIds.map((id) => [id, 0]));
  const winnerSet = new Set(winnerIds);
  const loserIds = participantIds.filter((id) => !winnerSet.has(id));

  const losersPool = loserIds.length * stakeCents;
  const winnersStake = winnerIds.length * stakeCents;

  for (const loserId of loserIds) {
    totals[loserId] -= stakeCents;
  }

  if (winnerIds.length === 0) {
    return totals;
  }

  if (winnersStake === 0) {
    return totals;
  }

  let distributed = 0;
  for (let i = 0; i < winnerIds.length; i++) {
    const id = winnerIds[i];
    const amount = i === winnerIds.length - 1 ? losersPool - distributed : Math.floor(losersPool / winnerIds.length);
    totals[id] += amount;
    distributed += amount;
  }

  return totals;
}

function computeFixedOdds(
  participantIds: string[],
  winnerIds: string[],
  stakeCents: number,
  oddsByParticipant: Record<string, number>,
  kind: "decimal" | "american"
): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(participantIds.map((id) => [id, 0]));
  const winnerSet = new Set(winnerIds);

  for (const id of participantIds) {
    if (winnerSet.has(id)) {
      const raw = oddsByParticipant[id];
      if (raw === undefined) {
        throw new Error(`Missing ${kind} odds for winner participant ${id}`);
      }
      const dec = kind === "american" ? toDecimalFromAmerican(raw) : raw;
      const profit = Math.round(stakeCents * (dec - 1));
      totals[id] += profit;
    } else {
      totals[id] -= stakeCents;
    }
  }

  return totals;
}

function computeEventPointsMarket(
  participantIds: string[],
  winnerIds: string[],
  stakeCents: number
): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(participantIds.map((id) => [id, 0]));
  const winnerSet = new Set(winnerIds);
  for (const id of participantIds) {
    if (!winnerSet.has(id)) {
      totals[id] -= stakeCents;
    }
  }
  return totals;
}

function addTotals(acc: Record<string, number>, delta: Record<string, number>) {
  for (const [id, amount] of Object.entries(delta)) {
    acc[id] = (acc[id] ?? 0) + amount;
  }
}

function minimizeObligations(participantTotals: Record<string, number>): Obligation[] {
  const creditors = Object.entries(participantTotals)
    .filter(([, net]) => net > 0)
    .map(([id, net]) => ({ id, amount: net }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = Object.entries(participantTotals)
    .filter(([, net]) => net < 0)
    .map(([id, net]) => ({ id, amount: -net }))
    .sort((a, b) => b.amount - a.amount);

  const obligations: Obligation[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const payment = Math.min(debtors[i].amount, creditors[j].amount);
    obligations.push({
      fromId: debtors[i].id,
      toId: creditors[j].id,
      amountCents: payment,
    });

    debtors[i].amount -= payment;
    creditors[j].amount -= payment;

    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return obligations;
}

export function settleEvent(input: EventSettlementInput): EventSettlementResult {
  const participantTotals: Record<string, number> = Object.fromEntries(
    input.participantIds.map((id) => [id, 0])
  );

  for (const market of input.markets) {
    validateStake(market.stakeCents);

    let marketTotals: Record<string, number>;
    switch (market.oddsType) {
      case "even_pool":
        marketTotals = computeEvenPool(market.participants, market.winnerIds, market.stakeCents);
        break;
      case "decimal":
        marketTotals = computeFixedOdds(
          market.participants,
          market.winnerIds,
          market.stakeCents,
          market.oddsByParticipant ?? {},
          "decimal"
        );
        break;
      case "american":
        marketTotals = computeFixedOdds(
          market.participants,
          market.winnerIds,
          market.stakeCents,
          market.oddsByParticipant ?? {},
          "american"
        );
        break;
      case "winner_take_all_event_points":
        marketTotals = computeEventPointsMarket(
          market.participants,
          market.winnerIds,
          market.stakeCents
        );
        break;
      default:
        throw new Error(`Unsupported oddsType ${(market as { oddsType: string }).oddsType}`);
    }

    addTotals(participantTotals, marketTotals);
  }

  const obligations = minimizeObligations(participantTotals);

  return {
    participantTotals,
    obligations,
  };
}
