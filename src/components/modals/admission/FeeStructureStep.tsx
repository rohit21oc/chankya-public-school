import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Bus,
  Building2,
  CheckCircle2,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Percent,
  Check,
  Trash2,
  Edit2,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import {
  AcademicClass,
  ClassFeeConfiguration,
  StudentFeeProfileData,
  StudentApplicableFeeHead,
  TransportSlab,
  TransportRoute,
  Hostel,
  HostelRoom,
  HostelBed,
} from '../../../types';
import { api } from '../../../services/api';
import { AdmissionFormData } from './AdmissionPreviewPage';
import { getEnrollmentMonthLabel, getNextMonthlyBillDate } from '../../../utils/feeDateHelper';
import { buildDefaultFeeHeads } from '../../../utils/feeProfileEdit';

interface FeeStructureStepProps {
  formData: AdmissionFormData;
  onChange: (updates: Partial<AdmissionFormData>) => void;
  classes: AcademicClass[];
}

export const FeeStructureStep: React.FC<FeeStructureStepProps> = ({
  formData,
  onChange,
  classes,
}) => {
  const currentClass = classes.find((c) => c.id === formData.classId) || classes[0];
  const className = currentClass ? currentClass.name : formData.className || 'Class 10';
  const effectiveSession = formData.academicSession || api.getSettings().currentAcademicSession || '2026-2027';

  // Load effective class fee config from existing Fee Management system
  const effectiveConfig: ClassFeeConfiguration | null = useMemo(() => {
    return api.getEffectiveFeeConfig(
      formData.classId,
      formData.section,
      effectiveSession,
      formData.category
    );
  }, [formData.classId, formData.section, effectiveSession, formData.category]);

  const transportSlabs: TransportSlab[] = useMemo(() => {
    return api.getTransportSlabsSync();
  }, []);

  // Standard fee head blueprint (shared with Edit Student → Fee structure)
  const buildInitialHeads = (): StudentApplicableFeeHead[] =>
    buildDefaultFeeHeads(effectiveConfig, formData) as StudentApplicableFeeHead[];

  // State for editable fee heads
  const [feeHeads, setFeeHeads] = useState<StudentApplicableFeeHead[]>(() => {
    if (formData.feeProfile?.feeHeads && formData.feeProfile.feeHeads.length > 0) {
      return formData.feeProfile.feeHeads;
    }
    return buildInitialHeads();
  });

  // Track if user manually customized
  const [isCustomized, setIsCustomized] = useState<boolean>(false);

  // Modal / Form state for adding custom fee head
  const [showAddCustomModal, setShowAddCustomModal] = useState<boolean>(false);
  const [customHeadName, setCustomHeadName] = useState<string>('');
  const [customHeadAmount, setCustomHeadAmount] = useState<number>(0);
  const [customHeadCategory, setCustomHeadCategory] = useState<
    'ONE_TIME' | 'MONTHLY' | 'YEARLY' | 'EXAMINATION' | 'FACILITY' | 'OTHER'
  >('MONTHLY');
  const [customHeadFrequency, setCustomHeadFrequency] = useState<
    'One Time' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | 'Event/Exam Based'
  >('Monthly');

  // Track previous class to dynamically reload fee structure when class changes
  const prevClassKeyRef = React.useRef<string>(`${formData.classId}-${className}`);

  // When class or effectiveConfig changes, reload heads
  useEffect(() => {
    const currentClassKey = `${formData.classId}-${className}`;
    if (prevClassKeyRef.current !== currentClassKey) {
      prevClassKeyRef.current = currentClassKey;
      setIsCustomized(false);
      const fresh = buildInitialHeads();
      setFeeHeads(fresh);
      return;
    }

    if (!isCustomized && (!formData.feeProfile || formData.feeProfile.className !== className)) {
      const fresh = buildInitialHeads();
      setFeeHeads(fresh);
    }
  }, [formData.classId, className, formData.section, formData.category, effectiveConfig]);

  // Sync transport and hostel opt-in flags with fee heads
  const [routesList, setRoutesList] = useState<TransportRoute[]>(() => api.getRoutes());

  useEffect(() => {
    api.fetchTransport().then((data) => {
      if (Array.isArray(data.routes)) {
        setRoutesList(data.routes);
      }
    }).catch((err) => console.warn('Could not refresh transport in admission:', err));
  }, []);

  const activeRoutes = useMemo(() => {
    return routesList.filter((r) => (r.status || 'ACTIVE') === 'ACTIVE');
  }, [routesList]);
  const selectedRoute = useMemo(() => {
    return activeRoutes.find((r) => r.id === formData.transportRouteId) || activeRoutes[0];
  }, [activeRoutes, formData.transportRouteId]);

  const availableStops = useMemo(() => {
    return (selectedRoute?.stops || []).filter((s) => s.status !== 'INACTIVE' && s.active !== false);
  }, [selectedRoute]);

  const handleToggleTransport = (checked: boolean) => {
    if (!checked) {
      const updatedHeads = feeHeads.map((h) => {
        if (h.head === 'Transport Fee') {
          return { ...h, selected: false };
        }
        return h;
      });
      setFeeHeads(updatedHeads);
      setIsCustomized(true);
      onChange({
        transportRequired: false,
        transportRouteId: '',
        transportStopName: '',
        transportStopId: '',
        transportMonthlyFee: 0,
      });
      return;
    }

    const defaultRoute = selectedRoute || activeRoutes[0];
    const stops = (defaultRoute?.stops || []).filter((s) => s.status !== 'INACTIVE' && s.active !== false);
    const defaultStop = stops[0];
    const fare = Number(defaultStop?.monthlyFare ?? defaultStop?.fare ?? defaultStop?.fee ?? 800);

    const updatedHeads = feeHeads.map((h) => {
      if (h.head === 'Transport Fee') {
        return { ...h, amount: fare, selected: true };
      }
      return h;
    });
    setFeeHeads(updatedHeads);
    setIsCustomized(true);
    onChange({
      transportRequired: true,
      transportRouteId: defaultRoute?.id || '',
      transportStopName: defaultStop?.stopName || '',
      transportStopId: defaultStop?.id || '',
      transportMonthlyFee: fare,
      vehicleNumber: defaultRoute?.vehicleNumber || '',
      driverName: defaultRoute?.driverName || '',
      driverContact: defaultRoute?.driverPhone || '',
    });
  };

  const handleRouteChange = (routeId: string) => {
    const route = activeRoutes.find((r) => r.id === routeId);
    if (!route) return;
    const stops = (route.stops || []).filter((s) => s.status !== 'INACTIVE' && s.active !== false);
    const firstStop = stops[0];
    const fare = Number(firstStop?.monthlyFare ?? firstStop?.fare ?? firstStop?.fee ?? 0);

    const updatedHeads = feeHeads.map((h) => {
      if (h.head === 'Transport Fee') {
        return { ...h, amount: fare, selected: true };
      }
      return h;
    });
    setFeeHeads(updatedHeads);
    setIsCustomized(true);

    onChange({
      transportRequired: true,
      transportRouteId: route.id,
      transportStopName: firstStop?.stopName || '',
      transportStopId: firstStop?.id || '',
      transportMonthlyFee: fare,
      vehicleNumber: route.vehicleNumber || '',
      driverName: route.driverName || '',
      driverContact: route.driverPhone || '',
    });
  };

  const handleStopChange = (stopIdOrName: string) => {
    const stop = availableStops.find((s) => s.id === stopIdOrName || s.stopName === stopIdOrName);
    if (!stop) return;
    const fare = Number(stop.monthlyFare ?? stop.fare ?? stop.fee ?? 0);

    const updatedHeads = feeHeads.map((h) => {
      if (h.head === 'Transport Fee') {
        return { ...h, amount: fare, selected: true };
      }
      return h;
    });
    setFeeHeads(updatedHeads);
    setIsCustomized(true);

    onChange({
      transportRequired: true,
      transportStopName: stop.stopName,
      transportStopId: stop.id,
      transportMonthlyFee: fare,
      vehicleNumber: selectedRoute?.vehicleNumber || '',
      driverName: selectedRoute?.driverName || '',
      driverContact: selectedRoute?.driverPhone || '',
    });
  };

  const activeHostels = useMemo(() => api.getHostels().filter((h) => h.status !== 'INACTIVE'), []);
  const activeRooms = useMemo(() => api.getHostelRooms().filter((r) => r.status !== 'INACTIVE' && r.status !== 'MAINTENANCE'), []);

  const handleToggleHostel = (checked: boolean) => {
    if (!checked) {
      const updatedHeads = feeHeads.map((h) => {
        if (h.head === 'Hostel Residency Fee' || h.head === 'Hostel Mess Fee') {
          return { ...h, selected: false };
        }
        return h;
      });
      setFeeHeads(updatedHeads);
      setIsCustomized(true);
      onChange({
        hostelRequired: false,
        hostelId: undefined,
        hostelName: '',
        hostelRoomId: '',
        hostelFloor: undefined,
        hostelBedNumber: '',
        hostelWarden: undefined,
        hostelMonthlyFee: 0,
        messMonthlyFee: 0,
      });
      return;
    }

    // Auto-select first hostel with available beds
    let targetHostel = activeHostels[0];
    let targetRoom: HostelRoom | undefined;
    let targetBed: HostelBed | undefined;

    for (const h of activeHostels) {
      const hRooms = activeRooms.filter((r) => r.hostelId === h.id);
      const withBeds = hRooms.filter((r) =>
        r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
      );
      if (withBeds.length > 0) {
        targetHostel = h;
        targetRoom = withBeds[0];
        targetBed = targetRoom.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
        break;
      }
    }

    const roomRent = targetRoom?.monthlyFee || targetHostel?.monthlyFee || Number(effectiveConfig?.hostelFee) || 0;
    const messCharges = targetHostel?.messFee || Number(effectiveConfig?.messFee) || 0;

    const updatedHeads = feeHeads.map((h) => {
      if (h.head === 'Hostel Residency Fee') {
        return { ...h, amount: roomRent, selected: true };
      }
      if (h.head === 'Hostel Mess Fee') {
        return { ...h, amount: messCharges, selected: true };
      }
      return h;
    });
    setFeeHeads(updatedHeads);
    setIsCustomized(true);

    onChange({
      hostelRequired: true,
      hostelId: targetHostel?.id || '',
      hostelName: targetHostel?.name || '',
      hostelRoomId: targetRoom?.id || '',
      hostelFloor: targetRoom?.floor,
      hostelBedNumber: targetBed?.bedNumber || '',
      hostelWarden: targetHostel?.wardenName || '',
      hostelMonthlyFee: roomRent,
      messMonthlyFee: messCharges,
    });
  };

  const handleSelectHostel = (hostelId: string) => {
    const targetHostel = activeHostels.find((h) => h.id === hostelId);
    if (!targetHostel) return;

    const hRooms = activeRooms.filter((r) => r.hostelId === targetHostel.id);
    const withBeds = hRooms.filter((r) =>
      r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
    );

    const firstRoom = withBeds[0];
    const firstBed = firstRoom?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');

    const roomRent = firstRoom?.monthlyFee || targetHostel.monthlyFee || 0;
    const messCharges = targetHostel.messFee || 0;

    const updatedHeads = feeHeads.map((h) => {
      if (h.head === 'Hostel Residency Fee') {
        return { ...h, amount: roomRent, selected: true };
      }
      if (h.head === 'Hostel Mess Fee') {
        return { ...h, amount: messCharges, selected: true };
      }
      return h;
    });
    setFeeHeads(updatedHeads);
    setIsCustomized(true);

    onChange({
      hostelRequired: true,
      hostelId: targetHostel.id,
      hostelName: targetHostel.name,
      hostelRoomId: firstRoom?.id || '',
      hostelFloor: firstRoom?.floor,
      hostelBedNumber: firstBed?.bedNumber || '',
      hostelWarden: targetHostel.wardenName,
      hostelMonthlyFee: roomRent,
      messMonthlyFee: messCharges,
    });
  };

  const handleSelectHostelRoom = (roomId: string) => {
    const targetRoom = activeRooms.find((r) => r.id === roomId);
    if (!targetRoom) return;

    const targetHostel = activeHostels.find((h) => h.id === targetRoom.hostelId);
    const availableBeds = targetRoom.beds?.filter(
      (b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'
    ) || [];
    const firstBed = availableBeds[0];

    const roomRent = targetRoom.monthlyFee || targetHostel?.monthlyFee || 0;
    const messCharges = targetHostel?.messFee || 0;

    const updatedHeads = feeHeads.map((h) => {
      if (h.head === 'Hostel Residency Fee') {
        return { ...h, amount: roomRent, selected: true };
      }
      return h;
    });
    setFeeHeads(updatedHeads);
    setIsCustomized(true);

    onChange({
      hostelRequired: true,
      hostelId: targetRoom.hostelId,
      hostelName: targetRoom.hostelName || targetHostel?.name || formData.hostelName,
      hostelRoomId: targetRoom.id,
      hostelFloor: targetRoom.floor,
      hostelBedNumber: firstBed?.bedNumber || '',
      hostelMonthlyFee: roomRent,
      messMonthlyFee: messCharges,
    });
  };

  const handleSelectHostelBed = (bedNumber: string) => {
    onChange({
      hostelBedNumber: bedNumber,
    });
  };

  const handleSlabChange = (slabId: string) => {
    const matchedSlab = transportSlabs.find((s) => s.id === slabId);
    const monthlyFee = matchedSlab ? Number(matchedSlab.monthlyFee || matchedSlab.monthlyAmount || 800) : 800;
    const updatedHeads = feeHeads.map((h) => {
      if (h.head === 'Transport Fee') {
        return { ...h, amount: monthlyFee, selected: true };
      }
      return h;
    });
    setFeeHeads(updatedHeads);
    setIsCustomized(true);
    onChange({
      transportRouteId: slabId,
      transportMonthlyFee: monthlyFee,
      transportRequired: true,
    });
  };

  // Toggle fee head selection
  const handleToggleHead = (index: number) => {
    const head = feeHeads[index];
    const newSelected = !head.selected;
    const nextHeads = [...feeHeads];
    nextHeads[index] = { ...head, selected: newSelected };
    setFeeHeads(nextHeads);
    setIsCustomized(true);

    // Keep transport/hostel flags in sync if user toggles directly in table
    if (head.head === 'Transport Fee') {
      onChange({ transportRequired: newSelected });
    } else if (head.head === 'Hostel Residency Fee' || head.head === 'Hostel Mess Fee') {
      const anyHostel = nextHeads.some(
        (h) => (h.head === 'Hostel Residency Fee' || h.head === 'Hostel Mess Fee') && h.selected
      );
      onChange({ hostelRequired: anyHostel });
    }
  };

  // Inline amount adjustment for individual student
  const handleAmountChange = (index: number, newAmount: number) => {
    const nextHeads = [...feeHeads];
    nextHeads[index] = { ...nextHeads[index], amount: Math.max(0, newAmount) };
    setFeeHeads(nextHeads);
    setIsCustomized(true);

    if (nextHeads[index].head === 'Transport Fee') {
      onChange({ transportMonthlyFee: Math.max(0, newAmount) });
    } else if (nextHeads[index].head === 'Hostel Residency Fee') {
      onChange({ hostelMonthlyFee: Math.max(0, newAmount) });
    } else if (nextHeads[index].head === 'Hostel Mess Fee') {
      onChange({ messMonthlyFee: Math.max(0, newAmount) });
    }
  };

  // Reset to class defaults
  const handleResetToClassDefaults = () => {
    const fresh = buildInitialHeads();
    setFeeHeads(fresh);
    setIsCustomized(false);
  };

  // Add custom fee head
  const handleAddCustomHead = () => {
    if (!customHeadName.trim()) return;
    const newHead: StudentApplicableFeeHead = {
      id: `head-custom-${Date.now()}`,
      head: customHeadName.trim(),
      category: customHeadCategory,
      frequency: customHeadFrequency,
      amount: Math.max(0, Number(customHeadAmount) || 0),
      selected: true,
      isDefault: false,
      remarks: 'Student-specific fee head adjustment',
    };
    setFeeHeads([...feeHeads, newHead]);
    setIsCustomized(true);
    setShowAddCustomModal(false);
    setCustomHeadName('');
    setCustomHeadAmount(0);
  };

  // Delete a custom fee head
  const handleDeleteHead = (index: number) => {
    const nextHeads = feeHeads.filter((_, i) => i !== index);
    setFeeHeads(nextHeads);
    setIsCustomized(true);
  };

  // Compute fee totals dynamically
  const totals = useMemo(() => {
    let oneTime = 0;
    let monthly = 0;
    let yearly = 0;

    for (const h of feeHeads) {
      if (!h.selected) continue;
      const amt = Number(h.amount) || 0;
      // Books & Stationery is yearly but paid at admission (for the class joined), so it counts here.
      const isBooks = /\bbooks?\b|stationery/i.test(h.head) && !/\bexam/i.test(h.head);
      if (h.category === 'ONE_TIME' || h.frequency === 'One Time' || isBooks) {
        oneTime += amt;
      } else if (
        h.category === 'MONTHLY' ||
        h.frequency === 'Monthly' ||
        (h.category === 'FACILITY' && h.frequency === 'Monthly')
      ) {
        monthly += amt;
      } else {
        yearly += amt;
      }
    }

    const totalApplicable = oneTime + monthly * 12 + yearly;

    return {
      totalOneTimeFee: oneTime,
      totalMonthlyFee: monthly,
      totalYearlyFee: yearly,
      monthlyPayableAmount: monthly,
      totalApplicableFee: totalApplicable,
    };
  }, [feeHeads]);

  // The enrollment month's fee is paid at admission along with the one-time charges
  const enrollmentForBilling = formData.feeStartDate || formData.enrollmentDate || formData.admissionDate || '';
  const enrollmentMonthLabel = getEnrollmentMonthLabel(enrollmentForBilling) || 'Enrollment month';
  const nextBillDate = getNextMonthlyBillDate(enrollmentForBilling);
  const payableAtAdmission = totals.totalOneTimeFee + totals.monthlyPayableAmount;

  // Synchronize compiled fee profile with parent formData
  useEffect(() => {
    const compiledProfile: StudentFeeProfileData = {
      classFeeConfigId: effectiveConfig?.id || `cfg-${formData.classId}`,
      className,
      section: formData.section || 'A',
      academicSession: effectiveSession,
      feeHeads,
      totalOneTimeFee: totals.totalOneTimeFee,
      totalMonthlyFee: totals.totalMonthlyFee,
      totalYearlyFee: totals.totalYearlyFee,
      totalApplicableFee: totals.totalApplicableFee,
      monthlyPayableAmount: totals.monthlyPayableAmount,
      transportIncluded: !!formData.transportRequired,
      hostelIncluded: !!formData.hostelRequired,
      updatedAt: new Date().toISOString(),
    };

    onChange({
      feeProfile: compiledProfile,
      transportMonthlyFee:
        feeHeads.find((h) => h.head === 'Transport Fee')?.amount || formData.transportMonthlyFee,
      hostelMonthlyFee:
        feeHeads.find((h) => h.head === 'Hostel Residency Fee')?.amount || formData.hostelMonthlyFee,
      messMonthlyFee:
        feeHeads.find((h) => h.head === 'Hostel Mess Fee')?.amount || formData.messMonthlyFee,
    });
  }, [feeHeads, totals, className, formData.section, effectiveSession, effectiveConfig?.id]);

  return (
    <div className="space-y-6 animate-fadeIn text-slate-800">
      {/* Header Banner */}
      <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Step 4: Fee Structure & Facilities Configuration</span>
            </h4>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              {className} • Section {formData.section || 'A'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configured dynamically from Fee Management. Select applicable fee heads and manage transport/hostel facilities for this student.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToClassDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Reset to official class fee schedule"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddCustomModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Custom Head</span>
          </button>
        </div>
      </div>

      {/* Billing Timeline Callout */}
      <div className="p-3 bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">Fee Billing Timeline:</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                Enrollment Date: {formData.enrollmentDate || formData.admissionDate || 'Today'}
              </span>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                Fee Start Date: {formData.feeStartDate || formData.enrollmentDate || formData.admissionDate || 'Today'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {enrollmentMonthLabel} fee is paid at admission. The next monthly bill is added on{' '}
              <strong className="text-slate-800">{nextBillDate || 'the 1st of next month'}</strong>, then on the 1st of every month (due by the 10th).
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-blue-700 block">
            Payable at Admission
          </span>
          <div className="text-lg font-black text-blue-900 mt-0.5">
            ₹{payableAtAdmission.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-blue-600 font-medium">
            One-time ₹{totals.totalOneTimeFee.toLocaleString('en-IN')} + {enrollmentMonthLabel} ₹{totals.monthlyPayableAmount.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-emerald-700 block">
            Monthly Regular Payable
          </span>
          <div className="text-lg font-black text-emerald-900 mt-0.5">
            ₹{totals.monthlyPayableAmount.toLocaleString('en-IN')}
            <span className="text-xs font-semibold text-emerald-700"> / mo</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-medium">Tuition + Logistics + Care</span>
        </div>

        <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-purple-700 block">
            Annual / Exam Dues
          </span>
          <div className="text-lg font-black text-purple-900 mt-0.5">
            ₹{totals.totalYearlyFee.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-purple-600 font-medium">Exam fee added when the Annual Exam is published</span>
        </div>

        <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xs">
          <span className="text-[10px] uppercase font-bold text-amber-300 block">
            Total Applicable Annual Fee
          </span>
          <div className="text-lg font-black text-white mt-0.5">
            ₹{totals.totalApplicableFee.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-300 font-medium">Complete Session Total</span>
        </div>
      </div>

      {/* Facilities Configuration (Transport & Hostel Opt-in Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* School Transport Facility Card */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            formData.transportRequired
              ? 'bg-amber-50/60 border-amber-200 shadow-xs'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <Bus className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                School Bus Facility
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.transportRequired}
                onChange={(e) => handleToggleTransport(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
              />
              <span className="ml-2 text-xs font-bold text-slate-700">
                {formData.transportRequired ? 'Opted In' : 'Opt In'}
              </span>
            </label>
          </div>

          {formData.transportRequired ? (
            <div className="mt-3 space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transit Route</label>
                  <select
                    value={formData.transportRouteId || selectedRoute?.id || ''}
                    onChange={(e) => handleRouteChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                  >
                    {activeRoutes.length === 0 ? (
                      <option value="">No active routes available</option>
                    ) : (
                      activeRoutes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.routeName || r.name} {r.vehicleNumber ? `(${r.vehicleNumber})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designated Bus Stop</label>
                  <select
                    value={formData.transportStopId || formData.transportStopName || ''}
                    onChange={(e) => handleStopChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                  >
                    {availableStops.length === 0 ? (
                      <option value="">No stops configured for this route</option>
                    ) : (
                      availableStops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.stopName} (Pickup: {s.pickupTime}, Drop: {s.dropTime}) — ₹{s.monthlyFare || s.fare || s.fee}/mo
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-amber-200/60 text-slate-600">
                <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                  <span>Bus: <strong>{selectedRoute?.vehicleNumber || formData.vehicleNumber || 'Assigned Bus'}</strong></span>
                  <span>•</span>
                  <span>Driver: <strong>{selectedRoute?.driverName || formData.driverName || 'Assigned Driver'}</strong></span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Monthly Transport Fare:</span>
                  <strong className="text-emerald-800 font-mono font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ₹{Number(formData.transportMonthlyFee || 0).toLocaleString('en-IN')} / mo
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 italic py-2 text-xs">
              Student is designated as a Day Scholar travelling via parent conveyance.
            </p>
          )}
        </div>

        {/* Campus Hostel Residency Card */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            formData.hostelRequired
              ? 'bg-indigo-50/60 border-indigo-200 shadow-xs'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                Campus Hostel Residency
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hostelRequired}
                onChange={(e) => handleToggleHostel(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
              />
              <span className="ml-2 text-xs font-bold text-slate-700">
                {formData.hostelRequired ? 'Opted In' : 'Opt In'}
              </span>
            </label>
          </div>

          {formData.hostelRequired ? (
            <div className="mt-3 space-y-3 text-xs">
              {activeHostels.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No active hostels are set up. Please add hostels in the Hostel module first.</span>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Select Hostel Block</label>
                    <select
                      value={formData.hostelId || activeHostels.find((h) => h.name === formData.hostelName)?.id || ''}
                      onChange={(e) => handleSelectHostel(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                    >
                      {activeHostels.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.type === 'BOYS' ? 'Boys' : 'Girls'} Wing • Warden: {h.wardenName})
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const currentHostelId = formData.hostelId || activeHostels.find((h) => h.name === formData.hostelName)?.id || activeHostels[0]?.id;
                    const hRooms = activeRooms.filter((r) => r.hostelId === currentHostelId);
                    const availableRoomsWithBeds = hRooms.filter((r) =>
                      r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
                    );

                    if (availableRoomsWithBeds.length === 0) {
                      return (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                          <span>No available rooms with free beds in this hostel block. Please select another hostel.</span>
                        </div>
                      );
                    }

                    const selectedRoom = availableRoomsWithBeds.find((r) => r.id === formData.hostelRoomId) || availableRoomsWithBeds[0];
                    const availableBeds = selectedRoom?.beds?.filter(
                      (b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'
                    ) || [];

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Available Room (Only with Free Beds)
                          </label>
                          <select
                            value={selectedRoom?.id || ''}
                            onChange={(e) => handleSelectHostelRoom(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                          >
                            {availableRoomsWithBeds.map((r) => {
                              const freeCount = r.beds?.filter((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE').length || 0;
                              return (
                                <option key={r.id} value={r.id}>
                                  Room {r.roomNumber} (Floor {r.floor} • {r.roomType || 'Standard'} • {freeCount} free)
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Available Bed Identifier
                          </label>
                          <select
                            value={formData.hostelBedNumber || (availableBeds[0]?.bedNumber || '')}
                            onChange={(e) => handleSelectHostelBed(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono font-medium"
                          >
                            {availableBeds.map((b) => (
                              <option key={b.bedNumber} value={b.bedNumber}>
                                {b.bedNumber} (Available)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Room Monthly Rent:</span>
                      <strong className="text-slate-900 font-mono">₹{Number(formData.hostelMonthlyFee || 0).toLocaleString('en-IN')}/mo</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Mess & Dining Charges:</span>
                      <strong className="text-slate-900 font-mono">₹{Number(formData.messMonthlyFee || 0).toLocaleString('en-IN')}/mo</strong>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-indigo-200/60 font-bold text-indigo-900">
                      <span>Total Residential Charges:</span>
                      <span className="font-mono">
                        ₹{Number((formData.hostelMonthlyFee || 0) + (formData.messMonthlyFee || 0)).toLocaleString('en-IN')}/mo
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-slate-500 italic py-2 text-xs">
              Student resides with family in Sheohar area. No hostel allocation will be created.
            </p>
          )}
        </div>
      </div>

      {/* Applicable Class Fee Structure Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
              Applicable Fee Heads & Schedule (Class-Wise Blueprint)
            </h5>
          </div>
          <span className="text-[11px] text-slate-500">
            Check/uncheck fee heads or adjust amounts for individual student scholarship or waivers.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">Apply</th>
                <th className="py-2.5 px-3">Fee Head</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Frequency</th>
                <th className="py-2.5 px-3">Amount (₹)</th>
                <th className="py-2.5 px-3 hidden md:table-cell">Remarks / Description</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {feeHeads.map((head, idx) => (
                <tr
                  key={head.id || `${head.head}-${idx}`}
                  className={`hover:bg-slate-50 transition-colors ${
                    head.selected ? 'bg-white' : 'bg-slate-50/50 text-slate-400'
                  }`}
                >
                  {/* Select Checkbox */}
                  <td className="py-2.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={head.selected}
                      onChange={() => handleToggleHead(idx)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 cursor-pointer focus:ring-emerald-500"
                    />
                  </td>

                  {/* Fee Head Name */}
                  <td className="py-2.5 px-3">
                    <span className={`font-bold ${head.selected ? 'text-slate-900' : 'line-through text-slate-400'}`}>
                      {head.head}
                    </span>
                  </td>

                  {/* Category Badge */}
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        head.category === 'ONE_TIME'
                          ? 'bg-blue-100 text-blue-800'
                          : head.category === 'MONTHLY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : head.category === 'FACILITY'
                          ? 'bg-amber-100 text-amber-800'
                          : head.category === 'EXAMINATION'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {head.category}
                    </span>
                  </td>

                  {/* Frequency */}
                  <td className="py-2.5 px-3 text-slate-600 font-medium">
                    {head.frequency}
                  </td>

                  {/* Amount with editable input */}
                  <td className="py-2.5 px-3">
                    <div className="inline-flex items-center gap-1 font-mono">
                      <span className="text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={head.amount}
                        disabled={!head.selected}
                        onChange={(e) => handleAmountChange(idx, Number(e.target.value))}
                        className={`w-24 px-2 py-1 border rounded text-xs font-bold ${
                          head.selected
                            ? 'border-slate-300 bg-white text-slate-900 focus:ring-1 focus:ring-blue-600'
                            : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      />
                    </div>
                  </td>

                  {/* Remarks */}
                  <td className="py-2.5 px-3 text-slate-500 hidden md:table-cell text-[11px] truncate max-w-xs">
                    {head.remarks || '—'}
                  </td>

                  {/* Action / Delete for custom heads */}
                  <td className="py-2.5 px-3 text-right">
                    {!head.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleDeleteHead(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Remove custom fee head"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Total Fee heads active for this student:{' '}
              <strong className="text-slate-900">{feeHeads.filter((h) => h.selected).length}</strong> of{' '}
              {feeHeads.length}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500 mr-1.5">Monthly Payable:</span>
              <strong className="text-emerald-700 font-mono font-black text-sm">
                ₹{totals.monthlyPayableAmount.toLocaleString('en-IN')}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 mr-1.5">Total Applicable:</span>
              <strong className="text-slate-900 font-mono font-black text-sm">
                ₹{totals.totalApplicableFee.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Add Custom Fee Head Modal */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 uppercase">Add Custom Student Fee Head</h4>
              <button
                type="button"
                onClick={() => setShowAddCustomModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fee Head Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Science Lab Kit, Special Remedial, Dance Class"
                  value={customHeadName}
                  onChange={(e) => setCustomHeadName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={customHeadCategory}
                    onChange={(e) => setCustomHeadCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="ONE_TIME">ONE_TIME</option>
                    <option value="YEARLY">YEARLY</option>
                    <option value="EXAMINATION">EXAMINATION</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Frequency</label>
                  <select
                    value={customHeadFrequency}
                    onChange={(e) => setCustomHeadFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="One Time">One Time</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Half-Yearly">Half-Yearly</option>
                    <option value="Yearly">Yearly</option>
                    <option value="Event/Exam Based">Event/Exam Based</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={customHeadAmount}
                  onChange={(e) => setCustomHeadAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddCustomModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomHead}
                disabled={!customHeadName.trim()}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold"
              >
                Add Fee Head
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
