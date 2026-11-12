import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  Clock,
  Edit2,
  FileCheck,
  MapPin,
  Phone,
  PlusCircle,
  ShieldCheck,
  Trash2,
  Users,
  X,
  Loader2,
  ArrowUp,
  ArrowDown,
  Compass,
  FileText,
  AlertCircle,
  Search,
  UserPlus,
} from 'lucide-react';
import { PersonAvatar } from '../common/PersonAvatar';
import { StudentSearchPicker, classLabel, toPickable, type PickableStudent } from '../common/StudentSearchPicker';
import { RouteStop, TransportDashboardStats, TransportRoute, TransportVehicle } from '../../types';
import { api } from '../../services/api';

const fmtDay = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  return `${Number(m[3])} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1]} ${m[1]}`;
};
/** Certificate state from its expiry date; nothing is assumed when no date is recorded. */
const getExpiryStatus = (dateStr?: string): { label: string; badge: string; isExpired: boolean; isSoon: boolean } => {
  if (!dateStr || !dateStr.trim()) {
    return { label: 'Not recorded', badge: 'bg-slate-50 text-slate-500 border-slate-200', isExpired: false, isSoon: false };
  }
  const expiry = new Date(dateStr);
  if (isNaN(expiry.getTime())) {
    return { label: dateStr, badge: 'bg-slate-50 text-slate-600 border-slate-200', isExpired: false, isSoon: false };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { label: `Expired ${fmtDay(dateStr)}`, badge: 'bg-rose-50 text-rose-700 border-rose-200 font-medium', isExpired: true, isSoon: false };
  }
  if (diffDays <= 30) {
    return { label: diffDays === 0 ? 'Expires today' : `${diffDays} days left`, badge: 'bg-amber-50 text-amber-800 border-amber-200 font-medium', isExpired: false, isSoon: true };
  }
  return { label: `Till ${fmtDay(dateStr)}`, badge: 'bg-emerald-50 text-emerald-800 border-emerald-200', isExpired: false, isSoon: false };
};

