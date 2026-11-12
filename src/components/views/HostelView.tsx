import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  Bed,
  Building2,
  CheckCircle2,
  Clock,
  DoorOpen,
  Edit2,
  Layers,
  LogOut,
  Phone,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Hostel, HostelRoom, HostelBed, HostelAllocation, Student } from '../../types';
import { api } from '../../services/api';
import { authService } from '../../services/authService';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const HostelView: React.FC = () => {
  const [hostels, setHostels] = useState<Hostel[]>(() => api.getHostels());
  const [rooms, setRooms] = useState<HostelRoom[]>(() => api.getHostelRooms());
  const [allocations, setAllocations] = useState<HostelAllocation[]>(() => api.getHostelAllocations());
  const [students, setStudents] = useState<Student[]>(() => api.getStudents());
  const [loading, setLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Active hostel & floor filters
  const [selectedHostelId, setSelectedHostelId] = useState<string>(() => hostels[0]?.id || '');
  const [selectedFloor, setSelectedFloor] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isHostelModalOpen, setIsHostelModalOpen] = useState(false);
  const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);

  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [newFloorNumber, setNewFloorNumber] = useState<number>(1);

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<HostelRoom | null>(null);

  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [allocateStudentId, setAllocateStudentId] = useState('');
  const [allocateRoomId, setAllocateRoomId] = useState('');
  const [allocateBedNumber, setAllocateBedNumber] = useState('');
  const [allocateRemarks, setAllocateRemarks] = useState('');

  const [isVacateModalOpen, setIsVacateModalOpen] = useState(false);
  const [vacatingStudent, setVacatingStudent] = useState<{ id: string; name: string; roomNumber: string; bedNumber: string } | null>(null);
  const [vacateRemarks, setVacateRemarks] = useState('Vacated by warden');

  const [isChangeBedModalOpen, setIsChangeBedModalOpen] = useState(false);
  const [changeStudent, setChangeStudent] = useState<{ id: string; name: string; currentRoomNumber: string; currentBedNumber: string } | null>(null);
  const [changeTargetRoomId, setChangeTargetRoomId] = useState('');
  const [changeTargetBedNumber, setChangeTargetBedNumber] = useState('');
  const [changeRemarks, setChangeRemarks] = useState('Room reassignment');

  // Form states for Hostel create/edit
  const [hostelForm, setHostelForm] = useState({
    name: '',
    type: 'BOYS' as 'BOYS' | 'GIRLS' | 'CO_ED',
    wardenName: '',
    wardenPhone: '',
    emergencyPhone: '',
    monthlyFee: 0,
    messFee: 0,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    floorsCount: 3,
  });

  // Form states for Room create/edit
  const [roomForm, setRoomForm] = useState({
    hostelId: '',
    floor: 1,
    roomNumber: '',
    roomType: 'Standard',
    monthlyFee: 0,
    bedCount: 2,
    bedIdentifiers: 'Bed A, Bed B',
    status: 'AVAILABLE' as 'AVAILABLE' | 'OCCUPIED' | 'FULL' | 'MAINTENANCE' | 'INACTIVE',
  });

  const currentUser = authService.getCurrentUser();
  // Same roles the server accepts for hostel changes.
  const canManage = Boolean(currentUser) && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'HOSTEL_WARDEN', 'ADMIN', 'VICE_PRINCIPAL'].includes(currentUser!.role);

  // One confirmation dialog for every destructive action.
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; confirmLabel: string; run: () => Promise<void> } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const askConfirm = (c: { title: string; message: string; confirmLabel: string; run: () => Promise<void> }) => {
    setConfirmError(null);
    setConfirmState(c);
  };
  const runConfirm = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await confirmState.run();
      setConfirmState(null);
    } catch (err: any) {
      setConfirmError(err?.message || 'That did not work. Please try again.');
    } finally {
      setConfirmBusy(false);
    }
  };

  // Sync data on mount
  const refreshData = async () => {
    setLoading(true);
    try {
      await api.syncHostel();
      setHostels(api.getHostels());
      setRooms(api.getHostelRooms());
      setAllocations(api.getHostelAllocations());
      setStudents(api.getStudents());
    } catch {
      // Ignore network sync error and rely on cache
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Update selected hostel if needed
  useEffect(() => {
    if (hostels.length > 0 && (!selectedHostelId || !hostels.some((h) => h.id === selectedHostelId))) {
      setSelectedHostelId(hostels[0].id);
    }
  }, [hostels, selectedHostelId]);

  const activeHostel = hostels.find((h) => h.id === selectedHostelId) || hostels[0];

  // Global & Hostel-specific calculations
  const totalHostels = hostels.length;
  const allFloorsSet = new Set<string>();
  hostels.forEach((h) => {
    (h.floors || [1]).forEach((fl) => allFloorsSet.add(`${h.id}-${fl}`));
  });
  rooms.forEach((r) => allFloorsSet.add(`${r.hostelId}-${r.floor || 1}`));
  const totalFloors = allFloorsSet.size;

  const totalRooms = rooms.length;
  const allBeds = rooms.flatMap((r) => r.beds || []);
  const totalBeds = allBeds.length;
  const occupiedBeds = allBeds.filter((b) => Boolean(b.allocatedStudentId)).length;
  const availableBeds = allBeds.filter((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE').length;
  const overallOccupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Active Hostel rooms and floors
  const activeHostelRooms = rooms.filter((r) => r.hostelId === selectedHostelId);
  const activeHostelFloors = Array.from(
    new Set([
      ...(activeHostel?.floors || []),
      ...activeHostelRooms.map((r) => r.floor || 1),
    ])
  ).sort((a, b) => a - b);

  // Active hostel bed metrics
  const activeHostelBeds = activeHostelRooms.flatMap((r) => r.beds || []);
  const activeHostelTotalBeds = activeHostelBeds.length;
  const activeHostelOccupiedBeds = activeHostelBeds.filter((b) => Boolean(b.allocatedStudentId)).length;
  const activeHostelAvailableBeds = activeHostelBeds.filter(
    (b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'
  ).length;
  const activeHostelOccupancyPct =
    activeHostelTotalBeds > 0 ? Math.round((activeHostelOccupiedBeds / activeHostelTotalBeds) * 100) : 0;

  // Filtered rooms for the matrix
  const filteredRooms = activeHostelRooms
    .filter((r) => selectedFloor === 'ALL' || r.floor === selectedFloor)
    .filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchRoom = r.roomNumber.toLowerCase().includes(q) || (r.roomType || '').toLowerCase().includes(q);
      const matchBedStudent = r.beds?.some(
        (b) =>
          b.bedNumber.toLowerCase().includes(q) ||
          (b.allocatedStudentName || '').toLowerCase().includes(q) ||
          (b.allocatedAdmissionNo || '').toLowerCase().includes(q)
      );
      return matchRoom || matchBedStudent;
    });

  // Notifications helper
  const showSuccess = (msg: string) => {
    setActionSuccessMsg(msg);
    setActionErrorMsg(null);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };
  const showError = (msg: string) => {
    setActionErrorMsg(msg);
    setActionSuccessMsg(null);
    setTimeout(() => setActionErrorMsg(null), 5000);
  };

  // Open Create/Edit Hostel Modal
  const handleOpenHostelModal = (hostelToEdit?: Hostel) => {
    if (hostelToEdit) {
      setEditingHostel(hostelToEdit);
      setHostelForm({
        name: hostelToEdit.name,
        type: hostelToEdit.type,
        wardenName: hostelToEdit.wardenName,
        wardenPhone: hostelToEdit.wardenPhone,
        emergencyPhone: hostelToEdit.emergencyPhone || hostelToEdit.wardenPhone,
        monthlyFee: hostelToEdit.monthlyFee || 3500,
        messFee: hostelToEdit.messFee || 2500,
        status: (hostelToEdit.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE',
        floorsCount: hostelToEdit.floors?.length || 3,
      });
    } else {
      setEditingHostel(null);
      setHostelForm({
        name: '',
        type: 'BOYS',
        wardenName: '',
        wardenPhone: '',
        emergencyPhone: '',
        monthlyFee: 3500,
        messFee: 2500,
        status: 'ACTIVE',
        floorsCount: 3,
      });
    }
    setIsHostelModalOpen(true);
  };

  // Submit Hostel Save
  const handleSaveHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostelForm.name.trim() || !hostelForm.wardenName.trim() || !hostelForm.wardenPhone.trim()) {
      showError('Please fill in Hostel Name, Warden Name and Warden Phone.');
      return;
    }

    try {
      const floors = Array.from({ length: Math.max(1, hostelForm.floorsCount) }, (_, i) => i + 1);
      if (editingHostel) {
        await api.updateHostel(editingHostel.id, {
          name: hostelForm.name.trim(),
          type: hostelForm.type,
          wardenName: hostelForm.wardenName.trim(),
          wardenPhone: hostelForm.wardenPhone.trim(),
          emergencyPhone: hostelForm.emergencyPhone.trim() || hostelForm.wardenPhone.trim(),
          monthlyFee: Number(hostelForm.monthlyFee) || 0,
          messFee: Number(hostelForm.messFee) || 0,
          status: hostelForm.status,
          floors: editingHostel.floors && editingHostel.floors.length >= floors.length ? editingHostel.floors : floors,
        });
        showSuccess(`Hostel ${hostelForm.name} updated successfully.`);
      } else {
        const created = await api.createHostel({
          name: hostelForm.name.trim(),
          type: hostelForm.type,
          wardenName: hostelForm.wardenName.trim(),
          wardenPhone: hostelForm.wardenPhone.trim(),
          emergencyPhone: hostelForm.emergencyPhone.trim() || hostelForm.wardenPhone.trim(),
          monthlyFee: Number(hostelForm.monthlyFee) || 0,
          messFee: Number(hostelForm.messFee) || 0,
          status: hostelForm.status,
          floors,
          totalRooms: 0,
        });
        setSelectedHostelId(created.id);
        showSuccess(`Hostel ${created.name} created successfully.`);
      }
      setIsHostelModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showError(err.message || 'Failed to save hostel.');
    }
  };

  // Delete Hostel
  const handleDeleteHostel = async (h: Hostel) => {
    const hasOccupancy = rooms.some(
      (r) => r.hostelId === h.id && r.beds?.some((b) => Boolean(b.allocatedStudentId))
    );
    if (hasOccupancy) {
      showError(`Cannot delete ${h.name} because it has students residing in allocated beds.`);
      return;
    }
    askConfirm({
      title: `Delete ${h.name}?`,
      message: 'The hostel and its empty rooms will be removed. This cannot be undone.',
      confirmLabel: 'Delete hostel',
      run: async () => {
        await api.deleteHostel(h.id);
        showSuccess(`${h.name} was deleted.`);
        await refreshData();
      },
    });
  };

  // Add Floor to Hostel
  const handleAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHostel) return;
    try {
      await api.addHostelFloor(activeHostel.id, Number(newFloorNumber));
      showSuccess(`Floor ${newFloorNumber} added to ${activeHostel.name}.`);
      setIsFloorModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showError(err.message || 'Failed to add floor.');
    }
  };

  // Open Room Modal
  const handleOpenRoomModal = (roomToEdit?: HostelRoom) => {
    if (!activeHostel) return;
    if (roomToEdit) {
      setEditingRoom(roomToEdit);
      const bedNames = (roomToEdit.beds || []).map((b) => b.bedNumber).join(', ');
      setRoomForm({
        hostelId: roomToEdit.hostelId,
        floor: roomToEdit.floor || 1,
        roomNumber: roomToEdit.roomNumber,
        roomType: roomToEdit.roomType || 'Standard',
        monthlyFee: roomToEdit.monthlyFee || activeHostel.monthlyFee || 3500,
        bedCount: (roomToEdit.beds || []).length || roomToEdit.capacity || 2,
        bedIdentifiers: bedNames || 'Bed A, Bed B',
        status: (roomToEdit.status as any) || 'AVAILABLE',
      });
    } else {
      setEditingRoom(null);
      const defaultFloor = selectedFloor === 'ALL' ? (activeHostelFloors[0] || 1) : selectedFloor;
      const countOnFloor = activeHostelRooms.filter((r) => r.floor === defaultFloor).length + 1;
      const suggestedNum = `${defaultFloor}0${countOnFloor}`;
      setRoomForm({
        hostelId: activeHostel.id,
        floor: defaultFloor,
        roomNumber: suggestedNum,
        roomType: 'Standard',
        monthlyFee: activeHostel.monthlyFee || 0,
        bedCount: 2,
        bedIdentifiers: 'Bed A, Bed B',
        status: 'AVAILABLE',
      });
    }
    setIsRoomModalOpen(true);
  };

  // Save Room (Create or Edit)
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomForm.roomNumber.trim()) {
      showError('Please specify room number.');
      return;
    }

    try {
      const identifiers = roomForm.bedIdentifiers
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const targetBedsCount = Math.max(1, Number(roomForm.bedCount) || 1);
      const finalBedNames: string[] = [];
      for (let i = 0; i < targetBedsCount; i++) {
        if (identifiers[i]) {
          finalBedNames.push(identifiers[i]);
        } else {
          finalBedNames.push(`Bed ${String.fromCharCode(65 + i)}`);
        }
      }

      if (editingRoom) {
        // Preserve existing allocated students on beds
        const existingBeds = editingRoom.beds || [];
        const updatedBeds: HostelBed[] = finalBedNames.map((bedName, idx) => {
          const matched = existingBeds.find((b) => b.bedNumber === bedName) || existingBeds[idx];
          if (matched) {
            return {
              ...matched,
              bedNumber: bedName,
            };
          }
          return {
            bedNumber: bedName,
            status: 'AVAILABLE',
          };
        });

        await api.updateHostelRoom(editingRoom.id, {
          floor: Number(roomForm.floor),
          roomNumber: roomForm.roomNumber.trim(),
          roomType: roomForm.roomType,
          monthlyFee: Number(roomForm.monthlyFee),
          capacity: targetBedsCount,
          capacityBeds: targetBedsCount,
          beds: updatedBeds,
          status: roomForm.status,
        });
        showSuccess(`Room ${roomForm.roomNumber} updated successfully.`);
      } else {
        await api.createHostelRoom({
          hostelId: activeHostel.id,
          hostelName: activeHostel.name,
          floor: Number(roomForm.floor),
          roomNumber: roomForm.roomNumber.trim(),
          roomType: roomForm.roomType,
          monthlyFee: Number(roomForm.monthlyFee),
          capacity: targetBedsCount,
          bedIdentifiers: finalBedNames,
          status: roomForm.status,
        });
        showSuccess(`Room ${roomForm.roomNumber} created with ${finalBedNames.length} beds.`);
      }

      setIsRoomModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showError(err.message || 'Failed to save room.');
    }
  };

  // Add Bed to Room
  const handleAddBedToRoom = async (room: HostelRoom) => {
    try {
      const updated = await api.updateHostelRoom(room.id, { addBed: true } as any);
      const added = (updated?.beds || []).find((b) => !(room.beds || []).some((x) => x.bedNumber === b.bedNumber));
      showSuccess(`Added ${added?.bedNumber || 'a bed'} to Room ${room.roomNumber}.`);
      await refreshData();
    } catch (err: any) {
      showError(err.message || 'The bed could not be added.');
    }
  };

  // Remove one chosen empty bed
  const handleRemoveBedFromRoom = async (room: HostelRoom, bedNumber: string) => {
    const targetBed = (room.beds || []).find((b) => b.bedNumber === bedNumber);
    if (targetBed?.allocatedStudentId) {
      showError(`${bedNumber} is occupied by ${targetBed.allocatedStudentName}. Vacate it first.`);
      return;
    }
    askConfirm({
      title: `Remove ${bedNumber}?`,
      message: `${bedNumber} will be removed from Room ${room.roomNumber}.`,
      confirmLabel: 'Remove bed',
      run: async () => {
        await api.updateHostelRoom(room.id, { removeBedNumber: bedNumber } as any);
        showSuccess(`Removed ${bedNumber} from Room ${room.roomNumber}.`);
        await refreshData();
      },
    });
  };

  // Delete Room (only if no students)
  const handleDeleteRoom = async (room: HostelRoom) => {
    const hasOccupants = (room.beds || []).some((b) => Boolean(b.allocatedStudentId));
    if (hasOccupants) {
      showError(`Cannot delete Room ${room.roomNumber} because it has occupied beds.`);
      return;
    }
    askConfirm({
      title: `Delete Room ${room.roomNumber}?`,
      message: `Room ${room.roomNumber} on floor ${room.floor} and its beds will be removed.`,
      confirmLabel: 'Delete room',
      run: async () => {
        await api.deleteHostelRoom(room.id);
        showSuccess(`Room ${room.roomNumber} was deleted.`);
        await refreshData();
      },
    });
  };

  // Students who can be given a bed in the selected hostel: active, and matching its type.
  const allocatableStudents = students
    .filter((s) => s.status === 'ACTIVE')
    .filter((s) => {
      const g = String((s as any).gender || '').toUpperCase();
      if (activeHostel?.type === 'BOYS') return g !== 'FEMALE';
      if (activeHostel?.type === 'GIRLS') return g !== 'MALE';
      return true;
    })
    .sort((a, b) => Number(Boolean(a.hostelRoomId)) - Number(Boolean(b.hostelRoomId)) || a.name.localeCompare(b.name));

  // Open Bed Allocation Modal for a specific room & bed
  const handleOpenAllocateModal = (room?: HostelRoom, bed?: HostelBed) => {
    const withoutBed = allocatableStudents.filter((s) => !s.hostelRoomId || s.hostelStatus !== 'ACTIVE');
    setAllocateStudentId(withoutBed[0]?.id || allocatableStudents[0]?.id || '');

    if (room && bed) {
      setAllocateRoomId(room.id);
      setAllocateBedNumber(bed.bedNumber);
    } else {
      const availRoom = activeHostelRooms.find((r) =>
        r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
      );
      setAllocateRoomId(availRoom?.id || activeHostelRooms[0]?.id || '');
      const availBed = availRoom?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
      setAllocateBedNumber(availBed?.bedNumber || availRoom?.beds?.[0]?.bedNumber || 'Bed A');
    }
    setAllocateRemarks('');
    setIsAllocateModalOpen(true);
  };

  // Submit Bed Allocation (Anti-Double-Booking Protected)
  const handleAllocateBedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocateStudentId || !allocateRoomId || !allocateBedNumber) {
      showError('Please select Student, Room and Bed.');
      return;
    }

    try {
      const result = await api.allocateHostelBed(
        allocateRoomId,
        allocateBedNumber,
        allocateStudentId,
        allocateRemarks
      );
      if (!result.success) {
        showError(result.error || 'Double-booking rejected: Bed is already occupied or unavailable.');
        return;
      }

      const who = students.find((x) => x.id === allocateStudentId)?.name || 'The student';
      showSuccess(`${who} now has ${allocateBedNumber}.`);
      setIsAllocateModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showError(err.message || 'Failed to allocate bed.');
    }
  };

  // Open Vacate Bed Modal
  const handleOpenVacateModal = (bed: HostelBed, room: HostelRoom) => {
    if (!bed.allocatedStudentId) return;
    setVacatingStudent({
      id: bed.allocatedStudentId,
      name: bed.allocatedStudentName || 'Student',
      roomNumber: room.roomNumber,
      bedNumber: bed.bedNumber,
    });
    setVacateRemarks('Term ended / hostel vacated');
    setIsVacateModalOpen(true);
  };

  // Confirm Vacate Bed
  const handleConfirmVacate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacatingStudent) return;

    try {
      const res = await api.vacateHostelBed(vacatingStudent.id, vacateRemarks);
      if (!res.success) {
        showError(res.error || 'Failed to vacate bed.');
        return;
      }

      showSuccess(`Bed ${vacatingStudent.bedNumber} vacated. Student status updated to Day Scholar.`);
      setIsVacateModalOpen(false);
      setVacatingStudent(null);
      await refreshData();
    } catch (err: any) {
      showError(err.message || 'Failed to vacate bed.');
    }
  };

  // Open Change Bed Modal
  const handleOpenChangeBedModal = (bed: HostelBed, room: HostelRoom) => {
    if (!bed.allocatedStudentId) return;
    setChangeStudent({
      id: bed.allocatedStudentId,
      name: bed.allocatedStudentName || 'Student',
      currentRoomNumber: room.roomNumber,
      currentBedNumber: bed.bedNumber,
    });

    // Find available rooms with free beds
    const availRooms = activeHostelRooms.filter(
      (r) => r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
    );
    setChangeTargetRoomId(availRooms[0]?.id || '');
    const firstFreeBed = availRooms[0]?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
    setChangeTargetBedNumber(firstFreeBed?.bedNumber || '');
    setChangeRemarks('Room transfer requested by warden/parent');
    setIsChangeBedModalOpen(true);
  };

  // Confirm Change Bed
  const handleConfirmChangeBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeStudent || !changeTargetRoomId || !changeTargetBedNumber) {
      showError('Please select target room and target bed.');
      return;
    }

    try {
      const res = await api.changeHostelBed(
        changeStudent.id,
        changeTargetRoomId,
        changeTargetBedNumber,
        changeRemarks
      );
      if (!res.success) {
        showError(res.error || 'Failed to change bed. Target bed might have been booked.');
        return;
      }

      showSuccess(`Transferred ${changeStudent.name} to Bed ${changeTargetBedNumber} successfully!`);
      setIsChangeBedModalOpen(false);
      setChangeStudent(null);
      await refreshData();
    } catch (err: any) {
      showError(err.message || 'Failed to change bed.');
    }
  };

  const typeLabel = (t?: string) => (t === 'GIRLS' ? 'Girls' : t === 'CO_ED' ? 'Co-ed' : 'Boys');
  /** The name says one thing and the type another (e.g. "Girls Hostel" saved as Boys). */
  const typeLooksWrong = (h: Hostel) => (/girl/i.test(h.name) && h.type === 'BOYS') || (/\bboy/i.test(h.name) && h.type === 'GIRLS');
  const bedFree = (b: HostelBed) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Hostel</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={refreshData} disabled={loading} className="h-10 w-10 inline-flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          </button>
          {canManage && (
            <>
              <button onClick={() => handleOpenHostelModal()} className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50">
                <Plus className="w-4 h-4" aria-hidden="true" /> Add hostel
              </button>
              {hostels.length > 0 && (
                <button onClick={() => handleOpenAllocateModal()} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold">
                  <UserPlus className="w-4 h-4" aria-hidden="true" /> Allocate bed
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div aria-live="polite" className="space-y-2">
        {actionSuccessMsg && (
          <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />{actionSuccessMsg}</span>
            <button onClick={() => setActionSuccessMsg(null)} aria-label="Dismiss"><X className="w-4 h-4" /></button>
          </div>
        )}
        {actionErrorMsg && (
          <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />{actionErrorMsg}</span>
            <button onClick={() => setActionErrorMsg(null)} aria-label="Dismiss"><X className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: 'Beds', value: totalBeds, sub: `${totalRooms} rooms in ${totalHostels} hostel${totalHostels === 1 ? '' : 's'}` },
          { label: 'Occupied', value: occupiedBeds, sub: 'Students living in' },
          { label: 'Free', value: availableBeds, sub: 'Ready to allocate' },
          { label: 'Occupancy', value: `${overallOccupancyPct}%`, bar: overallOccupancyPct },
        ].map((c) => (
          <div key={c.label} className="p-3.5 bg-white rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums">{c.value}</p>
            {c.bar !== undefined ? (
              <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-blue-700 rounded-full" style={{ width: `${Math.min(100, c.bar)}%` }} />
              </div>
            ) : (
              <p className="text-xs text-slate-500">{c.sub}</p>
            )}
          </div>
        ))}
      </div>

      {hostels.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-800">No hostels yet</p>
          {canManage && (
            <button onClick={() => handleOpenHostelModal()} className="text-sm font-medium text-blue-700 hover:underline">
              Add the first hostel
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" role="list" aria-label="Hostels">
            {hostels.map((h) => {
              const isSelected = h.id === selectedHostelId;
              const hRooms = rooms.filter((r) => r.hostelId === h.id);
              const hBeds = hRooms.flatMap((r) => r.beds || []);
              const hOcc = hBeds.filter((b) => Boolean(b.allocatedStudentId)).length;
              const hPct = hBeds.length > 0 ? Math.round((hOcc / hBeds.length) * 100) : 0;
              return (
                <div
                  key={h.id}
                  role="listitem"
                  className={`rounded-xl border bg-white p-4 ${isSelected ? 'border-blue-700 ring-1 ring-blue-700' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedHostelId(h.id);
                        setSelectedFloor('ALL');
                      }}
                      className="text-left min-w-0"
                      aria-pressed={isSelected}
                    >
                      <p className="text-sm font-semibold text-slate-900 truncate">{h.name}</p>
                      <p className="text-xs text-slate-500">
                        {typeLabel(h.type)} · {hRooms.length} room{hRooms.length === 1 ? '' : 's'} · {(h.floors || [1]).length} floor{(h.floors || [1]).length === 1 ? '' : 's'}
                        {h.status === 'INACTIVE' ? ' · Inactive' : ''}
                      </p>
                    </button>
                    {canManage && (
                      <div className="flex shrink-0">
                        <button onClick={() => handleOpenHostelModal(h)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={`Edit ${h.name}`}>
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteHostel(h)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50" aria-label={`Delete ${h.name}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {typeLooksWrong(h) && (
                    <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                      Saved as a {typeLabel(h.type)} hostel. {canManage ? 'Edit it if that is wrong.' : ''}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-slate-600 tabular-nums">
                      {hOcc} of {hBeds.length} beds taken
                    </span>
                    <span className="font-medium text-slate-900 tabular-nums">{hPct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-blue-700 rounded-full" style={{ width: `${Math.min(100, hPct)}%` }} />
                  </div>
                  <p className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                    {h.wardenName || 'Warden not recorded'} · {h.emergencyPhone || h.wardenPhone || 'No phone'}
                  </p>
                </div>
              );
            })}
          </div>

          {activeHostel && (
            <section className="bg-white rounded-xl border border-slate-200" aria-label={`${activeHostel.name} rooms`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{activeHostel.name}</h3>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {activeHostelOccupiedBeds} of {activeHostelTotalBeds} beds taken · {activeHostelAvailableBeds} free
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center bg-slate-100 rounded-xl p-0.5 text-sm overflow-x-auto" role="group" aria-label="Floor">
                    {(['ALL', ...activeHostelFloors] as (number | 'ALL')[]).map((fl) => (
                      <button
                        key={String(fl)}
                        onClick={() => setSelectedFloor(fl)}
                        aria-pressed={selectedFloor === fl}
                        className={`h-8 px-3 rounded-lg whitespace-nowrap ${selectedFloor === fl ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        {fl === 'ALL' ? 'All floors' : `Floor ${fl}`}
                      </button>
                    ))}
                  </div>
                  <label className="relative">
                    <span className="sr-only">Search room or student</span>
                    <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Room or student"
                      className="h-9 pl-8 pr-3 text-sm border border-slate-300 rounded-xl w-44"
                    />
                  </label>
                  {canManage && (
                    <>
                      <button
                        onClick={() => {
                          setNewFloorNumber((activeHostelFloors[activeHostelFloors.length - 1] || 0) + 1);
                          setIsFloorModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Layers className="w-4 h-4" aria-hidden="true" /> Add floor
                      </button>
                      <button onClick={() => handleOpenRoomModal()} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">
                        <DoorOpen className="w-4 h-4" aria-hidden="true" /> Add room
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-5">
                {activeHostelFloors
                  .filter((fl) => selectedFloor === 'ALL' || fl === selectedFloor)
                  .map((floorNum) => {
                    const floorRooms = filteredRooms.filter((r) => r.floor === floorNum);
                    const fBeds = floorRooms.flatMap((r) => r.beds || []);
                    const fOcc = fBeds.filter((b) => Boolean(b.allocatedStudentId)).length;
                    if (searchQuery.trim() && floorRooms.length === 0) return null;
                    return (
                      <div key={floorNum} className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-800">
                            Floor {floorNum}
                            <span className="ml-2 font-normal text-slate-500 tabular-nums">
                              {floorRooms.length} room{floorRooms.length === 1 ? '' : 's'} · {fOcc}/{fBeds.length} beds taken
                            </span>
                          </p>
                          {canManage && (
                            <button
                              onClick={() => {
                                setRoomForm({
                                  hostelId: activeHostel.id,
                                  floor: floorNum,
                                  roomNumber: '',
                                  roomType: 'Standard',
                                  monthlyFee: activeHostel.monthlyFee || 0,
                                  bedCount: 2,
                                  bedIdentifiers: 'Bed A, Bed B',
                                  status: 'AVAILABLE',
                                });
                                setEditingRoom(null);
                                setIsRoomModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
                            >
                              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Room
                            </button>
                          )}
                        </div>
                        {floorRooms.length === 0 ? (
                          <p className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl px-4 py-5 text-center">No rooms on this floor yet.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {floorRooms.map((room) => {
                              const roomBeds = room.beds || [];
                              const cap = roomBeds.length || room.capacity || 0;
                              const occ = roomBeds.filter((b) => Boolean(b.allocatedStudentId)).length;
                              const closed = room.status === 'MAINTENANCE' || room.status === 'INACTIVE';
                              const badge = closed
                                ? { t: room.status === 'MAINTENANCE' ? 'Maintenance' : 'Closed', c: 'bg-amber-50 text-amber-800 ring-amber-200' }
                                : occ >= cap
                                ? { t: 'Full', c: 'bg-slate-100 text-slate-700 ring-slate-300' }
                                : { t: `${cap - occ} free`, c: 'bg-emerald-50 text-emerald-800 ring-emerald-200' };
                              return (
                                <div key={room.id} className="rounded-xl border border-slate-200 p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-900">Room {room.roomNumber}</p>
                                      <p className="text-xs text-slate-500">
                                        {cap} bed{cap === 1 ? '' : 's'}
                                        {room.monthlyFee ? ` · ₹${Number(room.monthlyFee).toLocaleString('en-IN')}/month` : ''}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${badge.c}`}>{badge.t}</span>
                                      {canManage && (
                                        <>
                                          <button onClick={() => handleOpenRoomModal(room)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={`Edit room ${room.roomNumber}`}>
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => handleDeleteRoom(room)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50" aria-label={`Delete room ${room.roomNumber}`}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <ul className="mt-2.5 grid grid-cols-2 gap-1.5">
                                    {roomBeds.map((bed) => {
                                      const taken = Boolean(bed.allocatedStudentId);
                                      return (
                                        <li
                                          key={bed.bedNumber}
                                          className={`rounded-lg border px-2 py-1.5 text-xs ${taken ? 'border-blue-200 bg-blue-50/50' : bedFree(bed) ? 'border-slate-200' : 'border-amber-200 bg-amber-50/50'}`}
                                        >
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="font-medium text-slate-700">{bed.bedNumber.replace(/^Bed\s*/i, 'Bed ')}</span>
                                            {canManage && taken && (
                                              <span className="flex">
                                                <button onClick={() => handleOpenChangeBedModal(bed, room)} className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-500 hover:bg-white" aria-label={`Move ${bed.allocatedStudentName}`} title="Move to another bed">
                                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleOpenVacateModal(bed, room)} className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-500 hover:text-rose-700 hover:bg-white" aria-label={`Vacate ${bed.allocatedStudentName}`} title="Vacate">
                                                  <LogOut className="w-3.5 h-3.5" />
                                                </button>
                                              </span>
                                            )}
                                            {canManage && !taken && roomBeds.length > 1 && (
                                              <button onClick={() => handleRemoveBedFromRoom(room, bed.bedNumber)} className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-rose-700" aria-label={`Remove ${bed.bedNumber}`} title="Remove bed">
                                                <X className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                          {taken ? (
                                            <p className="text-slate-900 truncate" title={`${bed.allocatedStudentName} (${bed.allocatedAdmissionNo || ''})`}>
                                              {bed.allocatedStudentName}
                                            </p>
                                          ) : canManage && bedFree(bed) && !closed ? (
                                            <button onClick={() => handleOpenAllocateModal(room, bed)} className="text-blue-700 font-medium hover:underline">
                                              Allocate
                                            </button>
                                          ) : (
                                            <p className="text-slate-500">{bedFree(bed) ? 'Free' : 'Not available'}</p>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  {canManage && cap < 10 && (
                                    <button onClick={() => handleAddBedToRoom(room)} className="mt-2 text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
                                      <Plus className="w-3 h-3" aria-hidden="true" /> Add bed
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                {searchQuery.trim() && filteredRooms.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No room or student matches “{searchQuery}”.</p>}
              </div>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        tone="danger"
        title={confirmState?.title || ''}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel || 'Confirm'}
        busy={confirmBusy}
        error={confirmError}
        onConfirm={runConfirm}
        onCancel={() => setConfirmState(null)}
      />

      {/* MODAL 1: Create / Edit Hostel */}
      {isHostelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingHostel ? 'Edit Campus Hostel' : 'Create New Campus Hostel'}
              </h3>
              <button
                onClick={() => setIsHostelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveHostel} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hostel Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={hostelForm.name}
                    onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })}
                    placeholder="e.g. Gargi Girls Hostel, Vivekananda Boys Hostel"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hostel Type</label>
                  <select
                    value={hostelForm.type}
                    onChange={(e) => setHostelForm({ ...hostelForm, type: e.target.value as 'BOYS' | 'GIRLS' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  >
                    <option value="BOYS">Boys</option>
                    <option value="GIRLS">Girls</option>
                    <option value="CO_ED">Co-ed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={hostelForm.status}
                    onChange={(e) => setHostelForm({ ...hostelForm, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  >
                    <option value="ACTIVE">Active & Operational</option>
                    <option value="INACTIVE">Inactive / Renovation</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Chief Warden Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={hostelForm.wardenName}
                    onChange={(e) => setHostelForm({ ...hostelForm, wardenName: e.target.value })}
                    placeholder="e.g. Smt. Sunita Mishra"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Warden Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={hostelForm.wardenPhone}
                    onChange={(e) => setHostelForm({ ...hostelForm, wardenPhone: e.target.value })}
                    placeholder="e.g. 98765 43210"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Emergency Phone</label>
                  <input
                    type="text"
                    value={hostelForm.emergencyPhone}
                    onChange={(e) => setHostelForm({ ...hostelForm, emergencyPhone: e.target.value })}
                    placeholder="e.g. 06222-220011 / 94310 00000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Number of Floors</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={hostelForm.floorsCount}
                    onChange={(e) => setHostelForm({ ...hostelForm, floorsCount: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Monthly Rent (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={hostelForm.monthlyFee}
                    onChange={(e) => setHostelForm({ ...hostelForm, monthlyFee: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monthly Mess Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={hostelForm.messFee}
                    onChange={(e) => setHostelForm({ ...hostelForm, messFee: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsHostelModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  {editingHostel ? 'Save Changes' : 'Create Hostel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Floor */}
      {isFloorModalOpen && activeHostel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Add Floor to {activeHostel.name}</h3>
              <button
                onClick={() => setIsFloorModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddFloor} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Floor Number</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newFloorNumber}
                  onChange={(e) => setNewFloorNumber(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFloorModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Add Floor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Create / Edit Room */}
      {isRoomModalOpen && activeHostel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingRoom ? `Edit Room ${editingRoom.roomNumber}` : `Add Room to ${activeHostel.name}`}
              </h3>
              <button
                onClick={() => setIsRoomModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRoom} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Floor</label>
                  <select
                    value={roomForm.floor}
                    onChange={(e) => setRoomForm({ ...roomForm, floor: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  >
                    {activeHostelFloors.map((fl) => (
                      <option key={fl} value={fl}>
                        Floor {fl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room Number</label>
                  <input
                    type="text"
                    required
                    value={roomForm.roomNumber}
                    onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                    placeholder="e.g. 201, 202"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room Type</label>
                  <input
                    type="text"
                    value={roomForm.roomType}
                    onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value })}
                    placeholder="e.g. Standard 2-Bed, Deluxe AC"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={roomForm.monthlyFee}
                    onChange={(e) => setRoomForm({ ...roomForm, monthlyFee: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Number of Beds</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={roomForm.bedCount}
                    onChange={(e) => {
                      const count = parseInt(e.target.value, 10) || 1;
                      const identifiers = Array.from({ length: count }, (_, i) => `Bed ${String.fromCharCode(65 + i)}`).join(', ');
                      setRoomForm({ ...roomForm, bedCount: count, bedIdentifiers: identifiers });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room Status</label>
                  <select
                    value={roomForm.status}
                    onChange={(e) => setRoomForm({ ...roomForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="MAINTENANCE">Under Maintenance</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Bed Identifiers (comma-separated: A, B, C...)
                  </label>
                  <input
                    type="text"
                    value={roomForm.bedIdentifiers}
                    onChange={(e) => setRoomForm({ ...roomForm, bedIdentifiers: e.target.value })}
                    placeholder="Bed A, Bed B, Bed C"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRoomModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  {editingRoom ? 'Update Room' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Allocate Bed Modal */}
      {isAllocateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Allocate a bed</h3>
              <button
                onClick={() => setIsAllocateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAllocateBedSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Student</label>
                <select
                  value={allocateStudentId}
                  onChange={(e) => setAllocateStudentId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800 font-medium"
                >
                  {allocatableStudents.length === 0 && <option value="">No eligible students</option>}
                  {allocatableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {[s.className, s.section].filter(Boolean).join(' ')} · {s.admissionNumber}
                      {s.hostelRoomId && s.hostelStatus === 'ACTIVE' ? ' (has a bed, will be moved)' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Active students{activeHostel?.type === 'BOYS' ? ' who are boys' : activeHostel?.type === 'GIRLS' ? ' who are girls' : ''}. A student keeps only one bed.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Room</label>
                <select
                  value={allocateRoomId}
                  onChange={(e) => {
                    const rId = e.target.value;
                    setAllocateRoomId(rId);
                    const targetRoom = activeHostelRooms.find((r) => r.id === rId);
                    const firstFree = targetRoom?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
                    setAllocateBedNumber(firstFree?.bedNumber || targetRoom?.beds?.[0]?.bedNumber || 'Bed A');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800 font-medium"
                >
                  {activeHostelRooms
                    .filter((r) => r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'))
                    .map((r) => {
                      const freeCount = (r.beds || []).filter((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE').length;
                      return (
                        <option key={r.id} value={r.id}>
                          Room {r.roomNumber} · Floor {r.floor} · {freeCount} free
                        </option>
                      );
                    })}
                </select>
              </div>

              {(() => {
                const targetRoom = activeHostelRooms.find((r) => r.id === allocateRoomId);
                const freeBeds = (targetRoom?.beds || []).filter(
                  (b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'
                );

                return (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bed</label>
                    {freeBeds.length === 0 ? (
                      <p className="text-red-600 font-semibold py-1">No free beds available in this room.</p>
                    ) : (
                      <select
                        value={allocateBedNumber}
                        onChange={(e) => setAllocateBedNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800 font-mono font-medium"
                      >
                        {freeBeds.map((b) => (
                          <option key={b.bedNumber} value={b.bedNumber}>
                            {b.bedNumber} (Available)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Allocation Remarks</label>
                <input
                  type="text"
                  value={allocateRemarks}
                  onChange={(e) => setAllocateRemarks(e.target.value)}
                  placeholder="e.g. Regular academic year allotment"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAllocateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Allocate Bed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Vacate Bed Modal */}
      {isVacateModalOpen && vacatingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-red-900 flex items-center gap-1.5">
                <LogOut className="w-4 h-4 text-red-600" />
                Vacate Hostel Bed
              </h3>
              <button
                onClick={() => setIsVacateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to vacate{' '}
              <strong className="text-slate-900">{vacatingStudent.name}</strong> from{' '}
              <strong className="text-slate-900">
                Room {vacatingStudent.roomNumber} ({vacatingStudent.bedNumber})
              </strong>
              ? The bed will immediately become available for new allocation.
            </p>

            <form onSubmit={handleConfirmVacate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vacate Reason / Remarks</label>
                <input
                  type="text"
                  value={vacateRemarks}
                  onChange={(e) => setVacateRemarks(e.target.value)}
                  placeholder="e.g. Relocation, finished session, graduated"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsVacateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Confirm Vacate Bed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Change Bed Modal */}
      {isChangeBedModalOpen && changeStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                Change Student Bed
              </h3>
              <button
                onClick={() => setIsChangeBedModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-blue-900">
                Student: <span>{changeStudent.name}</span>
              </div>
              <div className="text-blue-800">
                Current Bed: Room {changeStudent.currentRoomNumber} • {changeStudent.currentBedNumber}
              </div>
            </div>

            <form onSubmit={handleConfirmChangeBed} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Room</label>
                <select
                  value={changeTargetRoomId}
                  onChange={(e) => {
                    const rId = e.target.value;
                    setChangeTargetRoomId(rId);
                    const targetRoom = activeHostelRooms.find((r) => r.id === rId);
                    const firstFree = targetRoom?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
                    setChangeTargetBedNumber(firstFree?.bedNumber || targetRoom?.beds?.[0]?.bedNumber || 'Bed A');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600 font-medium"
                >
                  {activeHostelRooms
                    .filter((r) => r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'))
                    .map((r) => {
                      const freeCount = (r.beds || []).filter((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE').length;
                      return (
                        <option key={r.id} value={r.id}>
                          Room {r.roomNumber} · Floor {r.floor} · {freeCount} free
                        </option>
                      );
                    })}
                </select>
              </div>

              {(() => {
                const targetRoom = activeHostelRooms.find((r) => r.id === changeTargetRoomId);
                const freeBeds = (targetRoom?.beds || []).filter(
                  (b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'
                );

                return (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target Bed</label>
                    <select
                      value={changeTargetBedNumber}
                      onChange={(e) => setChangeTargetBedNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600 font-mono font-medium"
                    >
                      {freeBeds.map((b) => (
                        <option key={b.bedNumber} value={b.bedNumber}>
                          {b.bedNumber} (Available)
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transfer Remarks</label>
                <input
                  type="text"
                  value={changeRemarks}
                  onChange={(e) => setChangeRemarks(e.target.value)}
                  placeholder="e.g. Relocated to floor 2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsChangeBedModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
