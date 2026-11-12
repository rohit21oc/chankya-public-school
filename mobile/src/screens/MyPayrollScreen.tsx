import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { BRAND_COLORS, SCHOOL_INFO } from '../utils/branding';
import { apiService } from '../services/apiService';
import { normalizePayrollRecord, formatRupees, selectOwnPayroll, PayrollView } from '../utils/payrollRules';

interface MyPayrollScreenProps {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
}

export const MyPayrollScreen: React.FC<MyPayrollScreenProps> = ({
  user,
  onBack,
  onOpenMenu,
  onOpenProfile,
}) => {
  const [payrollHistory, setPayrollHistory] = useState<PayrollView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPayroll = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiService.getMyPayroll();
      if (!res.ok) {
        if (res.status === 401) {
          setErrorMessage('Your session has expired. Please sign in again.');
        } else if (res.status === 403) {
          setErrorMessage('You do not have access to payroll records.');
        } else {
          setErrorMessage(res.error || 'Failed to retrieve salary records from server.');
        }
        setPayrollHistory([]);
      } else {
        setPayrollHistory(selectOwnPayroll(res.data, user).map(normalizePayrollRecord));
      }
    } catch {
      setErrorMessage('Could not connect to payroll server. Please check your network.');
      setPayrollHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPayroll();
  }, [user.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPayroll();
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const downloadPayslip = async (recordId: string) => {
    setDownloadingId(recordId);
    try {
      const res = await apiService.getPayslipDownloadUrl(recordId);
      if (!res.ok || !res.url) {
        Alert.alert('Payslip', res.error || 'Could not prepare the payslip. Please try again.');
        return;
      }
      await Linking.openURL(res.url);
    } catch {
      Alert.alert('Payslip', 'Could not open the payslip. Please check your connection and try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <SchoolHeader
        user={user}
        showBack
        onBack={onBack}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
        title="My Payroll"
        subtitle={`Employee: ${user.name}`}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[BRAND_COLORS.primaryBright]}
          />
        }
      >
        {/* Staff Identity Card */}
        <View style={styles.profileBanner}>
          <View style={styles.profileCol}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileId}>Employee ID: {user.employeeId || user.username}</Text>
            <Text style={styles.profileRole}>Role: {user.role}</Text>
          </View>
          <View style={styles.institutionTag}>
            <Text style={styles.institutionTagText}>{SCHOOL_INFO.shortName}</Text>
          </View>
        </View>

        {/* Loading Spinner */}
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={BRAND_COLORS.primaryRoyal} />
            <Text style={styles.loadingText}>Fetching verified salary records...</Text>
          </View>
        )}

        {/* Error State */}
        {!loading && errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadPayroll}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Payroll Records List */}
        {!loading && !errorMessage && (
          <View style={styles.recordsContainer}>
            <Text style={styles.sectionHeaderTitle}>
              Monthly Salary Statements ({payrollHistory.length})
            </Text>

            {payrollHistory.map((rec) => {
              const isExpanded = expandedId === rec.id;
              const isPaid = rec.status === 'PAID';

              return (
                <View key={rec.id} style={styles.slipCard}>
                  <TouchableOpacity
                    style={styles.slipTopRow}
                    onPress={() => toggleExpand(rec.id)}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.slipMonth}>{rec.month}</Text>
                      {rec.slipNumber && <Text style={styles.slipNumber}>Slip #{rec.slipNumber}</Text>}
                    </View>

                    <View style={styles.statusAndAmount}>
                      <View
                        style={[styles.statusBadge, isPaid ? styles.statusBadgePaid : styles.statusBadgePending]}
                      >
                        <Text style={[styles.statusBadgeText, isPaid ? styles.statusPaidText : styles.statusPendingText]}>
                          {rec.status}
                        </Text>
                      </View>
                      <Text style={styles.netAmountText}>{formatRupees(rec.net)}</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.summaryBar}>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Gross Salary</Text>
                      <Text style={styles.summaryValue}>{formatRupees(rec.gross)}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Deductions</Text>
                      <Text style={[styles.summaryValue, { color: '#B91C1C' }]}>{formatRupees(rec.deductions)}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Net Payable</Text>
                      <Text style={[styles.summaryValue, { color: '#16803C' }]}>{formatRupees(rec.net)}</Text>
                    </View>
                  </View>

                  {isPaid && (
                    <TouchableOpacity
                      style={styles.payslipBtn}
                      onPress={() => downloadPayslip(rec.id)}
                      disabled={downloadingId === rec.id}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Download payslip for ${rec.month}`}
                    >
                      <Text style={styles.payslipBtnText}>
                        {downloadingId === rec.id ? 'Preparing payslip…' : 'Download Payslip (PDF)'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.expandPrompt} onPress={() => toggleExpand(rec.id)} activeOpacity={0.6}>
                    <Text style={styles.expandPromptText}>
                      {isExpanded ? 'Hide Detailed Breakdown ▲' : 'View Itemized Breakdown ▼'}
                    </Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.breakdownBox}>
                      <Text style={styles.breakdownHeading}>COMPONENTS & DEDUCTIONS</Text>

                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Basic Salary</Text>
                        <Text style={styles.breakdownVal}>{formatRupees(rec.basic)}</Text>
                      </View>

                      {rec.allowances !== undefined && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Allowances</Text>
                          <Text style={styles.breakdownVal}>{formatRupees(rec.allowances)}</Text>
                        </View>
                      )}

                      {!!rec.unpaidLeaveDays && rec.unpaidLeaveDays > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={[styles.breakdownLabel, { color: '#B91C1C' }]}>
                            Absent / unpaid leave: {rec.unpaidLeaveDays} day{rec.unpaidLeaveDays === 1 ? '' : 's'}
                            {rec.absentDays ? ` (${rec.absentDays} absent)` : ''}
                          </Text>
                          <Text style={[styles.breakdownVal, { color: '#B91C1C' }]}>-{formatRupees(rec.unpaidLeaveDeduction)}</Text>
                        </View>
                      )}

                      {!!rec.notMarkedDays && rec.notMarkedDays > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={[styles.breakdownLabel, { color: '#B91C1C' }]}>
                            Attendance not marked: {rec.notMarkedDays} day{rec.notMarkedDays === 1 ? '' : 's'}
                          </Text>
                          <Text style={[styles.breakdownVal, { color: '#B91C1C' }]}>-{formatRupees(rec.notMarkedDeduction)}</Text>
                        </View>
                      )}

                      {!!rec.lateDays && rec.lateDays > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={[styles.breakdownLabel, { color: '#B91C1C' }]}>Late: {rec.lateDays} day{rec.lateDays === 1 ? '' : 's'} (¼ day each)</Text>
                          <Text style={[styles.breakdownVal, { color: '#B91C1C' }]}>-{formatRupees(rec.lateDeduction)}</Text>
                        </View>
                      )}

                      {!!((rec.unpaidLeaveDays || 0) + (rec.notMarkedDays || 0)) && rec.dailySalary !== undefined && (
                        <Text style={styles.cutNote}>
                          1 day salary = {formatRupees(rec.dailySalary)} (monthly ÷ 30). Absent and unmarked working days are cut at 1 day each.
                        </Text>
                      )}

                      {rec.deductions !== undefined && (
                        <View style={styles.breakdownRow}>
                          <Text style={[styles.breakdownLabel, { color: '#B91C1C' }]}>Total deductions</Text>
                          <Text style={[styles.breakdownVal, { color: '#B91C1C' }]}>-{formatRupees(rec.deductions)}</Text>
                        </View>
                      )}

                      {rec.paymentDate && (
                        <View style={styles.paymentMetaRow}>
                          <Text style={styles.paymentMetaText}>
                            Paid on: {rec.paymentDate}
                            {rec.paymentMethod ? ` • Mode: ${rec.paymentMethod.replace(/_/g, ' ')}` : ''}
                          </Text>
                          {rec.transactionReference && (
                            <Text style={styles.paymentMetaText}>Ref: {rec.transactionReference}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {payrollHistory.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>💵</Text>
                <Text style={styles.emptyTitle}>No Payroll Statements</Text>
                <Text style={styles.emptySubtitle}>
                  No monthly salary statements have been generated for your employee account yet. Statements are issued upon monthly payroll closure.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  profileCol: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileId: {
    fontSize: 11,
    color: BRAND_COLORS.primaryRoyal,
    fontWeight: '600',
    marginTop: 2,
  },
  profileRole: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  institutionTag: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  institutionTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND_COLORS.primaryRoyal,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748B',
  },
  errorBox: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECDD3',
    alignItems: 'center',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: '#B91C1C',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  payslipBtn: {
    marginHorizontal: 14,
    marginBottom: 10,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#123B8C',
    alignItems: 'center',
  },
  payslipBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  recordsContainer: {
    paddingHorizontal: 14,
    marginTop: 12,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  slipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  slipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  slipMonth: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  slipNumber: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  statusAndAmount: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statusBadgePaid: {
    backgroundColor: '#ECFDF3',
  },
  statusBadgePending: {
    backgroundColor: '#FFFAEB',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusPaidText: {
    color: '#16803C',
  },
  statusPendingText: {
    color: '#B54708',
  },
  netAmountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  summaryLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  expandPrompt: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  expandPromptText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND_COLORS.primaryRoyal,
  },
  breakdownBox: {
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  breakdownHeading: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  cutNote: { fontSize: 11, color: '#7F1D1D', marginTop: 4, marginBottom: 6, lineHeight: 15 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#475569',
    flexShrink: 1,
    marginRight: 8,
  },
  breakdownVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  paymentMetaRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  paymentMetaText: {
    fontSize: 10,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
