# Online fee payments (PhonePe) — how it works and how to set it up

PhonePe **Standard Checkout (PG v2)** is the only payment gateway (website and Android app). The previous gateway
(Razorpay) was removed completely; its historical receipts and order records stay in MongoDB untouched.

**The rule:** a fee becomes PAID only after the school server has called PhonePe's **Order Status API** itself and
PhonePe says the order the server created for that student is **COMPLETED for exactly the stored amount**. The
PayPage callback, a redirect back to the site, a pending payment or a webhook body can never clear a fee.

## Lifecycle (`payment_orders`, `gateway: 'PHONEPE'`)

| Status | Meaning | Fee |
|---|---|---|
| `INITIATED` | Server created the order and PhonePe's PayPage; not finished | unpaid |
| `PENDING` | A payment attempt is still processing at PhonePe / the bank | unpaid |
| `SUCCESS` | PhonePe Order Status = COMPLETED, exact amount; receipt issued | **paid** |
| `FAILED` | PhonePe ended the order as failed | unpaid |
| `CANCELLED` | Payer closed the PayPage and PhonePe has nothing completed | unpaid |
| `EXPIRED` | Not paid within 30 minutes (`expireAfter` = 1800 s) | unpaid |
| `REFUNDED` | Refund completed through PhonePe (receipt kept, flagged for the office) | as booked |

`SUCCESS` can only become `REFUNDED`. A late confirmation can still move `CANCELLED`/`EXPIRED`/`FAILED` to `SUCCESS`
(money PhonePe confirmed is never lost). A pending attempt that later fails moves `PENDING` back to `INITIATED`.

## Flow

1. Parent/student picks a child and a bill (or "Pay full"):
   `POST /api/payments/phonepe/create-order` `{ ledgerId, studentId [, amount] }` or `{ studentId, payAll: true }`,
   plus `channel: 'web' | 'app'`.
   - RBAC: the parent must be linked to the child, a student can only pay their own fees, staff need `fees.collect`.
   - The amount comes from the server's ledger (paise). `amount` can only *lower* a single-bill payment (₹1 … due).
   - If a payment for any of these bills is `PENDING`, the answer is **409** (no double payment). 30 starts/min/user.
   - The server makes a unique `merchantOrderId` (`CPS-<time>-<random>`, PhonePe rules: ≤63 chars, `A-Z a-z 0-9 _ -`),
     stores the order (`INITIATED`), then calls PhonePe `POST /checkout/v2/pay` (`PG_CHECKOUT`, `expireAfter` 1800,
     `metaInfo.udf1-3` = student, admission no., bill) and returns PhonePe's PayPage URL (`checkoutUrl`).
2. **Website:** PhonePe's `checkout.js` opens the PayPage in an iframe (`PhonePeCheckout.transact({ tokenUrl, type: 'IFRAME', callback })`).
   - `USER_CANCEL` → `POST /orders/:id/cancel` (the server asks PhonePe first; if the money went through it is booked).
   - `CONCLUDED` → the page polls `GET /orders/:id`; only `paymentStatus: SUCCESS` with a receipt shows "Payment successful".
   - If the script cannot load, the browser goes to the PayPage and PhonePe returns it to `/fees?phonepeOrder=<id>`, where the page asks the server.
3. **App:** opens the PayPage in the phone browser. PhonePe returns the browser to
   `/api/payments/phonepe/return?mo=<id>&t=<2-hour token for that order>` (status page; the login token is never in a URL).
   When the app comes back to the foreground, or Fees is reopened (also after the app was killed), it asks the server.
4. **Server verification** (`settleOrder()`, one child at a time): PhonePe `GET /checkout/v2/order/{merchantOrderId}/status?details=true`
   must say `state: COMPLETED`, `amount` = stored amount, with a `COMPLETED` transaction. Then the bill(s) are updated,
   one receipt is made (gateway, merchant order id, PhonePe order id, transaction id, payment mode), and bills, receipt
   and order are written in **one MongoDB transaction** when the cluster supports it (Atlas does); otherwise
   sequential writes guarded by a conditional claim and unique indexes. Never more than what is owed is booked; excess is
   flagged `reconciliationRequired` and audited. A wrong amount is **not** booked (order flagged, audit `PHONEPE_AMOUNT_MISMATCH`).

