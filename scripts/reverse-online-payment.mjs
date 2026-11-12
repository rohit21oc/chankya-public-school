/**
 * Reverses ONE online fee payment (PhonePe, or an older gateway's) that should not have been booked — e.g. one recorded by the old app
 * before payments were verified on the server. The bill(s) go back to unpaid / due, and the receipt is removed
 * from the fee records, but NOTHING is lost: the receipt and the bills as they were are copied into backup
 * collections first, and an audit log entry is written.
 *
 *   STOP the app first (the running server keeps fees in memory and would write the old values back):
 *     pm2 stop / kill the node dist/server.cjs process
 *   Look (changes nothing):
 *     node scripts/reverse-online-payment.mjs --adm 64010027
 *   Reverse one receipt:
 *     node scripts/reverse-online-payment.mjs --adm 64010027 --receipt REC-2026-0123 --apply
 *   Reverse EVERY online receipt of the student (cash / counter receipts are never touched):
 *     node scripts/reverse-online-payment.mjs --adm 64010027 --all --apply
 *   The child paid NOTHING at all and the receipt is already gone: put every bill back to fully due
 *   (and move any receipt left over aside):
 *     node scripts/reverse-online-payment.mjs --adm 64010027 --reset-all --apply
 *   Then start the app again.
 *
 * Reads MONGODB_URI from .env (same as the server).
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(`--${name}`); return i !== -1 ? args[i + 1] : undefined; };
const adm = arg('adm');
const receipt = arg('receipt');
const APPLY = args.includes('--apply');
const by = arg('by') || 'Admin (script)';
const reason = arg('reason') || 'Online payment recorded by the old app without server verification — reversed';

if (!adm) { console.error('Usage: node scripts/reverse-online-payment.mjs --adm <admission no> [--receipt REC-... | --all | --reset-all] [--apply]'); process.exit(2); }
// Same connection as the server: quotes around the value are removed and the school database
// (cps_school_erp) is always used, whatever database name the URI itself carries.
const uri = String(process.env.MONGODB_URI || '').trim().replace(/^(['"])(.*)\1$/, '$2').trim();
if (!uri) { console.error('MONGODB_URI is not set (put it in .env).'); process.exit(2); }
const dbName = arg('db') || 'cps_school_erp';

const num = (v) => Number(v) || 0;
const round2 = (v) => Math.round(v * 100) / 100;
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 15000 });
const db = mongoose.connection.db;
console.log(`Database: ${db.databaseName}`);
try {
  const admKey = String(adm).trim();
  const student =
    (await db.collection('students').findOne({ admissionNumber: admKey })) ||
    (await db.collection('students').findOne({ admissionNumber: Number(admKey) })) ||
    (await db.collection('students').findOne({ id: admKey }));
  if (!student) {
    const count = await db.collection('students').countDocuments();
    throw new Error(`No student with admission number ${adm} in database "${db.databaseName}" (${count} students there).`);
  }
  console.log(`Student: ${student.name} — ${student.className}-${student.section} — adm ${student.admissionNumber} (id ${student.id})`);

  // --reset-all: the school confirms this child paid NOTHING (e.g. the receipt was already deleted by hand, so
  // there is nothing to match). Every bill goes back to fully due and every remaining receipt of the child is
  // moved to fee_payments_reversed. Use only when that is really true.
  if (args.includes('--reset-all')) {
    const ledgers = await db.collection('fee_ledgers').find({ studentId: student.id }).toArray();
    const pays = await db.collection('fee_payments').find({ studentId: student.id }).toArray();
    const paidBills = ledgers.filter((b) => num(b.paidAmount) > 0 || String(b.status || '').toUpperCase() === 'PAID');
    console.log(`\nReceipts of this student: ${pays.length ? '' : 'none'}`);
    for (const p of pays) console.log(`  ${p.receiptNumber}  ₹${p.amount}  ${p.paymentDate}  ${p.paymentMethod || p.paymentMode || ''}  ${p.collectedBy || ''}`);
    const updates = paidBills.map((b) => {
      const billTotal = round2(num(b.total ?? b.totalAmount ?? b.amount));
      const status = billTotal <= 0 ? 'PAID' : b.dueDate && b.dueDate < today ? 'OVERDUE' : 'PENDING';
      return {
        before: b,
        set: {
          paidAmount: 0,
          pendingAmount: billTotal,
          status,
          receiptNumber: '',
          paymentDate: '',
          paymentMethod: '',
          transactionReference: '',
          collectedBy: '',
          remarks: `${b.remarks ? `${b.remarks} | ` : ''}Reset to unpaid on ${today}: ${reason}`,
          updatedAt: new Date().toISOString(),
        },
      };
    }).filter((u) => num(u.before.paidAmount) > 0 || u.set.status !== 'PAID');
    const totalBack = round2(updates.reduce((s, u) => s + num(u.before.paidAmount), 0));
    console.log(`\nWill reset ${updates.length} bill(s) to unpaid — ₹${totalBack} goes back to due:`);
    for (const u of updates) {
      console.log(`  ${u.before.feeMonth || u.before.feeType}: paid ₹${num(u.before.paidAmount)} → ₹0, due ₹${num(u.before.pendingAmount)} → ₹${u.set.pendingAmount}, ${u.before.status} → ${u.set.status}`);
    }
    if (pays.length) console.log(`…and move ${pays.length} receipt(s) above to fee_payments_reversed.`);
    if (!APPLY) {
      console.log('\nDry run only. Nothing was changed. Stop the app, then run again with --apply.');
    } else {
      const now = new Date().toISOString();
      const strip = ({ _id, ...rest }) => rest;
      if (pays.length) await db.collection('fee_payments_reversed').insertMany(pays.map((p) => ({ ...strip(p), originalId: String(p._id), reversedAt: now, reversedBy: by, reverseReason: reason })));
      if (updates.length) await db.collection('fee_ledgers_backup').insertMany(updates.map((u) => ({ ...strip(u.before), originalId: String(u.before._id), backupOf: 'reset-all', backedUpAt: now })));
      for (const u of updates) await db.collection('fee_ledgers').updateOne({ id: u.before.id }, { $set: u.set });
      for (const p of pays) await db.collection('fee_payments').deleteOne({ _id: p._id });
      await db.collection('audit_logs').insertOne({
        id: `audit-reset-${Date.now()}`,
        timestamp: now,
        userName: by,
        userRole: 'SUPER_ADMIN',
        role: 'SUPER_ADMIN',
        action: 'FEE_BILLS_RESET_TO_UNPAID',
        entity: 'FeeLedger',
        entityId: student.id,
        details: `Reset ${updates.length} bill(s) (₹${totalBack}) of ${student.name} (adm ${student.admissionNumber}) to unpaid and moved ${pays.length} receipt(s) aside. ${reason}. Copies kept in fee_ledgers_backup / fee_payments_reversed.`,
        ipAddress: '127.0.0.1',
        metadata: { bills: updates.map((u) => ({ id: u.before.id, before: { paidAmount: u.before.paidAmount, pendingAmount: u.before.pendingAmount, status: u.before.status }, after: { paidAmount: 0, pendingAmount: u.set.pendingAmount, status: u.set.status } })), receipts: pays.map((p) => p.receiptNumber) },
      });
      console.log('\nDone. All bills of this student are due again. Start the app.');
    }
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }

  const online = await db.collection('fee_payments').find({
    studentId: student.id,
    $or: [{ merchantOrderId: { $exists: true, $ne: '' } }, { razorpayPaymentId: { $exists: true, $ne: '' } }, { collectedBy: /phonepe|razorpay/i }],
  }).sort({ paymentDate: -1 }).toArray();
  if (!online.length) throw new Error('This student has no online payment records.');
  console.log('\nOnline payments of this student:');
  for (const p of online) console.log(`  ${p.receiptNumber}  ₹${p.amount}  ${p.paymentDate}  ${p.phonepeTransactionId || p.razorpayPaymentId || p.transactionReference || ''}  ${p.feeMonth || p.feeType || ''}`);

  const ALL = args.includes('--all');
  const chosen = ALL ? online : receipt ? online.filter((p) => p.receiptNumber === receipt) : online.length === 1 ? online : [];
  if (!chosen.length) {
    console.log(receipt ? `\nReceipt ${receipt} is not one of the online payments above.` : '\nMore than one online payment: add --receipt <number> for one, or --all for every online payment of this student.');
    process.exitCode = 1;
  } else {
    const ledgers = await db.collection('fee_ledgers').find({ studentId: student.id }).toArray();
    const labelOf = (b) => b.feeMonth || b.feeType || 'School fee';
    const back = new Map(); // ledger id -> amount to move from paid back to due
    const add = (id, amt) => back.set(id, round2((back.get(id) || 0) + amt));

    // Which bill(s) each receipt paid: one-bill receipts name the bill (ledgerId); multi-bill receipts list
    // every bill in their breakdown. Anything that cannot be matched exactly stops the script.
    for (const pay of chosen) {
      const parts = Array.isArray(pay.breakdown) && pay.breakdown.length ? pay.breakdown : null;
      if (!parts) {
        let bill = ledgers.find((l) => l.id === pay.ledgerId);
        if (!bill) {
          const byReceipt = ledgers.filter((l) => l.receiptNumber === pay.receiptNumber);
          if (byReceipt.length !== 1) throw new Error(`Cannot tell which bill receipt ${pay.receiptNumber} paid; reverse it by hand.`);
          bill = byReceipt[0];
        }
        add(bill.id, num(pay.amount));
      } else {
        let sum = 0;
        const used = new Set();
        for (const part of parts) {
          const same = ledgers.filter((l) => labelOf(l) === part.head && !used.has(l.id));
          const bill = same.length === 1 ? same[0] : same.find((l) => l.receiptNumber === pay.receiptNumber);
          if (!bill) throw new Error(`Cannot match "${part.head}" of receipt ${pay.receiptNumber} to one bill; reverse it by hand.`);
          used.add(bill.id);
          add(bill.id, num(part.amount));
          sum += num(part.amount);
        }
        if (Math.abs(round2(sum) - num(pay.amount)) > 0.01) throw new Error(`Breakdown of ${pay.receiptNumber} (₹${round2(sum)}) does not add up to ₹${pay.amount}; reverse it by hand.`);
      }
    }

    const receipts = new Set(chosen.map((p) => p.receiptNumber));
    const updates = [...back.entries()].map(([id, amt]) => {
      const b = ledgers.find((l) => l.id === id);
      if (amt > num(b.paidAmount) + 0.01) throw new Error(`Bill ${labelOf(b)} shows only ₹${num(b.paidAmount)} paid but ₹${amt} would be reversed; reverse it by hand.`);
      const billTotal = num(b.total ?? b.totalAmount ?? b.amount);
      const paid = round2(Math.max(0, num(b.paidAmount) - amt));
      const pending = round2(Math.max(0, billTotal - paid));
      const status = pending <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : b.dueDate && b.dueDate < today ? 'OVERDUE' : 'PENDING';
      const clearReceipt = receipts.has(b.receiptNumber)
        ? { receiptNumber: '', paymentDate: '', paymentMethod: '', transactionReference: '', collectedBy: '' }
        : {};
      return {
        before: b,
        amt,
        set: {
          paidAmount: paid,
          pendingAmount: pending,
          status,
          ...clearReceipt,
          remarks: `${b.remarks ? `${b.remarks} | ` : ''}Reversed online ₹${amt} (${[...receipts].join(', ')}) on ${today}: ${reason}`,
          updatedAt: new Date().toISOString(),
        },
      };
    });

    const totalBack = round2(updates.reduce((s, u) => s + u.amt, 0));
    console.log(`\nWill reverse ${chosen.length} online receipt(s): ${[...receipts].join(', ')} — total ₹${totalBack}`);
    for (const u of updates) {
      console.log(`  ${labelOf(u.before)}: paid ₹${num(u.before.paidAmount)} → ₹${u.set.paidAmount}, due ₹${num(u.before.pendingAmount)} → ₹${u.set.pendingAmount}, ${u.before.status} → ${u.set.status}`);
    }

    if (!APPLY) {
      console.log('\nDry run only. Nothing was changed. Stop the app, then run again with --apply.');
    } else {
      const now = new Date().toISOString();
      const strip = ({ _id, ...rest }) => rest;
      await db.collection('fee_payments_reversed').insertMany(chosen.map((p) => ({ ...strip(p), originalId: String(p._id), reversedAt: now, reversedBy: by, reverseReason: reason })));
      await db.collection('fee_ledgers_backup').insertMany(updates.map((u) => ({ ...strip(u.before), originalId: String(u.before._id), backupOf: [...receipts].join(', '), backedUpAt: now })));
      for (const u of updates) await db.collection('fee_ledgers').updateOne({ id: u.before.id }, { $set: u.set });
      for (const p of chosen) {
        await db.collection('fee_payments').deleteOne({ _id: p._id });
        if (p.merchantOrderId || p.razorpayPaymentId) {
          await db.collection('payment_orders').updateOne(
            p.merchantOrderId ? { orderId: p.merchantOrderId } : { paymentId: p.razorpayPaymentId },
            { $set: { status: 'REFUNDED', reconciliationRequired: true, reconciliationNote: `Reversed by ${by} on ${today}: ${reason}`, updatedAt: now } }
          );
        }
      }
      await db.collection('audit_logs').insertOne({
        id: `audit-reverse-${Date.now()}`,
        timestamp: now,
        userName: by,
        userRole: 'SUPER_ADMIN',
        role: 'SUPER_ADMIN',
        action: 'FEE_ONLINE_PAYMENT_REVERSED',
        entity: 'FeePayment',
        entityId: [...receipts].join(', '),
        details: `Reversed online receipt(s) ${[...receipts].join(', ')} (₹${totalBack}) for ${student.name} (adm ${student.admissionNumber}). ${reason}. Copies kept in fee_payments_reversed / fee_ledgers_backup.`,
        ipAddress: '127.0.0.1',
        metadata: { receipts: chosen.map((p) => ({ receiptNumber: p.receiptNumber, amount: p.amount, transactionId: p.phonepeTransactionId || p.razorpayPaymentId || p.transactionReference || '' })), bills: updates.map((u) => ({ id: u.before.id, reversed: u.amt, before: { paidAmount: u.before.paidAmount, pendingAmount: u.before.pendingAmount, status: u.before.status }, after: { paidAmount: u.set.paidAmount, pendingAmount: u.set.pendingAmount, status: u.set.status } })) },
      });
      console.log('\nDone. The fee is due again. Start the app; it recalculates late fees on its next fee check.');
    }
  }
} catch (err) {
  console.error('\nERROR:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
