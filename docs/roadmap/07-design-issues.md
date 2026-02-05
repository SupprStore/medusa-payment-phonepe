# Design Pattern Issues

- **Implicit behavior**: `updatePayment()` calls `initiatePayment()` without distinguishing update vs create, which may duplicate orders.
- **Tight coupling to SDK**: Business logic and SDK request building are intertwined; harder to test/replace.
- **Status mapping ambiguity**: Uses non-documented status value “On Progress”.