**Webhook** `POST /api/payments/phonepe/webhook` (raw body):
- Authentication: dashboard type **SHA** — `Authorization` header = SHA256(`username:password`) — or type **HMAC** —
  `x-phonepe-checksum-signature` = HMAC-SHA256 of the raw body with the webhook secret key (hex or base64).
  Anything else → 401 and an audit entry.
- `checkout.order.completed` / `checkout.order.failed` → the server asks the Order Status API and acts on PhonePe's
  answer (the body is never trusted). `pg.refund.completed` / `pg.refund.failed` → the server asks the Refund Status API.
- Repeats are recognised by SHA-256 of the body (`payment_webhook_events`) and acknowledged without doing anything again.
  Processing errors return 500 so PhonePe retries.

**Reconciliation:** `GET /orders/:id`, `GET /orders?studentId=` (last 30 days; open ones re-checked),
`POST /orders/:id/cancel`, the return page and a background sweep every 5 minutes (open orders, refunds in progress).

**Refund:** `POST /api/payments/phonepe/orders/:id/refund` `{ amount? }` (permission `fees.refund`) → PhonePe
`POST /payments/v2/refund`. When PhonePe completes it the order becomes `REFUNDED` and the receipt is marked
`refundStatus: REFUNDED`; the fee ledger is not changed automatically (the office uses Fees → Refund if the fee should be owed again).

**Indexes** (created at start-up, existing data never modified; duplicates are only logged):
`payment_orders.orderId` (unique), `payment_orders.paymentId` (unique when set), `payment_webhook_events.eventId` (unique),
`fee_payments.merchantOrderId` (unique when set).

## Environment variables (server only)

```
PHONEPE_ENV=sandbox                     # or production
PHONEPE_SANDBOX_CLIENT_ID=…             # PhonePe Business Dashboard (Test Mode ON) → Developer Settings → API Keys
PHONEPE_SANDBOX_CLIENT_SECRET=…
PHONEPE_SANDBOX_CLIENT_VERSION=1
PHONEPE_SANDBOX_WEBHOOK_USERNAME=…      # webhook "SHA" authentication
PHONEPE_SANDBOX_WEBHOOK_PASSWORD=…
# PHONEPE_SANDBOX_WEBHOOK_HMAC_SECRET=… # or webhook "HMAC" authentication
PHONEPE_PROD_CLIENT_ID=…                # Test Mode OFF
PHONEPE_PROD_CLIENT_SECRET=…
PHONEPE_PROD_CLIENT_VERSION=1
PHONEPE_PROD_WEBHOOK_USERNAME=…
PHONEPE_PROD_WEBHOOK_PASSWORD=…
# PHONEPE_RETURN_BASE_URL=https://your-school-domain.example   (optional; else PUBLIC_SITE_URL, else the request host)
```
`PHONEPE_CLIENT_ID` etc. without `SANDBOX_`/`PROD_` also work for the active environment. Sandbox talks to
`api-preprod.phonepe.com/apis/pg-sandbox`, production to `api.phonepe.com/apis/identity-manager` (token) and
`api.phonepe.com/apis/pg`. `PHONEPE_TEST_API_URL` is for local tests only and is ignored unless it is a loopback address.
Remove all `RAZORPAY_*` lines from the server's `.env`; they are no longer read.

## PhonePe Business Dashboard → Developer Settings → Webhook (once with Test Mode ON, once with it OFF)

* Create Webhook → URL: `https://your-school-domain.example/api/payments/phonepe/webhook`
* Authentication: **SHA** with a username and a long random password (same values in `.env`), or **HMAC** (copy the generated secret into `.env`)
* Events: `checkout.order.completed`, `checkout.order.failed`, `pg.refund.completed`, `pg.refund.failed`
* The URL must be HTTPS. If the server firewall limits inbound traffic, allow PhonePe's webhook IPs from their docs.

## Tests

* `npm run verify:payment-rules` — offline: lifecycle, completion check, expiry, lock, webhook SHA/HMAC.
* `npm run verify:phonepe-api` — 65 checks against a local server and a fake PhonePe: success, failed, cancelled,
  closed browser/app, pending + double-payment block, wrong amount, webhook auth (SHA/HMAC/none/wrong), lost callback,
  fake webhook body, simultaneous webhook + status, reconciliation, partial + full, refund, receipt PDF, persistence, audit.
* `npm run verify:fee-settlement` — allocation and the receipt PDF.
