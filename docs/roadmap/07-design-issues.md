# Design Pattern Issues

- **Implicit behavior**: Mitigated by preventing `updatePayment()` from re-initiating when a `merchantOrderId` already exists.
- **Tight coupling to SDK**: Mitigated by introducing a mapper layer (`PhonePeMapper`) to centralize request building and status mapping.
- **Status mapping ambiguity**: Mitigated by removing the undocumented “On Progress” state and using a single status mapper.