export const TransportView: React.FC = () => {
  const [vehicles, setVehicles] = useState<TransportVehicle[]>(() => api.getVehicles());
  const [routes, setRoutes] = useState<TransportRoute[]>(() => api.getRoutes());
  const [students, setStudents] = useState(() => api.getStudents());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'ROUTES' | 'FLEET'>('ROUTES');
  const [selectedRouteId, setSelectedRouteId] = useState<string>(() => routes[0]?.id || '');

  // Modals state
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<TransportVehicle | null>(null);

  const [isRouteModalOpen, setIsRouteModalOpen] = useState<boolean>(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);

  const [isStopModalOpen, setIsStopModalOpen] = useState<boolean>(false);
  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'VEHICLE' | 'ROUTE' | 'STOP';
    id: string;
    subId?: string;
    title: string;
  } | null>(null);

  // Student Allocation State
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState<boolean>(false);
  const [allocStudentId, setAllocStudentId] = useState<string>('');
  const [allocStopId, setAllocStopId] = useState<string>('');
  const [isAllocating, setIsAllocating] = useState<boolean>(false);
  const [deallocConfirm, setDeallocConfirm] = useState<{ studentId: string; studentName: string } | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Vehicle Form State
  const [vehicleForm, setVehicleForm] = useState({
    vehicleNumber: '',
    busName: '',
    busCode: '',
    model: '',
    vehicleType: 'BUS',
    capacity: 40,
    driverName: '',
    driverPhone: '',
    conductorName: '',
    helperPhone: '',
    permitDetails: '',
    rcNumber: '',
    fitnessExpiry: '',
    insuranceExpiry: '',
    permitExpiry: '',
    pollutionExpiry: '',
    status: 'ACTIVE' as 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE',
    gpsDeviceId: '',
  });

  // Route Form State
  const [routeForm, setRouteForm] = useState({
    routeName: '',
    routeNumber: '',
    startPoint: 'Sheohar Zero Mile',
    endPoint: 'School Campus',
    vehicleId: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  // Stop Form State
  const [stopForm, setStopForm] = useState({
    stopName: '',
    landmark: '',
    pickupTime: '07:15 AM',
    dropTime: '02:15 PM',
    monthlyFare: 800,
    stopOrder: 1,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const currentUser = api.getCurrentUser();
  const canManage = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'TRANSPORT_MANAGER', 'PRINCIPAL', 'VICE_PRINCIPAL'].includes(
    currentUser?.role || ''
  );

  const [serverStats, setServerStats] = useState<any>(null);
  const loadTransportData = async () => {
    setIsLoading(true);
    try {
      const data = await api.fetchTransport();
      if (Array.isArray(data.vehicles)) setVehicles(data.vehicles);
      if (Array.isArray(data.routes)) setRoutes(data.routes);
      if (data.stats) setServerStats(data.stats);
      // Passenger lists come from student records, so read them fresh from the server.
      await api.syncStudents().catch(() => undefined);
      setStudents(api.getStudents());
    } catch (err: any) {
      console.warn('Failed to load transport data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransportData();
  }, []);

  // Selected route resolution
  const selectedRoute = useMemo(() => {
    return routes.find((r) => r.id === selectedRouteId) || routes[0] || null;
  }, [routes, selectedRouteId]);

  // Route assigned vehicle resolution
  const assignedVehicle = useMemo(() => {
    if (!selectedRoute) return null;
    return vehicles.find((v) => v.id === selectedRoute.vehicleId || v.vehicleNumber === selectedRoute.vehicleNumber) || null;
  }, [selectedRoute, vehicles]);

  // Students allocated to selected route
  const allocatedStudents = useMemo(() => {
    if (!selectedRoute) return [];
    return students.filter(
      (s) => s.status === 'ACTIVE' && s.transportRequired && (s.transportRouteId === selectedRoute.id || s.transportRouteId === selectedRoute.routeName)
    );
  }, [students, selectedRoute]);

  // Stops in travel order (the server keeps them numbered 1..n).
  const sortedStops = useMemo(
    () => [...(selectedRoute?.stops || [])].sort((a, b) => (Number(a.stopOrder) || 9999) - (Number(b.stopOrder) || 9999)),
    [selectedRoute]
  );

  /** Students riding a vehicle through any of its routes: seats belong to the vehicle, not the route. */
  const ridersOf = (v: TransportVehicle | null) => {
    if (!v) return 0;
    const ids = new Set(routes.filter((r) => r.vehicleId === v.id).map((r) => r.id));
    return students.filter((s) => s.status === 'ACTIVE' && s.transportRequired && ids.has(s.transportRouteId || '')).length;
  };
  const vehicleRiders = ridersOf(assignedVehicle);
  const isBusFull = assignedVehicle ? vehicleRiders >= (Number(assignedVehicle.capacity) || 0) : false;

  // Dynamic Dashboard Stats calculated from live MongoDB data
  const stats: TransportDashboardStats = useMemo(() => {
    const activeVehicles = vehicles.filter((v) => v.status === 'ACTIVE');
    const activeRoutesList = routes.filter((r) => (r.status || 'ACTIVE') === 'ACTIVE');
    let totalStopsCount = 0;
    activeRoutesList.forEach((r) => {
      totalStopsCount += (r.stops || []).filter((s) => s.status !== 'INACTIVE' && s.active !== false).length;
    });

    if (serverStats) return serverStats as TransportDashboardStats;
    const routeKeys = new Set([...routes.map((r) => r.id), ...routes.map((r) => r.routeName).filter(Boolean)]);
    const studentsUsingTransport = students.filter(
      (s) => s.status === 'ACTIVE' && s.transportRequired && routeKeys.has(s.transportRouteId || '')
    ).length;

    const totalCapacity = activeVehicles.reduce((acc, v) => acc + (Number(v.capacity) || 0), 0);
    const taken = activeVehicles.reduce((acc, v) => acc + Math.min(Number(v.capacity) || 0, ridersOf(v)), 0);
    const availableCapacity = Math.max(0, totalCapacity - taken);

    return {
      activeBuses: activeVehicles.length,
      activeRoutes: activeRoutesList.length,
      totalStops: totalStopsCount,
      studentsUsingTransport,
      availableCapacity,
      totalCapacity,
      totalVehicles: vehicles.length,
      totalRoutes: routes.length,
    };
  }, [vehicles, routes, students, serverStats]);

  const showNotification = (msg: string, isErr = false) => {
    if (isErr) {
      setActionError(msg);
      setTimeout(() => setActionError(null), 4000);
    } else {
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 3500);
    }
  };

  // --- Vehicle Handlers ---
  const handleOpenAddVehicle = () => {
    setEditingVehicle(null);
    setVehicleForm({
      vehicleNumber: '',
      busName: '',
      busCode: '',
      model: '',
      vehicleType: 'BUS',
      capacity: 0,
      driverName: '',
      driverPhone: '',
      conductorName: '',
      helperPhone: '',
      permitDetails: '',
      rcNumber: '',
      fitnessExpiry: '',
      insuranceExpiry: '',
      permitExpiry: '',
      pollutionExpiry: '',
      status: 'ACTIVE',
      gpsDeviceId: '',
    });
    setIsVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (v: TransportVehicle) => {
    setEditingVehicle(v);
    setVehicleForm({
      vehicleNumber: v.vehicleNumber || v.registrationNumber || '',
      busName: v.busName || '',
      busCode: v.busCode || '',
      model: v.model || '',
      vehicleType: v.vehicleType || 'BUS',
      capacity: v.capacity || 0,
      driverName: v.driverName || '',
      driverPhone: v.driverPhone || v.driverContact || '',
      conductorName: v.conductorName || v.helperName || '',
      helperPhone: v.helperPhone || '',
      permitDetails: v.permitDetails || '',
      rcNumber: v.rcNumber || '',
      fitnessExpiry: v.fitnessExpiry || '',
      insuranceExpiry: v.insuranceExpiry || '',
      permitExpiry: v.permitExpiry || '',
      pollutionExpiry: v.pollutionExpiry || '',
      status: v.status || 'ACTIVE',
      gpsDeviceId: v.gpsDeviceId || '',
    });
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleForm.vehicleNumber.trim()) {
      showNotification('Vehicle registration number is required.', true);
      return;
    }
    if (!vehicleForm.driverName.trim()) {
      showNotification('Driver name is required.', true);
      return;
    }
    if (!vehicleForm.driverPhone.trim()) {
      showNotification('Driver contact phone is required.', true);
      return;
    }
    if (!(Number(vehicleForm.capacity) > 0)) {
      showNotification('Enter the number of seats.', true);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingVehicle) {
        const updated = await api.updateVehicle(editingVehicle.id, vehicleForm);
        setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
        showNotification(`Vehicle ${updated.vehicleNumber} updated successfully.`);
      } else {
        const created = await api.createVehicle(vehicleForm);
        setVehicles((prev) => [created, ...prev]);
        showNotification(`Vehicle ${created.vehicleNumber} added to fleet.`);
      }
      setIsVehicleModalOpen(false);
      await loadTransportData();
    } catch (err: any) {
      showNotification(err.message || 'Error saving vehicle', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    setIsSubmitting(true);
    try {
      await api.deleteVehicle(id);
      setVehicles((prev) => prev.filter((v) => v.id !== id));
      showNotification('Vehicle deleted from fleet.');
      setDeleteConfirm(null);
      await loadTransportData();
    } catch (err: any) {
      showNotification(err.message || 'Error deleting vehicle', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Route Handlers ---
  const handleOpenAddRoute = () => {
    setEditingRoute(null);
    setRouteForm({
      routeName: '',
      routeNumber: '',
      startPoint: '',
      endPoint: '',
      vehicleId: vehicles.find((v) => v.status === 'ACTIVE')?.id || '',
      status: 'ACTIVE',
    });
    setIsRouteModalOpen(true);
  };

  const handleOpenEditRoute = (r: TransportRoute) => {
    setEditingRoute(r);
    setRouteForm({
      routeName: r.routeName || r.name || '',
      routeNumber: r.routeNumber || '',
      startPoint: r.startPoint || '',
      endPoint: r.endPoint || '',
      vehicleId: r.vehicleId || '',
      status: (r.status as any) || 'ACTIVE',
    });
    setIsRouteModalOpen(true);
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeForm.routeName.trim()) {
      showNotification('Route Name is required.', true);
      return;
    }
    if (!routeForm.startPoint.trim()) {
      showNotification('Starting Point is required.', true);
      return;
    }
    if (!routeForm.endPoint.trim()) {
      showNotification('Destination is required.', true);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingRoute) {
        const updated = await api.updateRoute(editingRoute.id, routeForm);
        setRoutes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        showNotification(`Route ${updated.routeName} updated successfully.`);
      } else {
        const created = await api.createRoute(routeForm);
        setRoutes((prev) => [created, ...prev]);
        setSelectedRouteId(created.id);
        showNotification(`Route ${created.routeName} created successfully.`);
      }
      setIsRouteModalOpen(false);
      await loadTransportData();
    } catch (err: any) {
      showNotification(err.message || 'Error saving route', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoute = async (id: string) => {
    setIsSubmitting(true);
    try {
      await api.deleteRoute(id);
      setRoutes((prev) => prev.filter((r) => r.id !== id));
      if (selectedRouteId === id) {
        setSelectedRouteId(routes.find((r) => r.id !== id)?.id || '');
      }
      showNotification('Route deleted successfully.');
      setDeleteConfirm(null);
      await loadTransportData();
    } catch (err: any) {
      showNotification(err.message || 'Error deleting route', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Stop Handlers ---
  const handleOpenAddStop = () => {
    if (!selectedRoute) return;
    setEditingStop(null);
    const existingStops = selectedRoute.stops || [];
    setStopForm({
      stopName: '',
      landmark: '',
      pickupTime: '',
      dropTime: '',
      monthlyFare: 0,
      stopOrder: existingStops.length + 1,
      status: 'ACTIVE',
    });
    setIsStopModalOpen(true);
  };

  const handleOpenEditStop = (stop: RouteStop) => {
    setEditingStop(stop);
    setStopForm({
      stopName: stop.stopName || stop.name || '',
      landmark: stop.landmark || '',
      pickupTime: stop.pickupTime || '',
      dropTime: stop.dropTime || '',
      monthlyFare: Number(stop.monthlyFare ?? stop.fare ?? stop.fee ?? 0),
      stopOrder: stop.stopOrder || 1,
      status: stop.status || 'ACTIVE',
    });
    setIsStopModalOpen(true);
  };

  const handleSaveStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoute) return;
    if (!stopForm.stopName.trim()) {
      showNotification('Stop Name is required.', true);
      return;
    }
    if (!stopForm.pickupTime.trim()) {
      showNotification('Pickup Time is required.', true);
      return;
    }
    if (!stopForm.dropTime.trim()) {
      showNotification('Drop Time is required.', true);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingStop) {
        const res = await api.updateRouteStop(selectedRoute.id, editingStop.id, stopForm);
        if (res.route) {
          setRoutes((prev) => prev.map((r) => (r.id === res.route.id ? res.route : r)));
        }
        showNotification(`Stop ${stopForm.stopName} updated successfully.`);
      } else {
        const res = await api.addRouteStop(selectedRoute.id, stopForm);
        if (res.route) {
          setRoutes((prev) => prev.map((r) => (r.id === res.route.id ? res.route : r)));
        }
        showNotification(`Stop ${stopForm.stopName} added to route.`);
      }
      setIsStopModalOpen(false);
      await loadTransportData();
    } catch (err: any) {
      showNotification(err.message || 'Error saving stop', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStop = async (routeId: string, stopId: string) => {
    setIsSubmitting(true);
    try {
      const res = await api.deleteRouteStop(routeId, stopId);
      if (res.route) {
        setRoutes((prev) => prev.map((r) => (r.id === res.route.id ? res.route : r)));
      }
      showNotification('Stop deleted from route.');
      setDeleteConfirm(null);
      await loadTransportData();
    } catch (err: any) {
      showNotification(err.message || 'Error deleting stop', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveStop = async (idx: number, direction: 'UP' | 'DOWN') => {
    if (!selectedRoute || !selectedRoute.stops) return;
    const stopsList = [...sortedStops];
    const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= stopsList.length) return;

    // Swap
    const temp = stopsList[idx];
    stopsList[idx] = stopsList[targetIdx];
    stopsList[targetIdx] = temp;

    const stopIds = stopsList.map((s) => s.id);
    try {
      const updatedRoute = await api.reorderRouteStops(selectedRoute.id, stopIds);
      setRoutes((prev) => prev.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)));
    } catch (err: any) {
      showNotification(err.message || 'Failed to reorder stops', true);
    }
  };

  // --- Student Allocation Handlers ---
  const handleOpenAllocateModal = () => {
    setAllocStudentId('');
    const firstStop = sortedStops.find((s) => s.status !== 'INACTIVE' && s.active !== false);
    setAllocStopId(firstStop?.id || '');
    setIsAllocateModalOpen(true);
  };

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoute || !allocStudentId || !allocStopId) return;
    const targetStop = (selectedRoute.stops || []).find((s) => s.id === allocStopId);
    if (!targetStop) return;
    setIsAllocating(true);
    try {
      await api.allocateTransport(allocStudentId, selectedRoute.id, targetStop.stopName, targetStop.id);
      setIsAllocateModalOpen(false);
      showNotification(`Student successfully allocated to ${selectedRoute.routeName} at ${targetStop.stopName}!`);
      setStudents(api.getStudents());
      await loadTransportData();
    } catch (err: any) {
      showNotification(err?.message || 'Failed to allocate student to route', true);
    } finally {
      setIsAllocating(false);
    }
  };

  const handleDeallocateStudent = async (studentId: string, studentName: string) => {
    try {
      await api.deallocateTransport(studentId);
      setDeallocConfirm(null);
      showNotification(`Transport removed for ${studentName}.`);
      setStudents(api.getStudents());
      await loadTransportData();
    } catch (err: any) {
      showNotification(err?.message || 'Failed to deallocate student', true);
    }
  };

  const vNo = (v?: TransportVehicle | null) => (v ? v.vehicleNumber || v.registrationNumber || '' : '');
  const stopIdsOnRoute = new Set(sortedStops.map((x) => x.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900 flex items-center gap-2">
          Transport {isLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin motion-reduce:animate-none" aria-label="Loading" />}
        </h2>
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-sm" role="tablist" aria-label="Transport">
          {(
            [
              ['ROUTES', 'Routes'],
              ['FLEET', 'Vehicles'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`h-9 px-4 rounded-lg ${activeTab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="space-y-2">
        {actionError && (
          <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />{actionError}</span>
            <button onClick={() => setActionError(null)} aria-label="Dismiss"><X className="w-4 h-4" /></button>
          </div>
        )}
        {actionSuccess && (
          <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />{actionSuccess}</span>
            <button onClick={() => setActionSuccess(null)} aria-label="Dismiss"><X className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: 'Students on routes', value: stats.studentsUsingTransport, sub: (stats as any).unassignedTransportStudents ? `${(stats as any).unassignedTransportStudents} need a route` : 'All placed on a route', warn: Boolean((stats as any).unassignedTransportStudents) },
          { label: 'Free seats', value: stats.availableCapacity, sub: `of ${stats.totalCapacity} seats in active vehicles` },
          { label: 'Routes', value: stats.activeRoutes, sub: `${stats.totalStops} stops · ${stats.totalRoutes - stats.activeRoutes} inactive` },
          { label: 'Vehicles', value: stats.activeBuses, sub: `active of ${stats.totalVehicles}` },
        ].map((c) => (
          <div key={c.label} className="p-3.5 bg-white rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums">{c.value}</p>
            <p className={`text-xs ${c.warn ? 'text-amber-700' : 'text-slate-500'}`}>{c.sub}</p>
          </div>
        ))}
      </div>

      {activeTab === 'ROUTES' ? (
        routes.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
            <Bus className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-800">No routes yet</p>
            {canManage && (
              <button type="button" onClick={handleOpenAddRoute} className="text-sm font-medium text-blue-700 hover:underline">
                Add the first route
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">Routes ({routes.length})</h3>
                {canManage && (
                  <button type="button" onClick={handleOpenAddRoute} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                    <PlusCircle className="w-4 h-4" aria-hidden="true" /> Add route
                  </button>
                )}
              </div>
              <ul className="divide-y divide-slate-100">
                {routes.map((rt) => {
                  const isSelected = selectedRoute ? rt.id === selectedRoute.id : false;
                  const vehicle = vehicles.find((v) => v.id === rt.vehicleId);
                  return (
                    <li key={rt.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedRouteId(rt.id)}
                        aria-current={isSelected}
                        className={`w-full text-left px-4 py-3 ${isSelected ? 'bg-blue-50/70 border-l-2 border-blue-700' : 'hover:bg-slate-50 border-l-2 border-transparent'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">{rt.routeName || rt.name}</p>
                          {rt.status === 'INACTIVE' && <span className="text-xs text-slate-500 shrink-0">Inactive</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {(rt.stops || []).length} stops · {rt.assignedStudentsCount || 0} students · {vNo(vehicle) || 'No vehicle'}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {selectedRoute && (
              <div className="bg-white rounded-xl border border-slate-200 lg:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-4 py-3 border-b border-slate-100">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      {selectedRoute.routeName || selectedRoute.name}
                      {selectedRoute.status === 'INACTIVE' && <span className="text-xs font-normal text-slate-500">Inactive</span>}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[selectedRoute.startPoint, selectedRoute.endPoint].filter(Boolean).join(' → ') || 'Start and end not recorded'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {assignedVehicle ? (
                        <>
                          {vNo(assignedVehicle)} · {assignedVehicle.driverName || 'Driver not recorded'}
                          {assignedVehicle.driverPhone ? ` · ${assignedVehicle.driverPhone}` : ''}
                        </>
                      ) : (
                        <span className="text-amber-700">No vehicle assigned</span>
                      )}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => handleOpenEditRoute(selectedRoute)} className="h-9 px-3 rounded-xl border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
                        <Edit2 className="w-4 h-4" aria-hidden="true" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ type: 'ROUTE', id: selectedRoute.id, title: `Route: ${selectedRoute.routeName || selectedRoute.name}` })}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                        aria-label="Delete route"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Stops */}
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-800">Stops in order</h4>
                    {canManage && (
                      <button type="button" onClick={handleOpenAddStop} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                        <PlusCircle className="w-4 h-4" aria-hidden="true" /> Add stop
                      </button>
                    )}
                  </div>
                  {sortedStops.length === 0 ? (
                    <p className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl px-4 py-5 text-center">No stops on this route yet.</p>
                  ) : (
                    <ol className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {sortedStops.map((stop, idx) => (
                        <li key={stop.id || idx} className="flex items-center gap-3 px-3 py-2.5">
                          <span className="w-6 h-6 shrink-0 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center tabular-nums">{idx + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {stop.stopName || stop.name}
                              {stop.status === 'INACTIVE' && <span className="ml-2 text-xs font-normal text-slate-500">Inactive</span>}
                            </p>
                            <p className="text-xs text-slate-500 tabular-nums">
                              {[stop.landmark, stop.pickupTime && `Pickup ${stop.pickupTime}`, stop.dropTime && `Drop ${stop.dropTime}`, `₹${Number(stop.monthlyFare ?? stop.fare ?? stop.fee ?? 0).toLocaleString('en-IN')}/month`]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          {canManage && (
                            <div className="flex items-center shrink-0">
                              <button type="button" disabled={idx === 0} onClick={() => handleMoveStop(idx, 'UP')} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${stop.stopName} earlier`}>
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button type="button" disabled={idx === sortedStops.length - 1} onClick={() => handleMoveStop(idx, 'DOWN')} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${stop.stopName} later`}>
                                <ArrowDown className="w-4 h-4" />
                              </button>
                              <button type="button" onClick={() => handleOpenEditStop(stop)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={`Edit ${stop.stopName}`}>
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm({ type: 'STOP', id: selectedRoute.id, subId: stop.id, title: `Stop: ${stop.stopName}` })}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                                aria-label={`Delete ${stop.stopName}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {/* Passengers */}
                <div className="px-4 py-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-slate-800">Students ({allocatedStudents.length})</h4>
                    {canManage && (
                      <button
                        type="button"
                        onClick={handleOpenAllocateModal}
                        disabled={sortedStops.length === 0 || isBusFull || selectedRoute.status === 'INACTIVE'}
                        title={sortedStops.length === 0 ? 'Add a stop first' : isBusFull ? 'The vehicle is full' : undefined}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold disabled:opacity-40"
                      >
                        <UserPlus className="w-4 h-4" aria-hidden="true" /> Add student
                      </button>
                    )}
                  </div>
                  {assignedVehicle && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Seats in {vNo(assignedVehicle)}{routes.filter((r) => r.vehicleId === assignedVehicle.id).length > 1 ? ' (shared with other routes)' : ''}</span>
                        <span className={`tabular-nums font-medium ${isBusFull ? 'text-rose-700' : 'text-slate-800'}`}>
                          {vehicleRiders} / {assignedVehicle.capacity}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isBusFull ? 'bg-rose-600' : 'bg-blue-700'}`}
                          style={{ width: `${Math.min(100, Math.round((vehicleRiders / Math.max(1, Number(assignedVehicle.capacity) || 1)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {allocatedStudents.length === 0 ? (
                    <p className="text-sm text-slate-500 py-3">No students on this route yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {allocatedStudents.map((st) => {
                        const stopKnown = Boolean(st.transportStopId && stopIdsOnRoute.has(st.transportStopId)) || sortedStops.some((x) => (x.stopName || x.name) === st.transportStopName);
                        return (
                          <li key={st.id} className="flex items-center gap-3 px-3 py-2.5">
                            <PersonAvatar name={st.name} photo={st.photoFileKey || st.photo} size={36} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {st.name} <span className="font-normal text-slate-500">· {[st.className, st.section].filter(Boolean).join(' ')}</span>
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {stopKnown ? (
                                  st.transportStopName
                                ) : (
                                  <span className="text-amber-700">{st.transportStopName ? `“${st.transportStopName}” is not a stop on this route` : 'No stop chosen'}</span>
                                )}
                                {' · '}₹{Number(st.transportMonthlyFee || 0).toLocaleString('en-IN')}/month
                                {st.primaryPhone || st.parentPhone ? ` · ${st.primaryPhone || st.parentPhone}` : ''}
                              </p>
                            </div>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => setDeallocConfirm({ studentId: st.id, studentName: st.name })}
                                className="h-8 px-2 text-sm text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0"
                              >
                                Remove
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      ) : null}

      {activeTab === 'FLEET' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Vehicles ({vehicles.length})</h3>
            {canManage && (
              <button type="button" onClick={handleOpenAddVehicle} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold">
                <PlusCircle className="w-4 h-4" aria-hidden="true" /> Add vehicle
              </button>
            )}
          </div>

          {vehicles.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
              <Bus className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-800">No vehicles yet</p>
              {canManage && (
                <button type="button" onClick={handleOpenAddVehicle} className="text-sm font-medium text-blue-700 hover:underline">
                  Add the first vehicle
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {vehicles.map((v) => {
                const certs = [
                  ['Fitness', getExpiryStatus(v.fitnessExpiry)],
                  ['Insurance', getExpiryStatus(v.insuranceExpiry)],
                  ['Permit', getExpiryStatus(v.permitExpiry)],
                  ['Pollution (PUC)', getExpiryStatus(v.pollutionExpiry)],
                ] as const;
                const vRoutes = routes.filter((r) => r.vehicleId === v.id);
                const riders = ridersOf(v);
                const title = [v.busName, v.model].filter(Boolean).join(' · ') || (v.vehicleType === 'VAN' ? 'Van' : 'Bus');
                return (
                  <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{vNo(v)}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {title}
                          {v.busCode ? ` · ${v.busCode}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${
                            v.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : v.status === 'MAINTENANCE' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-slate-100 text-slate-700 ring-slate-300'
                          }`}
                        >
                          {v.status === 'ACTIVE' ? 'Active' : v.status === 'MAINTENANCE' ? 'Maintenance' : 'Inactive'}
                        </span>
                        {canManage && (
                          <>
                            <button type="button" onClick={() => handleOpenEditVehicle(v)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={`Edit ${vNo(v)}`}>
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm({ type: 'VEHICLE', id: v.id, title: `Vehicle: ${vNo(v)}` })}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                              aria-label={`Delete ${vNo(v)}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500">Driver</dt>
                        <dd className="text-slate-900">{v.driverName || 'Not recorded'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Driver phone</dt>
                        <dd className="text-slate-900 tabular-nums">{v.driverPhone || v.driverContact || 'Not recorded'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Seats</dt>
                        <dd className="text-slate-900 tabular-nums">
                          {riders} of {v.capacity} taken
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Routes</dt>
                        <dd className="text-slate-900 truncate">{vRoutes.length ? vRoutes.map((r) => r.routeName).join(', ') : 'None'}</dd>
                      </div>
                      {v.gpsDeviceId ? (
                        <div>
                          <dt className="text-xs text-slate-500">GPS device ID</dt>
                          <dd className="text-slate-900 font-mono text-xs">{v.gpsDeviceId}</dd>
                        </div>
                      ) : null}
                      {v.rcNumber ? (
                        <div>
                          <dt className="text-xs text-slate-500">RC number</dt>
                          <dd className="text-slate-900 font-mono text-xs">{v.rcNumber}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <div className="grid grid-cols-2 gap-1.5">
                      {certs.map(([name, st]) => (
                        <div key={name} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
                          <span className="text-xs text-slate-600">{name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[11px] border ${st.badge}`}>{st.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* --- MODAL: Add / Edit Vehicle --- */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl my-6 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold">
                {editingVehicle ? 'Edit Transport Vehicle' : 'Register New Fleet Vehicle'}
              </h3>
              <button
                onClick={() => setIsVehicleModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vehicle Number / Registration *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BR-06-P-6401"
                    value={vehicleForm.vehicleNumber}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bus Name / Code</label>
                  <input
                    type="text"
                    placeholder="e.g. Campus Bus 01"
                    value={vehicleForm.busName}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, busName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vehicle Model</label>
                  <input
                    type="text"
                    placeholder="e.g. Tata Starbus 45S"
                    value={vehicleForm.model}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Passenger Capacity (Seats) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={vehicleForm.capacity}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Driver Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Driver's Full Name"
                    value={vehicleForm.driverName}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, driverName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Driver Contact Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876500111"
                    value={vehicleForm.driverPhone}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, driverPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Conductor / Helper Name</label>
                  <input
                    type="text"
                    placeholder="Conductor Name"
                    value={vehicleForm.conductorName}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, conductorName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fleet Operational Status</label>
                  <select
                    value={vehicleForm.status}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">UNDER MAINTENANCE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RC / Registration Details</label>
                  <input
                    type="text"
                    placeholder="e.g. RC-BR06-6401"
                    value={vehicleForm.rcNumber}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, rcNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Commercial Permit Details</label>
                  <input
                    type="text"
                    placeholder="e.g. BR-COMM-2024-8841"
                    value={vehicleForm.permitDetails}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, permitDetails: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-2">
                  Statutory Expiry Dates
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Fitness Certificate Expiry</label>
                    <input
                      type="date"
                      value={vehicleForm.fitnessExpiry}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, fitnessExpiry: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Insurance Policy Expiry</label>
                    <input
                      type="date"
                      value={vehicleForm.insuranceExpiry}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceExpiry: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Permit Expiry Date</label>
                    <input
                      type="date"
                      value={vehicleForm.permitExpiry}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, permitExpiry: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pollution (PUC) Expiry</label>
                    <input
                      type="date"
                      value={vehicleForm.pollutionExpiry}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, pollutionExpiry: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Vehicle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Add / Edit Route --- */}
      {isRouteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl my-6 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold">
                {editingRoute ? 'Edit Transit Route' : 'Create New Transit Route'}
              </h3>
              <button
                onClick={() => setIsRouteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoute} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Route Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Route 1: Sheohar Town — Kushahar — School Campus"
                  value={routeForm.routeName}
                  onChange={(e) => setRouteForm({ ...routeForm, routeName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Starting Point *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sheohar Zero Mile"
                    value={routeForm.startPoint}
                    onChange={(e) => setRouteForm({ ...routeForm, startPoint: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination / School *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. School Campus"
                    value={routeForm.endPoint}
                    onChange={(e) => setRouteForm({ ...routeForm, endPoint: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Fleet Vehicle</label>
                  <select
                    value={routeForm.vehicleId}
                    onChange={(e) => setRouteForm({ ...routeForm, vehicleId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium bg-white"
                  >
                    <option value="">-- No Bus Assigned --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleNumber} ({v.busName || v.model || 'Bus'}) - Driver: {v.driverName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Route Status</label>
                  <select
                    value={routeForm.status}
                    onChange={(e) => setRouteForm({ ...routeForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRouteModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Route</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Add / Edit Stop --- */}
      {isStopModalOpen && selectedRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg my-6 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold">
                  {editingStop ? 'Edit Stop' : 'Add Stop to Route'}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">{selectedRoute.routeName}</p>
              </div>
              <button
                onClick={() => setIsStopModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStop} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Stop Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Road Crossing"
                  value={stopForm.stopName}
                  onChange={(e) => setStopForm({ ...stopForm, stopName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Landmark (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Near Sadar Hospital Gate"
                  value={stopForm.landmark}
                  onChange={(e) => setStopForm({ ...stopForm, landmark: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pickup time *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 07:15 AM"
                    value={stopForm.pickupTime}
                    onChange={(e) => setStopForm({ ...stopForm, pickupTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Drop time *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 02:15 PM"
                    value={stopForm.dropTime}
                    onChange={(e) => setStopForm({ ...stopForm, dropTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monthly fare (₹)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={stopForm.monthlyFare}
                    onChange={(e) => setStopForm({ ...stopForm, monthlyFare: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={stopForm.status}
                    onChange={(e) => setStopForm({ ...stopForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsStopModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Stop</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Delete Confirmation --- */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-100 text-red-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Confirm Deletion</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete <strong className="text-slate-800">{deleteConfirm.title}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  if (deleteConfirm.type === 'VEHICLE') {
                    handleDeleteVehicle(deleteConfirm.id);
                  } else if (deleteConfirm.type === 'ROUTE') {
                    handleDeleteRoute(deleteConfirm.id);
                  } else if (deleteConfirm.type === 'STOP' && deleteConfirm.subId) {
                    handleDeleteStop(deleteConfirm.id, deleteConfirm.subId);
                  }
                }}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Allocate Student to Route --- */}
      {isAllocateModalOpen && selectedRoute && (() => {
        const availableStops = sortedStops.filter((s) => s.status !== 'INACTIVE' && s.active !== false);
        const selectedStop = availableStops.find((s) => s.id === allocStopId) || availableStops[0];
        const fare = Number(selectedStop?.monthlyFare ?? selectedStop?.fare ?? selectedStop?.fee ?? 0);

        // Active students, with their photo, for the search picker
        const candidateStudents: PickableStudent[] = students
          .filter((s) => s.status === 'ACTIVE')
          .map((s) => ({ ...toPickable(s), note: s.transportRequired ? 'Currently on a bus route' : undefined }));
        const chosenStudent = candidateStudents.find((s) => s.id === allocStudentId);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-purple-600" />
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Allocate Student to Route</h3>
                    <p className="text-xs text-slate-500">{selectedRoute.routeName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAllocateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isBusFull && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    Warning: Bus <strong>{assignedVehicle?.vehicleNumber}</strong> has reached full capacity ({assignedVehicle?.capacity} seats).
                  </span>
                </div>
              )}

              <form onSubmit={handleAllocateSubmit} className="space-y-4 text-xs">
                {/* Student Selection with Search */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Search & Select Student</label>
                  {chosenStudent ? (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-purple-200 bg-purple-50/60">
                      <PersonAvatar name={chosenStudent.name} photo={chosenStudent.photo} size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900 truncate">{chosenStudent.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {[classLabel(chosenStudent), chosenStudent.admissionNumber, chosenStudent.fatherName && `Father: ${chosenStudent.fatherName}`].filter(Boolean).join(' · ')}
                        </div>
                        {chosenStudent.note && <div className="text-[11px] font-semibold text-amber-700">{chosenStudent.note}</div>}
                      </div>
                      <button type="button" onClick={() => setAllocStudentId('')} className="px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                        Change
                      </button>
                    </div>
                  ) : (
                    <StudentSearchPicker
                      autoFocus
                      students={candidateStudents}
                      onSelect={(st) => setAllocStudentId(st.id)}
                      placeholder="Type student name, admission no., class or father’s name"
                    />
                  )}
                </div>

                {/* Designated Stop */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designated Bus Stop</label>
                  <select
                    value={allocStopId}
                    onChange={(e) => setAllocStopId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                    required
                  >
                    {availableStops.length === 0 ? (
                      <option value="">No stops configured for this route</option>
                    ) : (
                      availableStops.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.stopName} (Pickup: {sp.pickupTime}, Drop: {sp.dropTime}) — ₹{Number(sp.monthlyFare ?? sp.fare ?? sp.fee ?? 0).toLocaleString('en-IN')}/mo
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Summary Card */}
                {selectedRoute && (
                  <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg space-y-1.5 text-[11px] text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bus / Vehicle:</span>
                      <strong className="font-mono text-slate-900">{selectedRoute.vehicleNumber || 'No Bus Assigned'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Driver & Contact:</span>
                      <strong className="text-slate-900">{selectedRoute.driverName || 'N/A'} {selectedRoute.driverPhone ? `(${selectedRoute.driverPhone})` : ''}</strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-purple-200/60 font-semibold">
                      <span className="text-slate-600">Monthly Transport Fare:</span>
                      <strong className="text-emerald-800 font-mono text-xs">₹{fare.toLocaleString('en-IN')} / mo</strong>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAllocateModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAllocating || !allocStudentId || !allocStopId}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isAllocating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Allocate Student</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* --- MODAL: Deallocate Student Confirmation --- */}
      {deallocConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-amber-100 text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Remove Transport Allocation</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to remove school bus transport for <strong className="text-slate-800">{deallocConfirm.studentName}</strong>? The student will be marked as a Day Scholar and their Transport Fee head will be deactivated in their fee profile.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setDeallocConfirm(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeallocateStudent(deallocConfirm.studentId, deallocConfirm.studentName)}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
