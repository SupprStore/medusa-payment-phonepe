# Roadmap

## Phase 0 — SDK Alignment (P0)
- Update configuration to SDK-aligned credentials (`clientId`, `clientSecret`, `clientVersion`, `env`).
- Adjust `PhonePeClientWrapper` to match SDK initialization signature.
- Add migration notes to README.

## Phase 1 — Core Flow Correctness (P0/P1)
- Enforce amount rules (paisa integer, min 100) and merchant order ID constraints.
- Add metaInfo mapping for Medusa payment/session data.
- Normalize status mappings to SDK `PENDING/FAILED/COMPLETED`.
- Implement missing provider methods with explicit behavior and documentation.

## Phase 2 — Webhooks & Security (P1)
- Implement SDK `validateCallback` verification using Authorization header and callback credentials.
- Validate callback data against known Medusa order IDs/amounts before marking authorized/failed.
- Add observability logs with sanitized error details.

## Phase 3 — Extended Capabilities (P1)
- Implement Create SDK Order flow for mobile SDK (optional, behind feature flag).
- Implement refund status polling and reconciliation.

## Phase 4 — Reliability & DX (P2)
- Introduce idempotent IDs for payment/refund requests.
- Add structured errors based on `PhonePeException`.
- Expand test coverage for webhook verification, refund status, and error handling.
- Add negative and edge-case tests for `retrieve/cancel/delete/capture` methods.
