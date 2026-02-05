# Necessary Code Updates

1. **Credential model alignment**: Implemented with `clientId/clientSecret/clientVersion`, legacy keys supported with warnings.
2. **Client initialization**: Implemented singleton client reuse with config signature guard.
3. **Initiate payment request**: Implemented amount validation (paisa, min 100) and `metaInfo` mapping.
4. **Webhook validation**: Implemented SDK `validateCallback` with auth headers and optional API verification.
5. **Refund flow**: Implemented stable refund IDs and `getRefundStatus(refundId)` support.
6. **Order status**: Implemented centralized status mapping via mapper.
7. **Provider methods**: Implemented explicit behaviors for `retrieve/delete/capture/cancel`.
8. **Data enrichment**: Implemented customer/session `metaInfo`.
9. **Error handling**: Implemented retry + normalized error surfaces.
