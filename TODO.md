# TODO - Telegram/SMS channels, RBAC, Multi-tenant/white-label

- [x] Step 1: Inspect existing webhook routing and settings usage for channels (find relevant Next.js API routes and channel modules)

- [x] Step 2: Update Prisma schema to enforce tenant isolation (add `tenantId` where needed across tenant-owned models)

- [x] Step 3: Add tenant-aware Prisma helpers/utilities to centralize tenant-scoped queries

- [ ] Step 4: Extend RBAC middleware AuthContext to include tenantId and enforce tenant match at authorization boundaries

- [ ] Step 5: Add Telegram channel module (webhook verify + handler + outbound send) using tenant-scoped settings and conversation creation
- [ ] Step 6: Add SMS channel module (inbound webhook + outbound send) using tenant-scoped Twilio settings
- [ ] Step 7: Wire Next.js webhook routes for Telegram and SMS; ensure signature/verification where applicable
- [ ] Step 8: Update Instagram channel module to use tenant-scoped settings and tenant-scoped conversation/customer logic
- [ ] Step 9: Add/adjust permissions (RBAC) for channel setup and webhook management if missing
- [ ] Step 10: Create/update migrations and run `prisma generate`
- [ ] Step 11: Run tests/lint/build; validate webhook flows with local endpoints

