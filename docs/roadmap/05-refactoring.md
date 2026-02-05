# Refactoring Needed

- **Options schema**: Rename and deprecate old config keys; add migration notes.
- **Strong typing**: Replace `any` inputs/outputs with SDK request/response types to reduce runtime mistakes.
- **ID generation**: Use stable IDs (e.g., Medusa payment/refund IDs or UUIDs) instead of timestamps to support idempotency and retries.
- **Provider separation**: Move request-building and response-mapping to a dedicated mapper layer for testability.
