import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, StyleSheet, Linking, Alert, AppState } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { Card, CardMessage } from '../../components/teacher-home/ListParts';
import { apiService } from '../../services/apiService';
import { useChildData, useParentChildren, NoActiveChild } from '../ParentChildContext';
import { Banner, Figure, ParentHeader, Pill, Screen, Segmented, SkeletonList, SPACE, StateBlock, Tone } from '../ui';
import { formatDisplayDate, formatRupees, ledgerPending, ledgerState, ledgerTotal, LedgerState, summarizeFees } from '../../utils/parentRules';

const LEDGER_UI: Record<LedgerState, { label: string; tone: Tone }> = {
  PAID: { label: 'Paid', tone: 'success' },
  PARTIAL: { label: 'Part paid', tone: 'warning' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
  DUE: { label: 'Due', tone: 'info' },
};

const methodLabel = (m?: string) => (m ? m.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '');

export const ParentFeesScreen: React.FC<{ onOpenChildren: () => void; onBack?: () => void }> = ({ onOpenChildren, onBack }) => {
  const { activeChild } = useParentChildren();
  const [tab, setTab] = useState<'invoices' | 'payments'>('invoices');
  const [openLedger, setOpenLedger] = useState<any | null>(null);
  const [openPayment, setOpenPayment] = useState<any | null>(null);

  const fees = useChildData(async (c, o) => {
    const [l, p] = await Promise.all([apiService.getChildFeeLedgers(c.id, o), apiService.getChildPayments(c.id, o)]);
    if (!l.ok) return { ok: false, status: l.status, error: l.error };
    return { ok: true, data: { ledgers: l.data, payments: p.ok ? p.data : [], paymentsFailed: !p.ok } };
  });

  const ledgers = useMemo(
    () => [...(fees.data?.ledgers || [])].sort((a: any, b: any) => String(b.dueDate || '').localeCompare(String(a.dueDate || ''))),
    [fees.data]
  );
  const payments = useMemo(
    () => [...(fees.data?.payments || [])].sort((a: any, b: any) => String(b.paymentDate || '').localeCompare(String(a.paymentDate || ''))),
    [fees.data]
  );
  const summary = useMemo(() => (fees.data ? summarizeFees(fees.data.ledgers, fees.data.payments) : null), [fees.data]);
  const openBillCount = useMemo(() => ledgers.filter((l: any) => ledgerPending(l) > 0).length, [ledgers]);

  // Online payment (PhonePe) is offered only when the school server has it switched on.
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  // 'ALL' while the full balance is being paid, else the id of the one bill being paid.
  const [payingKey, setPayingKey] = useState<string | null>(null);
  // `success` is true ONLY when the school server says paymentStatus SUCCESS. `pending` = the bank has not confirmed yet.
  const [payResult, setPayResult] = useState<{ success: boolean; pending?: boolean; message: string } | null>(null);
  const [paidOrderId, setPaidOrderId] = useState<string | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const pendingOrderRef = useRef<{ orderId: string } | null>(null);
  // The foreground listener below is set up once; these refs keep it looking at the latest screen state.
  const refreshRef = useRef<() => void>(() => undefined);
  refreshRef.current = fees.refresh;
  const paymentsRef = useRef<any[]>([]);
  paymentsRef.current = payments;
  const checkingRef = useRef(false);

  useEffect(() => {
    apiService.getOnlinePaymentConfig().then((cfg) => setOnlineEnabled(cfg.enabled));
  }, []);

  /**
   * Asks the school server what happened to an order (it re-checks with PhonePe). Nothing the browser showed is
   * trusted: the fee is shown as paid only when the server answers SUCCESS with a receipt.
   */
  const checkOrder = useCallback(async (orderId: string, tries = 6) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      let last: { ok: boolean; paymentStatus?: string; receiptNumber?: string | null; message?: string } | null = null;
      for (let i = 0; i < tries; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 1500 : 2500));
        const s = await apiService.getOnlinePaymentStatus(orderId);
        if (s.ok) {
          last = s;
          if (s.paymentStatus === 'SUCCESS' || s.paymentStatus === 'FAILED' || s.paymentStatus === 'CANCELLED' || s.paymentStatus === 'EXPIRED') break;
        }
      }
      if (last?.paymentStatus === 'SUCCESS' && last.receiptNumber) {
        setPayResult({ success: true, message: 'Payment successful!' });
        setPaidOrderId(orderId);
        // Reload until the receipt shows up (a few seconds at most)
        for (let i = 0; i < 4; i++) {
          refreshRef.current();
          await new Promise((r) => setTimeout(r, 2500));
          if (paymentsRef.current.some((p: any) => p.merchantOrderId === orderId)) break;
        }
      } else if (last?.paymentStatus === 'PENDING' || (last?.paymentStatus === 'SUCCESS' && !last.receiptNumber)) {
        setPayResult({ success: false, pending: true, message: last.message || 'Your payment is being confirmed by the bank. Your fee will update automatically — please do not pay again.' });
      } else if (last?.paymentStatus === 'FAILED') {
        setPayResult({ success: false, message: 'Payment failed. No fee was marked as paid. You can try again.' });
      } else if (last) {
        setPayResult({ success: false, message: 'Payment was not completed. No fee was marked as paid. You can try again.' });
      } else {
        setPayResult({ success: false, pending: true, message: 'Could not check the payment. Pull down to refresh; if money was deducted your fee will update automatically.' });
      }
      refreshRef.current();
    } finally {
      checkingRef.current = false;
    }
  }, []);

  // When the app comes back to the foreground after checkout, ask the server (never the browser) what happened.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && pendingOrderRef.current) {
        const { orderId } = pendingOrderRef.current;
        pendingOrderRef.current = null;
        setPayingKey(null);
        checkOrder(orderId);
      }
    });
    return () => sub.remove();
  }, [checkOrder]);

  // Opening Fees (also after the app was killed mid-payment): pick up any payment the server is still confirming.
  useEffect(() => {
    if (!activeChild?.id || !onlineEnabled) return;
    let cancelled = false;
    apiService.getOpenOnlinePayments(activeChild.id).then((r) => {
      if (cancelled) return;
      const pending = r.open.find((o) => o.paymentStatus === 'PENDING');
      if (pending) {
        setPayResult({ success: false, pending: true, message: pending.message || 'A payment is being confirmed by the bank. Your fee will update automatically — please do not pay again.' });
        checkOrder(pending.orderId, 8);
      }
    });
    return () => { cancelled = true; };
  }, [activeChild?.id, onlineEnabled, checkOrder]);

  /** Opens PhonePe's PayPage in the phone's browser. PhonePe brings the browser back to the school's page, and the
   * app asks the school server for the verified result when it comes back to the foreground. */
  const openCheckout = useCallback(async (order: { orderId?: string; checkoutUrl?: string }) => {
    if (!order.orderId || !order.checkoutUrl || !/^https:\/\//.test(order.checkoutUrl)) return;
    pendingOrderRef.current = { orderId: order.orderId };
    await Linking.openURL(order.checkoutUrl);
  }, []);

  const handlePayOnline = useCallback(async (ledger: any) => {
    if (!activeChild || payingKey) return;
    setPayingKey(ledger.id);
    setPayResult(null);
    setPaidOrderId(null);
    try {
      const orderRes = await apiService.createBillPaymentOrder(ledger.id, activeChild.id);
      if (!orderRes.ok || !orderRes.orderId) {
        setPayingKey(null);
        if (orderRes.pendingOrderId) {
          setPayResult({ success: false, pending: true, message: orderRes.error || 'An earlier payment is still being confirmed.' });
          checkOrder(orderRes.pendingOrderId, 4);
          return;
        }
        Alert.alert('Error', orderRes.error || 'Could not create payment order.');
        return;
      }
      await openCheckout(orderRes);
    } catch (err: any) {
      setPayingKey(null);
      Alert.alert('Error', err.message || 'An error occurred.');
    }
  }, [activeChild, payingKey, openCheckout, checkOrder]);

  /** Pays everything this child owes in one go; the server works out the amount and issues one receipt. */
  const handlePayFull = useCallback(async () => {
    if (!activeChild || payingKey) return;
    setPayingKey('ALL');
    setPayResult(null);
    setPaidOrderId(null);
    try {
      const orderRes = await apiService.createFullPaymentOrder(activeChild.id);
      if (!orderRes.ok || !orderRes.orderId) {
        setPayingKey(null);
        if (orderRes.pendingOrderId) {
          setPayResult({ success: false, pending: true, message: orderRes.error || 'An earlier payment is still being confirmed.' });
          checkOrder(orderRes.pendingOrderId, 4);
          return;
        }
        Alert.alert('Error', orderRes.error || 'Could not start the payment.');
        return;
      }
      await openCheckout(orderRes);
    } catch (err: any) {
      setPayingKey(null);
      Alert.alert('Error', err.message || 'An error occurred.');
    }
  }, [activeChild, payingKey, openCheckout, checkOrder]);

  /** The phone's browser downloads the server-made receipt PDF from a short-lived link. */
  const downloadReceipt = useCallback(
    async (receiptNumber?: string) => {
      if (!receiptNumber || receiptBusy) return;
      setReceiptBusy(true);
      try {
        const res = await apiService.getReceiptDownloadUrl(receiptNumber);
        if (!res.ok || !res.url) {
          Alert.alert('Receipt', res.error || 'Could not prepare the receipt.');
          return;
        }
        await Linking.openURL(res.url);
      } catch {
        Alert.alert('Receipt', 'Could not open the receipt. Please try again.');
      } finally {
        setReceiptBusy(false);
      }
    },
    [receiptBusy]
  );

  const paidReceipt = useMemo(
    () => (paidOrderId ? payments.find((p: any) => p.merchantOrderId === paidOrderId) || null : null),
    [paidOrderId, payments]
  );

  return (
    <Screen header={<ParentHeader title="Fees" onBack={onBack} child={activeChild} onPressChild={onOpenChildren} />} refreshing={fees.refreshing} onRefresh={fees.refresh}>
      {!activeChild ? (
        <NoActiveChild />
      ) : fees.state === 'error' && !fees.data ? (
        <StateBlock kind="error" title="Fee records could not be loaded" message={fees.error} onRetry={fees.reload} />
      ) : fees.state === 'loading' && !fees.data ? (
        <SkeletonList rows={4} />
      ) : summary && summary.ledgerCount === 0 && payments.length === 0 ? (
        <StateBlock kind="empty" icon="wallet" title="No fee records yet" message="The school has not issued any fee bills for this child." />
      ) : (
        <>
          {fees.state === 'error' && <Banner text="Could not refresh. Showing the last loaded records." onRetry={fees.refresh} />}
          {fees.data?.paymentsFailed && <Banner text="Payment history could not be loaded." onRetry={fees.refresh} />}

          {summary && (
            <Card gap={SPACE.md}>
              <View>
                <T style={styles.dueLabel}>Outstanding</T>
                <T style={[styles.due, { color: summary.totalPending > 0 ? '#B42318' : '#16803C' }]}>
                  {summary.totalPending > 0 ? formatRupees(summary.totalPending) : 'Nothing due'}
                </T>
                {summary.overdue > 0 && (
                  <T style={styles.overdue}>
                    {formatRupees(summary.overdue)} overdue across {summary.overdueCount} {summary.overdueCount === 1 ? 'bill' : 'bills'}
                  </T>
                )}
              </View>
              <View style={styles.figures}>
                <Figure label="Total billed" value={formatRupees(summary.totalBilled)} />
                <Figure label="Paid" value={formatRupees(summary.totalPaid)} tone="success" />
              </View>
              {summary.totalPending > 0 && onlineEnabled && (
                <View style={{ gap: SPACE.xs }}>
                  <TouchableOpacity
                    style={[styles.payFullBtn, !!payingKey && styles.payFullBtnBusy]}
                    onPress={handlePayFull}
                    disabled={!!payingKey}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Pay the full outstanding ${formatRupees(summary.totalPending)} online`}
                  >
                    <Icon name="wallet" size={18} color="#fff" />
                    <T style={styles.payFullText}>{payingKey === 'ALL' ? 'Opening payment...' : `Pay full ${formatRupees(summary.totalPending)}`}</T>
                  </TouchableOpacity>
                  <T style={styles.payNote}>
                    {openBillCount > 1 ? `Clears all ${openBillCount} unpaid bills in one payment, with one receipt.` : 'Pay online now and get your receipt here.'}
                  </T>
                </View>
              )}
              {summary.totalPending > 0 && !onlineEnabled && (
                <T style={styles.payNote}>Please pay at the school accounts office or by official school bank transfer.</T>
              )}
            </Card>
          )}

          {/* Payment result banner */}
          {payResult && (
            <Card gap={SPACE.sm}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                <Icon name={payResult.success ? 'check' : 'circle-alert'} size={20} color={payResult.success ? '#16803C' : payResult.pending ? '#B45309' : '#B42318'} />
                <T style={[styles.payNote, { color: payResult.success ? '#065F46' : payResult.pending ? '#92400E' : '#991B1B', flex: 1 }]}>{payResult.message}</T>
                <TouchableOpacity onPress={() => { setPayResult(null); setPaidOrderId(null); }} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Dismiss">
                  <Icon name="x" size={16} color={TH.muted} />
                </TouchableOpacity>
              </View>
              {payResult.success && (
                paidReceipt ? (
                  <>
                    <Line label="Receipt no." value={paidReceipt.receiptNumber} />
                    <Line label="Amount paid" value={formatRupees(Number(paidReceipt.amount))} strong />
                    <TouchableOpacity
                      style={[styles.payFullBtn, receiptBusy && styles.payFullBtnBusy]}
                      onPress={() => downloadReceipt(paidReceipt.receiptNumber)}
                      disabled={receiptBusy}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Download your payment receipt"
                    >
                      <Icon name="receipt" size={18} color="#fff" />
                      <T style={styles.payFullText}>{receiptBusy ? 'Preparing receipt...' : 'Download receipt'}</T>
                    </TouchableOpacity>
                  </>
                ) : (
                  <T style={styles.payNote}>Your receipt is being prepared. It will appear under Payments in a moment.</T>
                )
              )}
            </Card>
          )}

          <Segmented
            options={[
              { value: 'invoices', label: `Bills (${ledgers.length})` },
              { value: 'payments', label: `Payments (${payments.length})` },
            ]}
            value={tab}
            onChange={(v) => setTab(v as 'invoices' | 'payments')}
          />

          {tab === 'invoices' ? (
            <Card gap={0}>
              {ledgers.length === 0 ? (
                <CardMessage text="No bills issued yet." />
              ) : (
                ledgers.map((l: any, i: number) => {
                  const st = ledgerState(l);
                  return (
                    <View key={l.id || i} style={[i > 0 && styles.rowBorder]}>
                      <TouchableOpacity
                        style={styles.row}
                        onPress={() => setOpenLedger(l)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${l.feeType || l.feeMonth || 'Bill'}, ${formatRupees(ledgerTotal(l))}, ${LEDGER_UI[st].label}`}
                      >
                        <View style={styles.rowText}>
                          <T style={styles.rowTitle} numberOfLines={2}>
                            {l.feeType || l.feeMonth || 'Fee bill'}
                          </T>
                          <T style={styles.rowSub}>{l.dueDate ? `Due ${formatDisplayDate(l.dueDate)}` : 'No due date'}</T>
                        </View>
                        <View style={styles.rowRight}>
                          <T style={styles.amount}>{formatRupees(ledgerTotal(l))}</T>
                          <Pill label={LEDGER_UI[st].label} tone={LEDGER_UI[st].tone} />
                        </View>
                      </TouchableOpacity>
                      {onlineEnabled && ledgerPending(l) > 0 && (
                        <TouchableOpacity
                          style={styles.payBtn}
                          onPress={() => handlePayOnline(l)}
                          disabled={!!payingKey}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`Pay ${formatRupees(ledgerPending(l))} online`}
                        >
                          <Icon name="wallet" size={14} color="#fff" />
                          <T style={styles.payBtnText}>
                            {payingKey === l.id ? 'Opening payment...' : `Pay ₹${ledgerPending(l).toLocaleString('en-IN')} Online`}
                          </T>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </Card>
          ) : (
            <Card gap={0}>
              {payments.length === 0 ? (
                <CardMessage text="No payments recorded yet." />
              ) : (
                payments.map((p: any, i: number) => (
                  <TouchableOpacity
                    key={p.id || p.receiptNumber || i}
                    style={[styles.row, i > 0 && styles.rowBorder]}
                    onPress={() => setOpenPayment(p)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Receipt ${p.receiptNumber || ''}, ${formatRupees(Number(p.amount))}`}
                  >
                    <View style={styles.rowIcon}>
                      <Icon name="receipt" size={18} color={TH.royal} />
                    </View>
                    <View style={styles.rowText}>
                      <T style={styles.rowTitle} numberOfLines={1}>
                        {p.receiptNumber || 'Receipt'}
                      </T>
                      <T style={styles.rowSub} numberOfLines={1}>
                        {[formatDisplayDate(String(p.paymentDate || '').substring(0, 10)), methodLabel(p.paymentMethod || p.paymentMode)].filter(Boolean).join(' · ')}
                      </T>
                    </View>
                    <T style={styles.amount}>{formatRupees(Number(p.amount))}</T>
                  </TouchableOpacity>
                ))
              )}
            </Card>
          )}
        </>
      )}

      <DetailSheet visible={!!openLedger} title={openLedger?.feeType || 'Fee bill'} onClose={() => setOpenLedger(null)}>
        {openLedger && (
          <>
            {(openLedger.breakdown || []).map((b: any, i: number) => (
              <Line key={i} label={b.head || 'Fee'} value={formatRupees(Number(b.amount))} />
            ))}
            {Number(openLedger.fine) > 0 && <Line label="Late fee" value={formatRupees(Number(openLedger.fine))} />}
            {Number(openLedger.discount) > 0 && <Line label="Concession" value={`-${formatRupees(Number(openLedger.discount))}`} />}
            <View style={styles.sheetDivider} />
            <Line label="Total" value={formatRupees(ledgerTotal(openLedger))} strong />
            <Line label="Paid" value={formatRupees(Number(openLedger.paidAmount) || 0)} />
            <Line label="Pending" value={formatRupees(ledgerPending(openLedger))} strong />
            {!!openLedger.dueDate && <Line label="Due date" value={formatDisplayDate(openLedger.dueDate)} />}
            {!!openLedger.invoiceNumber && <Line label="Invoice no." value={openLedger.invoiceNumber} />}
          </>
        )}
      </DetailSheet>

      <DetailSheet visible={!!openPayment} title={openPayment?.receiptNumber ? `Receipt ${openPayment.receiptNumber}` : 'Receipt'} onClose={() => setOpenPayment(null)}>
        {openPayment && (
          <>
            <Line label="Amount paid" value={formatRupees(Number(openPayment.amount))} strong />
            {!!openPayment.paymentDate && <Line label="Date" value={formatDisplayDate(String(openPayment.paymentDate).substring(0, 10))} />}
            {!!(openPayment.paymentMethod || openPayment.paymentMode) && <Line label="Mode" value={methodLabel(openPayment.paymentMethod || openPayment.paymentMode)} />}
            {!!openPayment.transactionReference && <Line label="Reference" value={openPayment.transactionReference} />}
            {!!(openPayment.feeType || openPayment.feeMonth) && <Line label="For" value={openPayment.feeType || openPayment.feeMonth} />}
            {Number(openPayment.fine) > 0 && <Line label="Late fee" value={formatRupees(Number(openPayment.fine))} />}
            {Number(openPayment.discount) > 0 && <Line label="Concession" value={formatRupees(Number(openPayment.discount))} />}
            {typeof openPayment.balanceDue === 'number' && <Line label="Balance after payment" value={formatRupees(openPayment.balanceDue)} />}
            {Array.isArray(openPayment.breakdown) && openPayment.breakdown.length > 1 && (
              <>
                <View style={styles.sheetDivider} />
                <T style={styles.sheetNote}>Bills paid with this receipt</T>
                {openPayment.breakdown.map((b: any, i: number) => (
                  <Line key={i} label={b.head || 'Fee'} value={formatRupees(Number(b.amount))} />
                ))}
              </>
            )}
            {!!openPayment.receiptNumber && (
              <TouchableOpacity
                style={[styles.payFullBtn, { marginTop: SPACE.md }, receiptBusy && styles.payFullBtnBusy]}
                onPress={() => downloadReceipt(openPayment.receiptNumber)}
                disabled={receiptBusy}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Download this receipt as a PDF"
              >
                <Icon name="receipt" size={18} color="#fff" />
                <T style={styles.payFullText}>{receiptBusy ? 'Preparing receipt...' : 'Download receipt (PDF)'}</T>
              </TouchableOpacity>
            )}
          </>
        )}
      </DetailSheet>
    </Screen>
  );
};

const Line: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <View style={styles.line}>
    <T style={[styles.lineLabel, strong && styles.lineStrong]} numberOfLines={2}>
      {label}
    </T>
    <T style={[styles.lineValue, strong && styles.lineStrong]}>{value}</T>
  </View>
);

/** Bottom sheet for details; Android back closes it (onRequestClose). */
const DetailSheet: React.FC<{ visible: boolean; title: string; onClose: () => void; children: React.ReactNode }> = ({ visible, title, onClose, children }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <TouchableOpacity style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <T style={styles.sheetTitle} numberOfLines={2}>
            {title}
          </T>
          <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="x" size={20} color={TH.navy} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ gap: SPACE.sm, paddingBottom: SPACE.xl }}>{children}</ScrollView>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  dueLabel: { fontFamily: FONT.medium, fontSize: 12, color: TH.muted },
  due: { fontFamily: FONT.bold, fontSize: 28, marginTop: 2 },
  overdue: { fontFamily: FONT.medium, fontSize: 13, color: '#B42318', marginTop: 2 },
  figures: { flexDirection: 'row', gap: SPACE.lg, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: TH.border },
  payNote: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  rowSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  amount: { fontFamily: FONT.bold, fontSize: 14, color: TH.ink },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,75,0.45)' },
  sheet: { maxHeight: '80%', backgroundColor: TH.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm },
  sheetTitle: { flex: 1, fontFamily: FONT.heading, fontSize: 18, color: TH.navy },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  sheetDivider: { height: 1, backgroundColor: TH.border, marginVertical: SPACE.xs },
  sheetNote: { marginTop: SPACE.sm, fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted },
  line: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.md, minHeight: 28 },
  lineLabel: { flex: 1, fontFamily: FONT.regular, fontSize: 14, color: TH.muted },
  lineValue: { fontFamily: FONT.medium, fontSize: 14, color: TH.ink, textAlign: 'right' },
  lineStrong: { fontFamily: FONT.bold, color: TH.ink },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 2, marginBottom: SPACE.sm, marginHorizontal: SPACE.xs,
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: '#1e40af', borderRadius: 10,
  },
  payBtnText: { fontFamily: FONT.semibold, fontSize: 13, color: '#fff' },
  payFullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 48, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#1e40af',
  },
  payFullBtnBusy: { opacity: 0.6 },
  payFullText: { fontFamily: FONT.bold, fontSize: 15, color: '#fff' },
});
