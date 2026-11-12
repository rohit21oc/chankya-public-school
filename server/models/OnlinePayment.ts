import mongoose, { Schema } from 'mongoose';

/**
 * One online-payment order the server created for a student's fees (PhonePe merchantOrderId; older documents
 * from the previous gateway are kept as they are), and its lifecycle
 * (INITIATED → PENDING → SUCCESS / FAILED / CANCELLED / EXPIRED → REFUNDED).
 * The order id and the settling payment id are unique, so the same payment can never be booked twice.
 */
const PaymentOrderSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    gateway: { type: String, index: true },
    orderId: { type: String, required: true, unique: true },
    gatewayOrderId: { type: String },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String },
    payAll: { type: Boolean, default: false },
    ledgerIds: [{ type: String }],
    amountPaise: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      required: true,
      enum: ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'],
      index: true,
    },
    paymentId: { type: String },
    paymentMode: { type: String },
    receiptNumber: { type: String },
    refund: Schema.Types.Mixed,
    paidPaise: { type: Number },
    appliedPaise: { type: Number },
    unappliedPaise: { type: Number },
    reconciliationRequired: { type: Boolean, default: false },
    reconciliationNote: { type: String },
    verifiedVia: { type: String },
    attempts: [Schema.Types.Mixed],
    history: [Schema.Types.Mixed],
    createdBy: Schema.Types.Mixed,
    expiresAt: { type: String },
    lastReconciledAt: { type: String },
    legacy: { type: Boolean },
  },
  { timestamps: { createdAt: 'dbCreatedAt', updatedAt: 'dbUpdatedAt' }, collection: 'payment_orders', strict: false }
);
PaymentOrderSchema.index(
  { paymentId: 1 },
  { unique: true, partialFilterExpression: { paymentId: { $type: 'string' } }, name: 'uniq_settled_payment' }
);
PaymentOrderSchema.index({ status: 1, createdAt: 1 });

/** Every authenticated PhonePe webhook delivery, keyed by a hash of its body, so repeats are processed once. */
const PaymentWebhookEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true },
    event: { type: String },
    orderId: { type: String, index: true },
    paymentId: { type: String },
    outcome: { type: String },
    receivedAt: { type: String },
    processedAt: { type: String },
  },
  { collection: 'payment_webhook_events', strict: false }
);

export const PaymentOrderModel: mongoose.Model<any> =
  mongoose.models.PaymentOrder || mongoose.model('PaymentOrder', PaymentOrderSchema);
export const PaymentWebhookEventModel: mongoose.Model<any> =
  mongoose.models.PaymentWebhookEvent || mongoose.model('PaymentWebhookEvent', PaymentWebhookEventSchema);
