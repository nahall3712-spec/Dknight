export function toDecimalFromAmerican(american) {
  if (american === 0) throw new Error("American odds cannot be 0");
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

function validateStake(stakeCents) {
  if (!Number.isInteger(stakeCents) || stakeCents < 0) {
    throw new Error(`Invalid stakeCents: ${stakeCents}`);
  }
}

function computeEvenPool(participantIds, winnerIds, stakeCents) {
  const totals = Object.fromEntries(participantIds.map((id) => [id, 0]));
  const winnerSet = new Set(winnerIds);
  const loserIds = participantIds.filter((id) => !winnerSet.has(id));

  const losersPool = loserIds.length * stakeCents;
  for (const loserId of loserIds) totals[loserId] -= stakeCents;

  if (winnerIds.length === 0) return totals;

  let distributed = 0;
  for (let i = 0; i < winnerIds.length; i++) {
    const id = winnerIds[i];
    const amount =
      i === winnerIds.length - 1
        ? losersPool - distributed
        : Math.floor(losersPool / winnerIds.length);
    totals[id] += amount;
    distributed += amount;
  }

  return totals;
}

function computeFixedOdds(participantIds, winnerIds, stakeCents, oddsByParticipant, kind) {
  const totals = Object.fromEntries(participantIds.map((id) => [id, 0]));
  const winnerSet = new Set(winnerIds);

  for (const id of participantIds) {
    if (winnerSet.has(id)) {
      const raw = oddsByParticipant[id];
      if (raw === undefined) throw new Error(`Missing ${kind} odds for winner ${id}`);
      const dec = kind === "american" ? toDecimalFromAmerican(raw) : raw;
      totals[id] += Math.round(stakeCents * (dec - 1));
    } else {
      totals[id] -= stakeCents;
    }
  }

  return totals;
}

function computeEventPointsMarket(participantIds, winnerIds, stakeCents) {
  const totals = Object.fromEntries(participantIds.map((id) => [id, 0]));
  const winnerSet = new Set(winnerIds);
  for (const id of participantIds) if (!winnerSet.has(id)) totals[id] -= stakeCents;
  return totals;
}

function addTotals(acc, delta) {
  for (const [id, amount] of Object.entries(delta)) {
    acc[id] = (acc[id] ?? 0) + amount;
  }
}

export function minimizeObligations(participantTotals) {
  const creditors = Object.entries(participantTotals)
    .filter(([, net]) => net > 0)
    .map(([id, amount]) => ({ id, amount }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = Object.entries(participantTotals)
    .filter(([, net]) => net < 0)
    .map(([id, amount]) => ({ id, amount: -amount }))
    .sort((a, b) => b.amount - a.amount);

  const obligations = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const payment = Math.min(debtors[i].amount, creditors[j].amount);
    obligations.push({ fromId: debtors[i].id, toId: creditors[j].id, amountCents: payment });

    debtors[i].amount -= payment;
    creditors[j].amount -= payment;

    if (debtors[i].amount === 0) i += 1;
    if (creditors[j].amount === 0) j += 1;
  }

  return obligations;
}

/**
 * @param {{
 * participantIds:string[],
 * tiePolicy:'split'|'multiple_winners'|'tiebreaker_required',
 * tiebreakerMarketIds?:string[],
 * markets:Array<{
 * marketId:string,
 * oddsType:'even_pool'|'decimal'|'american'|'winner_take_all_event_points',
 * stakeCents:number,
 * participants:string[],
 * winnerIds:string[],
 * oddsByParticipant?:Record<string,number>
 * }>
 * }} input
 */
export function settleEvent(input) {
  const participantTotals = Object.fromEntries(input.participantIds.map((id) => [id, 0]));

  for (const market of input.markets) {
    validateStake(market.stakeCents);
    let marketTotals;

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
        throw new Error(`Unsupported odds type: ${market.oddsType}`);
    }

    addTotals(participantTotals, marketTotals);
  }

  return {
    participantTotals,
    obligations: minimizeObligations(participantTotals),
  };
}
