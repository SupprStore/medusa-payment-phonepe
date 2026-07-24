# Medusa PhonePe Payment Provider

This is a PhonePe payment provider module for Medusa v2.

## Installation

### From npm (if published)
```bash
yarn add medusa-payment-phonepe
```

### Local Development
1. Run `yarn build` in this directory.
2. Run `yarn link` in this directory.
3. In your Medusa backend directory, run `yarn link medusa-payment-phonepe`.


## Configuration

In `medusa-config.ts`:

```typescript
module.exports = defineConfig({
  projectConfig: {
    // ...
  },
  modules: [
    {
      resolve: "@medusajs/payment",
      options: {
        providers: [
          {
            resolve: "medusa-payment-phonepe",
            id: "phonepe",
            options: {
              clientId: process.env.PHONEPE_CLIENT_ID,
              clientSecret: process.env.PHONEPE_CLIENT_SECRET,
              clientVersion: Number(process.env.PHONEPE_CLIENT_VERSION),
              mode: process.env.PHONEPE_MODE, // "uat" or "prod"
              redirectUrl: process.env.PHONEPE_REDIRECT_URL,
              callbackUrl: process.env.PHONEPE_CALLBACK_URL,
              callbackUsername: process.env.PHONEPE_CALLBACK_USERNAME,
              callbackPassword: process.env.PHONEPE_CALLBACK_PASSWORD,
            },
          },
        ],
      },
    },
  ],
})

## Webhooks
To handle asynchronous payment updates (like when a user closes the browser after payment), configure a callback URL and a username/password pair on the [PhonePe Merchant Dashboard](https://developer.phonepe.com/), then set the same `callbackUsername`/`callbackPassword` here. The provider verifies incoming callbacks via the SDK's `client.validateCallback(...)`, which checks the `Authorization` header against those credentials.

```

## Environment Variables

```bash
PHONEPE_CLIENT_ID=your_client_id
PHONEPE_CLIENT_SECRET=your_client_secret
PHONEPE_CLIENT_VERSION=1
PHONEPE_MODE=uat
PHONEPE_REDIRECT_URL=http://localhost:8000/payment/callback
PHONEPE_CALLBACK_URL=http://localhost:9000/hooks/payment/phonepe
PHONEPE_CALLBACK_USERNAME=your_dashboard_configured_username
PHONEPE_CALLBACK_PASSWORD=your_dashboard_configured_password
```

## Migrating from an older version

If you were previously using `merchantId`/`saltKey`/`saltIndex`, PhonePe's Node SDK v2 requires
different, separately-issued credentials: `clientId`, `clientSecret`, and `clientVersion`. Get
these from the PhonePe Merchant Dashboard and update your `medusa-config.ts` and environment
variables accordingly — the old salt-based credentials will not work with this provider.

## Reliability

Transient failures (5xx responses, rate limiting, network/timeout errors) from PhonePe are
retried automatically with exponential backoff. `pay`/`refund` calls are safe to retry because
they're keyed off the Medusa payment session id, so a retry lands on the same order rather than
creating a duplicate. Deterministic client errors (bad request, auth failures, etc.) are not
retried. If retries are exhausted, the error surfaced to Medusa is the underlying
`PhonePeException`, so you get PhonePe's real `type`/`code`/`httpStatusCode` in your logs instead
of a generic message.

## Refund reconciliation

Refunds are processed asynchronously by PhonePe, so a refund can stay in a pending state for a
while after `refundPayment` returns. This package doesn't ship a scheduled job for polling
refunds — Medusa only discovers scheduled jobs from your own app's `src/jobs` directory (not from
installed npm packages, which is also why official Medusa-maintained payment providers like
`@medusajs/payment-stripe` don't ship one either). Medusa also doesn't expose a way to pull the
live, registered provider instance back out of the payment module from application code (provider
instances live in the payment module's own internal container), so the job constructs its own
PhonePe client directly using the same config options, rather than going through the payment
module. Add a small job in your own Medusa app:

```typescript
// src/jobs/phonepe-refund-reconciliation.ts
import { MedusaContainer } from "@medusajs/framework/types"
import { PhonePeClientWrapper } from "medusa-payment-phonepe"

export default async function phonePeRefundReconciliationJob(container: MedusaContainer) {
  const client = new PhonePeClientWrapper({
    clientId: process.env.PHONEPE_CLIENT_ID!,
    clientSecret: process.env.PHONEPE_CLIENT_SECRET!,
    clientVersion: Number(process.env.PHONEPE_CLIENT_VERSION),
    mode: process.env.PHONEPE_MODE as "uat" | "prod",
    redirectUrl: process.env.PHONEPE_REDIRECT_URL!,
    callbackUsername: process.env.PHONEPE_CALLBACK_USERNAME!,
    callbackPassword: process.env.PHONEPE_CALLBACK_PASSWORD!,
  })

  // Fetch your own record of pending refunds (e.g. from a custom table, or Medusa's refund list
  // filtered by a "pending" marker you set when initiating the refund) and, for each one:
  const refundStatus = await client.getRefundStatus(refundId)
  // ...update your records based on refundStatus.state
}

export const config = {
  name: "phonepe-refund-reconciliation",
  schedule: "*/15 * * * *", // every 15 minutes
}
```

## Mobile SDK orders

For a native mobile app using PhonePe's mobile SDK (rather than the web redirect flow), create an
order token via `createSdkOrder` and hand it to the mobile client. This isn't part of Medusa's
standard payment-provider interface, and — same reasoning as above — there's no supported way to
reach into the payment module for the live provider instance, so a custom route constructs
`PaymentOperations` directly with the same config:

```typescript
// src/api/store/phonepe/sdk-order/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PhonePeClientWrapper, PaymentOperations } from "medusa-payment-phonepe"

const options = {
  clientId: process.env.PHONEPE_CLIENT_ID!,
  clientSecret: process.env.PHONEPE_CLIENT_SECRET!,
  clientVersion: Number(process.env.PHONEPE_CLIENT_VERSION),
  mode: process.env.PHONEPE_MODE as "uat" | "prod",
  redirectUrl: process.env.PHONEPE_REDIRECT_URL!,
  callbackUsername: process.env.PHONEPE_CALLBACK_USERNAME!,
  callbackPassword: process.env.PHONEPE_CALLBACK_PASSWORD!,
}
const paymentOperations = new PaymentOperations(new PhonePeClientWrapper(options), options)

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // `session_id` must be the id of a payment session already created via Medusa's normal
  // payment-collection flow, so status updates/webhooks resolve to the right session.
  const { session_id, amount, currency_code } = req.body as {
    session_id: string
    amount: number
    currency_code: string
  }

  const { token, orderId } = await paymentOperations.createSdkOrder({
    amount,
    currency_code,
    data: { session_id },
  })

  res.json({ token, orderId })
}
```
