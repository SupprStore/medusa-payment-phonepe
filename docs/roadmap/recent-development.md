# Recent Development (Parent/Child Issues)

**Parent Issue:** PhonePe Provider Integration Hardening (2026-02-05)

**Children**
1. Issue 1 — SDK credential alignment and options migration. Commit: `55868a9`.
2. Issue 2 — Implement missing provider methods and status mapping. Commit: `8df4658`.
3. Issue 3 — Add `metaInfo` enrichment and amount validation. Commit: `a7f8ec8`.
4. Issue 4 — Add refund status support and stable refund IDs. Commit: `40ccefa`.
5. Issue 5 — Use SDK `validateCallback` for webhooks with legacy fallback. Commit: `b3153a8`.
6. Issue 6 — Add Create SDK Order support for mobile flows. Commit: `0f51221`.
7. Issue 7 — Retry strategy and PhonePe error normalization. Commit: `7e4fa98`.
8. Issue 8 — Expand tests and update documentation for new options. Commit: `898e09d`.
9. Follow-up — Fix smallest-unit parsing for amount conversion. Commit: `cb61e0f`.
10. Cleanup — Remove unused import. Commit: `e58e134`.

**Checks**
1. `npm test` (passes; ts-jest warns about `isolatedModules`)
2. `npm run build`
