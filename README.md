# Wager with Friends

Monorepo foundation for **Wager with friends**:

- iPhone app (SwiftUI, iOS 17+)
- Web Admin Dashboard (Next.js + Firebase)
- Firebase backend (Auth, Firestore, Cloud Functions, FCM)

> Critical rule: this project tracks obligations only. It does **not** collect, hold, transfer, or process real money.

## Repository Layout

- `apps/ios/` – iOS app scaffold notes + feature map
- `apps/web/` – Next.js admin dashboard scaffold notes
- `functions/` – Cloud Functions TypeScript implementation (settlement engine)
- `firebase/` – Firestore schema and security rules starter
- `docs/` – product, domain, and API notes

## Quick Start

```bash
npm install
npm test
```

## Status

This commit bootstraps domain models and a production-ready settlement core with tests, intended to be integrated into Firebase triggers / callable functions and front-end clients.
