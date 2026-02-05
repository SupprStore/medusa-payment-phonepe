# Refactoring Needed

- **Options schema**: Implemented SDK-aligned options with legacy fallback; warnings and README migration notes added.
- **Strong typing**: Introduced operation input types and reduced `any` usage in operations.
- **ID generation**: Implemented UUID-based fallbacks and idempotency key use for stable IDs.
- **Provider separation**: Implemented mapper layer for request building and status mapping.
