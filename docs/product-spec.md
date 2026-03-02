# Product Specification

## Core Concept
Wager events between friends where obligations are tracked after results are entered. No payments are processed in-app.

## Roles
- Creator (host): full event control
- Admin: operational controls (results, lock, moderation)
- Participant: join, bet before lock, chat, view outcomes
- Banned: blocked from event access

## Event Lifecycle
`draft -> open -> locked -> settled -> archived`

## Tie Policies
- `split`
- `multiple_winners`
- `tiebreaker_required`

## Settlement Output
At settlement, store:
- participant totals (`netCents`)
- minimized obligations (`fromId -> toId -> amountCents`)
