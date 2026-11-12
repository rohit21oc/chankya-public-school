import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Building2,
  GraduationCap,
  BookOpen,
  Calendar,
  Clock,
  UserCheck,
  DoorOpen,
  ShieldAlert,
  Users,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import {
  AcademicClass,
  AcademicSection,
  Subject,
  TeacherStaff,
  TimetableSlot,
  TimetablePeriodConfig,
} from '../../types';
import { api } from '../../services/api';
import { PeriodRow, checkPeriods, chainAfter, durationMinutes, fromMinutes, fromPickerValue, generatePeriods, nextPeriod, renumber, toMinutes, toPickerValue } from '../../utils/periodTimings';

// ==========================================
// 1. CLASS MODAL (Create / Edit)
// ==========================================
interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (cls: AcademicClass) => void;
  onDelete?: (cls: AcademicClass) => void;
  editingClass?: AcademicClass | null;
  currentSession: string;
}

export const ClassModal: React.FC<ClassModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  onDelete,
  editingClass,
  currentSession,
}) => {
  const [name, setName] = useState('');
  const [numericOrder, setNumericOrder] = useState<number>(1);
  const [maxCapacity, setMaxCapacity] = useState<number>(40);
  const [session, setSession] = useState(currentSession);
  const [sectionsStr, setSectionsStr] = useState('A, B');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Numeric Grade = the class's place in the series (Nursery < LKG < ... < Class 12). Promotion and
  // sorting use it, so two classes must not share a number. New classes default to the next free number.
  const otherClasses = api.getAllClasses().filter((c) => c.id !== editingClass?.id);
  const nextFreeOrder = otherClasses.reduce((max, c) => Math.max(max, Number(c.numericOrder) || 0), 0) + 1;
  // Only a changed number is checked, so older classes that already share a number can still be edited
  const orderChanged = !editingClass || Number(editingClass.numericOrder) !== Number(numericOrder);
  const orderTakenBy = orderChanged ? otherClasses.find((c) => Number(c.numericOrder) === Number(numericOrder)) : undefined;

  useEffect(() => {
    if (editingClass) {
      setName(editingClass.name);
      setNumericOrder(editingClass.numericOrder || 1);
      setMaxCapacity(editingClass.maxCapacity || 40);
      setSession(editingClass.academicSession || currentSession);
      const secs = (editingClass.detailedSections && editingClass.detailedSections.length > 0)
        ? editingClass.detailedSections.map((s) => s.name).join(', ')
        : (editingClass.sections || []).join(', ');
      setSectionsStr(secs || 'A');
      setStatus(editingClass.status || 'ACTIVE');
      setDescription(editingClass.description || '');
    } else {
      setName('');
      setNumericOrder(
        api.getAllClasses().reduce((max, c) => Math.max(max, Number(c.numericOrder) || 0), 0) + 1
      );
      setMaxCapacity(40);
      setSession(currentSession);
      setSectionsStr('A, B');
      setStatus('ACTIVE');
      setDescription('');
    }
    setError(null);
  }, [editingClass, isOpen, currentSession]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!name.trim()) {
      setError('Please specify a class name (e.g. Class 1 or Nursery).');
      return;
    }
    const nameChanged = !editingClass || editingClass.name.trim().toLowerCase() !== name.trim().toLowerCase();
    const duplicateName = nameChanged && otherClasses.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (duplicateName) {
      setError(`A class named "${duplicateName.name}" already exists.`);
      return;
    }
    if (!Number.isFinite(Number(numericOrder)) || Number(numericOrder) < 0) {
      setError('Numeric Grade must be 0 or more.');
      return;
    }
    if (orderTakenBy) {
      setError(`Numeric Grade ${numericOrder} is already used by ${orderTakenBy.name}. Use ${nextFreeOrder} (next free) or change ${orderTakenBy.name} first.`);
      return;
    }
    const parsedSecsAll = sectionsStr
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (!editingClass && new Set(parsedSecsAll).size !== parsedSecsAll.length) {
      setError('The same section is written twice. Use each section name once, e.g. A, B, C.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (editingClass) {
        const updated = await api.updateClass(editingClass.id, {
          name: name.trim(),
          numericOrder: Number(numericOrder),
          maxCapacity: Number(maxCapacity),
          status,
          academicSession: session,
          description: description.trim() || undefined,
        });
        onSaved(updated);
      } else {
        const parsedSecs = sectionsStr
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        const created = await api.addClass({
          name: name.trim(),
          numericOrder: Number(numericOrder),
          maxCapacity: Number(maxCapacity),
          academicSession: session,
          sections: parsedSecs.length > 0 ? parsedSecs : ['A'],
          description: description.trim() || undefined,
        });
        onSaved(created);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save class.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fadeIn">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {editingClass ? `Edit ${editingClass.name}` : 'Create New Class'}
              </h3>
              <p className="text-xs text-slate-500">Configure grade level, capacity, and academic session</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Class Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Class 1, Class 10"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Numeric Grade (order in series)</label>
              <input
                type="number"
                min="0"
                max="99"
                value={numericOrder}
                onChange={(e) => setNumericOrder(Number(e.target.value))}
                className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  orderTakenBy ? 'border-amber-400 bg-amber-50' : 'border-slate-200'
                }`}
              />
              <span className={`text-[10px] mt-0.5 block ${orderTakenBy ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                {orderTakenBy
                  ? `Already used by ${orderTakenBy.name}. Next free: ${nextFreeOrder}`
                  : 'Lower number = junior class. Used for sorting and promotion.'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Default Section Capacity</label>
              <input
                type="number"
                min="10"
                max="100"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Standard max students per section</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Academic Session</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {api.getAcademicSessions().map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} {s.status === 'ACTIVE' ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!editingClass && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Initial Sections (comma separated)
              </label>
              <input
                type="text"
                value={sectionsStr}
                onChange={(e) => setSectionsStr(e.target.value)}
                placeholder="A, B, C"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Sections can be configured, added, or deleted later anytime
              </span>
            </div>
          )}

          {editingClass && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="ACTIVE">ACTIVE (Admissions and Attendance Enabled)</option>
                <option value="INACTIVE">INACTIVE (Archived)</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Description / Notes (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. CBSE Board Secondary Stream curriculum"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-2.5 border-t border-slate-100">
            {editingClass && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(editingClass);
                }}
                className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Class</span>
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                {isSaving ? 'Saving…' : editingClass ? 'Update Class' : 'Create Class'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 2. SECTION MODAL (Create / Edit)
// ==========================================
interface SectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (cls: AcademicClass) => void;
  classObj: AcademicClass;
  editingSection?: AcademicSection | null;
  staffList: TeacherStaff[];
}

export const SectionModal: React.FC<SectionModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  classObj,
  editingSection,
  staffList,
}) => {
  const [name, setName] = useState('A');
  const [maxCapacity, setMaxCapacity] = useState<number>(40);
  const [roomNumber, setRoomNumber] = useState('');
  const [classTeacherId, setClassTeacherId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingSection) {
      setName(editingSection.name);
      setMaxCapacity(editingSection.maxCapacity || classObj.maxCapacity || 40);
      setRoomNumber(editingSection.roomNumber || '');
      setClassTeacherId(editingSection.classTeacherId || '');
      setStatus(editingSection.status || 'ACTIVE');
    } else {
      const existingNames = new Set((classObj.detailedSections || []).map((s) => s.name));
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let nextLetter = 'A';
      for (const char of alphabet) {
        if (!existingNames.has(char)) {
          nextLetter = char;
          break;
        }
      }
      setName(nextLetter);
      setMaxCapacity(classObj.maxCapacity || 40);
      setRoomNumber(`Room ${100 + (classObj.numericOrder || 1) * 10 + (classObj.detailedSections?.length || 0) + 1}`);
      setClassTeacherId('');
      setStatus('ACTIVE');
    }
    setError(null);
  }, [editingSection, classObj, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!name.trim()) {
      setError('Please provide a section name (e.g. A, B).');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const selectedTeacher = staffList.find((s) => s.id === classTeacherId);
      if (editingSection) {
        const updated = await api.updateSection(classObj.id, editingSection.id, {
          name: name.trim().toUpperCase(),
          maxCapacity: Number(maxCapacity),
          roomNumber: roomNumber.trim() || undefined,
          classTeacherId: classTeacherId || undefined,
          classTeacherName: selectedTeacher?.name,
          status,
        });
        onSaved(updated);
      } else {
        const updated = await api.addSection(classObj.id, {
          name: name.trim().toUpperCase(),
          maxCapacity: Number(maxCapacity),
          roomNumber: roomNumber.trim() || undefined,
          classTeacherId: classTeacherId || undefined,
          classTeacherName: selectedTeacher?.name,
        });
        onSaved(updated);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save section.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fadeIn">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {editingSection ? `Edit Section ${editingSection.name}` : `Add Section to ${classObj.name}`}
              </h3>
              <p className="text-xs text-slate-500">Configure section capacity, room, and class teacher</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Section Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={4}
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                placeholder="e.g. A"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold uppercase text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Max Capacity</label>
              <input
                type="number"
                min="10"
                max="80"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Assigned Classroom / Room No.</label>
            <input
              type="text"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g. Room 204 or Block B-12"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Designated Class Teacher</label>
            <select
              value={classTeacherId}
              onChange={(e) => setClassTeacherId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- No Class Teacher Assigned --</option>
              {staffList.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} ({teacher.designation || 'Faculty'}) {teacher.classTeacherOf ? `[Currently: ${teacher.classTeacherOf}]` : ''}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Single-teacher allocation: if assigned elsewhere, re-assignment will be tracked automatically.
            </span>
          </div>

          {editingSection && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Section Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              {isSaving ? 'Saving…' : editingSection ? 'Update Section' : 'Add Section'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 3. SUBJECT MODAL (Create / Edit)
// ==========================================
interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (sub: Subject) => void;
  editingSubject?: Subject | null;
  classes: AcademicClass[];
  currentSession: string;
}

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editingSubject,
  classes,
  currentSession,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<'CORE' | 'ELECTIVE' | 'OPTIONAL' | 'ACTIVITY'>('CORE');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [maxMarks, setMaxMarks] = useState<number>(100);
  const [theoryMarks, setTheoryMarks] = useState<number>(80);
  const [practicalMarks, setPracticalMarks] = useState<number>(20);
  const [passMarks, setPassMarks] = useState<number>(33);
  const [credits, setCredits] = useState<number>(4);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [session, setSession] = useState(currentSession);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingSubject) {
      setName(editingSubject.name);
      setCode(editingSubject.code);
      setType(editingSubject.type || 'CORE');
      setClassIds(editingSubject.classIds || []);
      const max = editingSubject.maxMarks || 100;
      setMaxMarks(max);
      setTheoryMarks(editingSubject.theoryMarks ?? Math.round(max * 0.8));
      setPracticalMarks(editingSubject.practicalMarks ?? Math.round(max * 0.2));
      setPassMarks(editingSubject.passMarks ?? 33);
      setCredits(editingSubject.credits ?? 4);
      setStatus(editingSubject.status || 'ACTIVE');
      setSession(editingSubject.academicSession || currentSession);
    } else {
      setName('');
      setCode('');
      setType('CORE');
      setClassIds(classes.map((c) => c.id));
      setMaxMarks(100);
      setTheoryMarks(80);
      setPracticalMarks(20);
      setPassMarks(33);
      setCredits(4);
      setStatus('ACTIVE');
      setSession(currentSession);
    }
    setError(null);
  }, [editingSubject, classes, isOpen, currentSession]);

  if (!isOpen) return null;

  const handleMaxMarksChange = (val: number) => {
    setMaxMarks(val);
    const theory = Math.round(val * 0.8);
    setTheoryMarks(theory);
    setPracticalMarks(val - theory);
    setPassMarks(Math.round(val * 0.33));
  };

  const toggleClassSelect = (cid: string) => {
    setClassIds((prev) =>
      prev.includes(cid) ? prev.filter((id) => id !== cid) : [...prev, cid]
    );
  };

  const handleSelectAllClasses = () => {
    if (classIds.length === classes.length) {
      setClassIds([]);
    } else {
      setClassIds(classes.map((c) => c.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!name.trim()) {
      setError('Please provide a subject name.');
      return;
    }
    if (!code.trim()) {
      setError('Please provide a subject code (e.g. MATH-10, SCI-CBSE).');
      return;
    }
    if (theoryMarks + practicalMarks !== maxMarks) {
      setError(`Theory marks (${theoryMarks}) + Practical marks (${practicalMarks}) must equal Max Marks (${maxMarks}).`);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      if (editingSubject) {
        const updated = await api.updateSubject(editingSubject.id, {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          type,
          classIds,
          maxMarks: Number(maxMarks),
          theoryMarks: Number(theoryMarks),
          practicalMarks: Number(practicalMarks),
          passMarks: Number(passMarks),
          credits: Number(credits),
          status,
          academicSession: session,
        });
        onSaved(updated);
      } else {
        const created = await api.addSubject({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          type,
          classIds,
          maxMarks: Number(maxMarks),
          theoryMarks: Number(theoryMarks),
          practicalMarks: Number(practicalMarks),
          passMarks: Number(passMarks),
          credits: Number(credits),
          status,
          academicSession: session,
        });
        onSaved(created);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save subject.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-6 overflow-hidden animate-fadeIn">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {editingSubject ? `Edit Subject: ${editingSubject.name}` : 'Create New Subject & Scheme'}
              </h3>
              <p className="text-xs text-slate-500">Configure course codes, marks evaluation, and class allocation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Subject Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mathematics, Social Science"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Subject Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. MATH-041, ENG-101"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Subject Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="CORE">CORE</option>
                <option value="ELECTIVE">ELECTIVE</option>
                <option value="OPTIONAL">OPTIONAL</option>
                <option value="ACTIVITY">ACTIVITY</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Credits</label>
              <input
                type="number"
                min="1"
                max="10"
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          {/* Marks Scheme Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Evaluation & Marks Scheme
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Total Marks</label>
                <input
                  type="number"
                  min="20"
                  max="200"
                  value={maxMarks}
                  onChange={(e) => handleMaxMarksChange(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-blue-900 bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Theory Marks</label>
                <input
                  type="number"
                  min="0"
                  max={maxMarks}
                  value={theoryMarks}
                  onChange={(e) => setTheoryMarks(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Practical / IA</label>
                <input
                  type="number"
                  min="0"
                  max={maxMarks}
                  value={practicalMarks}
                  onChange={(e) => setPracticalMarks(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Pass Marks</label>
                <input
                  type="number"
                  min="1"
                  max={maxMarks}
                  value={passMarks}
                  onChange={(e) => setPassMarks(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-emerald-800 bg-white"
                />
              </div>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between">
              <span>Theory + Practical = {theoryMarks + practicalMarks} / {maxMarks}</span>
              <span className={theoryMarks + practicalMarks === maxMarks ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                {theoryMarks + practicalMarks === maxMarks ? '✓ Marks Match' : '⚠ Marks mismatch with total'}
              </span>
            </div>
          </div>

          {/* Assigned Classes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 block">
                Assign to Classes ({classIds.length} selected)
              </label>
              <button
                type="button"
                onClick={handleSelectAllClasses}
                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900"
              >
                {classIds.length === classes.length ? 'Deselect All' : 'Select All Classes'}
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50/50">
              {classes.map((cls) => {
                const isChecked = classIds.includes(cls.id);
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => toggleClassSelect(cls.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-colors flex items-center justify-between ${
                      isChecked
                        ? 'bg-blue-100 border-blue-300 text-blue-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cls.name}</span>
                    {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              {editingSubject ? 'Update Subject' : 'Save Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 4. TIMETABLE SLOT MODAL (with Visual Conflict Alert)
// ==========================================
interface TimetableSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingSlot?: TimetableSlot | null;
  classes: AcademicClass[];
  staffList: TeacherStaff[];
  subjects: Subject[];
  initialClassId?: string;
  initialSection?: string;
  initialDay?: string;
  initialPeriod?: number;
  periods: TimetablePeriodConfig[];
  currentSession: string;
}

export const TimetableSlotModal: React.FC<TimetableSlotModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editingSlot,
  classes,
  staffList,
  subjects,
  initialClassId,
  initialSection,
  initialDay,
  initialPeriod,
  periods,
  currentSession,
}) => {
  const [classId, setClassId] = useState(initialClassId || classes[0]?.id || '');
  const [section, setSection] = useState(initialSection || 'A');
  const [dayOfWeek, setDayOfWeek] = useState(initialDay || 'Monday');
  const [periodNumber, setPeriodNumber] = useState(initialPeriod || 1);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [teacherId, setTeacherId] = useState(staffList[0]?.id || '');
  const [roomNumber, setRoomNumber] = useState('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [conflictType, setConflictType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const selectedClass = classes.find((c) => c.id === classId);
  const selectedPeriod = periods.find((p) => p.periodNumber === periodNumber) || periods[0];

  useEffect(() => {
    if (editingSlot) {
      setClassId(editingSlot.classId);
      setSection(editingSlot.section);
      setDayOfWeek(editingSlot.dayOfWeek);
      setPeriodNumber(editingSlot.periodNumber);
      setSubjectId(editingSlot.subjectId);
      setTeacherId(editingSlot.teacherId);
      setRoomNumber(editingSlot.roomNumber || '');
    } else {
      if (initialClassId) setClassId(initialClassId);
      if (initialSection) setSection(initialSection);
      if (initialDay) setDayOfWeek(initialDay);
      if (initialPeriod) setPeriodNumber(initialPeriod);
      if (subjects[0]) setSubjectId(subjects[0].id);
      if (staffList[0]) setTeacherId(staffList[0].id);

      // Auto default room from class section if available
      const cls = classes.find((c) => c.id === (initialClassId || classes[0]?.id));
      const secObj = cls?.detailedSections?.find((s) => s.name === (initialSection || 'A'));
      setRoomNumber(secObj?.roomNumber || `Room 101`);
    }
    setError(null);
    setConflictWarning(null);
  }, [editingSlot, initialClassId, initialSection, initialDay, initialPeriod, isOpen]);

  // Real-time conflict checking whenever slot coordinates change
  useEffect(() => {
    if (!isOpen || !teacherId) return;

    const check = api.checkTimetableConflict({
      id: editingSlot?.id,
      dayOfWeek,
      periodNumber: Number(periodNumber),
      teacherId,
      roomNumber,
      classId,
      section,
    });

    if (check.hasConflict) {
      setConflictWarning(check.message || 'Timetable conflict detected');
      setConflictType(check.conflictType || 'TEACHER');
    } else {
      setConflictWarning(null);
      setConflictType(null);
    }
  }, [dayOfWeek, periodNumber, teacherId, roomNumber, classId, section, isOpen, editingSlot]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subObj = subjects.find((s) => s.id === subjectId);
    const teacherObj = staffList.find((s) => s.id === teacherId);
    const clsObj = classes.find((c) => c.id === classId);

    if (!clsObj) {
      setError('Please select a class.');
      return;
    }
    if (!subObj) {
      setError('Please select a subject.');
      return;
    }
    if (!teacherObj) {
      setError('Please select an instructor.');
      return;
    }

    const payload = {
      classId,
      className: clsObj.name,
      section,
      dayOfWeek,
      periodNumber: Number(periodNumber),
      startTime: selectedPeriod?.startTime || '08:00 AM',
      endTime: selectedPeriod?.endTime || '08:45 AM',
      subjectId,
      subjectName: subObj.name,
      teacherId,
      teacherName: teacherObj.name,
      roomNumber: roomNumber.trim() || 'Room 101',
      academicSession: currentSession,
    };

    if (editingSlot) {
      const res = api.updateTimetableSlot(editingSlot.id, payload);
      if (!res.success) {
        setError(res.error || 'Failed to update slot due to scheduling conflict.');
        return;
      }
    } else {
      const res = api.addTimetableSlot(payload);
      if (!res.success) {
        setError(res.error || 'Failed to schedule slot due to conflict.');
        return;
      }
    }

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fadeIn">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {editingSlot ? 'Edit Timetable Slot' : 'Assign Timetable Slot'}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {conflictWarning && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Scheduling Conflict Warning ({conflictType})</span>
              </div>
              <p className="text-[11px] leading-relaxed pl-6">{conflictWarning}</p>
            </div>
          )}

          {/* Class and Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Class</label>
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  const cls = classes.find((c) => c.id === e.target.value);
                  if (cls?.sections?.length) setSection(cls.sections[0]);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Section</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {(selectedClass?.sections || ['A']).map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Day & Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Period</label>
              <select
                value={periodNumber}
                onChange={(e) => setPeriodNumber(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {periods.map((p) => (
                  <option key={p.periodNumber} value={p.periodNumber}>
                    {p.name} ({p.startTime} - {p.endTime}) {p.isBreak ? ' [Break]' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject & Teacher */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) - {s.type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Assigned Teacher / Faculty</label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {staffList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.designation || 'Teacher'}) • {t.department}
                </option>
              ))}
            </select>
          </div>

          {/* Room Number */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Room / Venue</label>
            <input
              type="text"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g. Room 102, Science Lab, Audio-Visual Room"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            {editingSlot && (
              isConfirmingDelete ? (
                <div className="flex items-center gap-1.5 p-1 bg-red-50 border border-red-200 rounded-xl">
                  <span className="text-[11px] font-bold text-red-700 pl-2">Remove slot?</span>
                  <button
                    type="button"
                    onClick={() => {
                      api.deleteTimetableSlot(editingSlot.id);
                      onSaved();
                      onClose();
                    }}
                    className="px-2.5 py-1 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Slot</span>
                </button>
              )
            )}
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(conflictWarning)}
                className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors ${
                  conflictWarning
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-700 hover:bg-blue-800 text-white'
                }`}
              >
                {editingSlot ? 'Update Slot' : 'Save Slot'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 5. TIMETABLE PERIOD CONFIG MODAL
// ==========================================
// One setting for the whole school: the same periods and times for every class and section. Saving
// also moves every lesson already scheduled to the new times of its period (server).
interface PeriodConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (message?: string) => void;
  initialPeriods: TimetablePeriodConfig[];
  initialDays: string[];
  schoolTiming: { startTime: string; endTime: string };
}

/** Time picker (the device's clock / time selector) that reads and writes "hh:mm AM/PM". */
const TimePicker: React.FC<{ value: string; onChange: (v: string) => void; label: string; className?: string }> = ({ value, onChange, label, className = '' }) => (
  <input
    type="time"
    step={300}
    value={toPickerValue(value)}
    onChange={(e) => {
      const v = fromPickerValue(e.target.value);
      if (v) onChange(v);
    }}
    aria-label={label}
    className={`px-2.5 py-2 border border-slate-300 rounded-lg text-sm font-medium tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 ${className}`}
  />
);

export const PeriodConfigModal: React.FC<PeriodConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialPeriods,
  initialDays,
  schoolTiming,
}) => {
  const [periods, setPeriods] = useState<PeriodRow[]>(renumber((initialPeriods || []) as PeriodRow[]));
  const [workingDays, setWorkingDays] = useState<string[]>(initialDays);
  const [startTime, setStartTime] = useState(schoolTiming.startTime || '08:00 AM');
  const [endTime, setEndTime] = useState(schoolTiming.endTime || '02:00 PM');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [backToBack, setBackToBack] = useState(true);
  const [showQuick, setShowQuick] = useState(false);
  const [quick, setQuick] = useState({ firstStart: '08:00 AM', periodMinutes: 40, count: 8, breakAfter: 4, breakMinutes: 30 });

  useEffect(() => {
    if (!isOpen) return;
    setPeriods(renumber((initialPeriods || []) as PeriodRow[]));
    setWorkingDays(initialDays);
    setStartTime(schoolTiming.startTime || '08:00 AM');
    setEndTime(schoolTiming.endTime || '02:00 PM');
    setSaveError(null);
    setShowQuick(!(initialPeriods || []).length);
    setQuick((q) => ({ ...q, firstStart: schoolTiming.startTime || q.firstStart }));
  }, [initialPeriods, initialDays, schoolTiming, isOpen]);

  if (!isOpen) return null;

  const allWeekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const { errors, warnings } = checkPeriods(periods, { startTime, endTime });

  const toggleDay = (d: string) => setWorkingDays((prev) => (prev.includes(d) ? prev.filter((day) => day !== d) : [...prev, d]));

  const changeTime = (idx: number, field: 'startTime' | 'endTime', val: string) => {
    let next = periods.map((p, i) => {
      if (i !== idx) return p;
      if (field === 'startTime' && backToBack) {
        // Moving a start keeps the period's length.
        const len = durationMinutes(p);
        const s = toMinutes(val);
        return { ...p, startTime: val, endTime: s !== null && len && len > 0 ? fromMinutes(s + len) : p.endTime };
      }
      return { ...p, [field]: val };
    });
    if (backToBack) next = chainAfter(next, idx);
    setPeriods(next);
  };

  const changeField = (idx: number, patch: Partial<PeriodRow>) => setPeriods(periods.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const addPeriod = () => setPeriods(renumber([...periods, nextPeriod(periods)]));
  const removePeriod = (idx: number) => {
    if (periods.length <= 1) return;
    let next = periods.filter((_, i) => i !== idx);
    if (backToBack && idx > 0) next = chainAfter(next, idx - 1);
    setPeriods(renumber(next));
  };
  const applyQuick = () => {
    const rows = generatePeriods(quick);
    if (!rows.length) return;
    setPeriods(rows);
    setShowQuick(false);
  };

  const handleSave = async () => {
    if (errors.length) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await api.updateTimetableConfigAsync({
        workingDays,
        periods: renumber(periods) as TimetablePeriodConfig[],
        schoolTiming: { startTime, endTime },
      });
      const parts = ['Period timings saved for every class and section.'];
      if (result.slotsUpdated) parts.push(`${result.slotsUpdated} scheduled lesson${result.slotsUpdated === 1 ? '' : 's'} moved to the new times.`);
      if (result.slotsInRemovedOrBreakPeriods) parts.push(`${result.slotsInRemovedOrBreakPeriods} lesson${result.slotsInRemovedOrBreakPeriods === 1 ? ' is' : 's are'} in a period that is now a break or removed; move or delete ${result.slotsInRemovedOrBreakPeriods === 1 ? 'it' : 'them'}.`);
      onSaved(parts.join(' '));
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'The settings could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  const numCls = 'w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600';

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-slate-900/50 sm:p-4" onClick={() => !isSaving && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Period timings and schedule settings"
        className="bg-white sm:rounded-2xl shadow-2xl border border-slate-200 w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">Period Timings & Schedule Settings</h3>
              <p className="text-xs text-slate-500">One timing for every class and section</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-950">
            These periods and times are used by <b>all classes and sections</b>. When you save, lessons already in the timetable move to the new
            time of their period.
          </div>

          {/* School hours */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="block">
              <span className="text-xs font-bold text-slate-700 block mb-1">School opening time</span>
              <TimePicker value={startTime} onChange={setStartTime} label="School opening time" className="w-full" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-700 block mb-1">Dispersal / End time</span>
              <TimePicker value={endTime} onChange={setEndTime} label="Dispersal time" className="w-full" />
              <span className="block text-[11px] text-slate-500 mt-1">Also the staff out time</span>
            </label>
          </div>

          {/* Working days */}
          <div>
            <span className="text-xs font-bold text-slate-700 block mb-2">School working days</span>
            <div className="flex flex-wrap gap-2">
              {allWeekDays.map((d) => {
                const on = workingDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">Days not selected are weekly offs (attendance calendars and payroll).</p>
          </div>

          {/* Quick setup */}
          <div className="rounded-xl border border-slate-200">
            <button type="button" onClick={() => setShowQuick((v) => !v)} aria-expanded={showQuick} className="w-full px-4 py-3 flex items-center justify-between text-left">
              <span>
                <span className="block text-sm font-bold text-slate-900">Quick setup</span>
                <span className="block text-xs text-slate-500">Create the whole day from the first period, period length and break</span>
              </span>
              <span className="text-xs font-semibold text-blue-700">{showQuick ? 'Hide' : 'Open'}</span>
            </button>
            {showQuick && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <label className="block col-span-2 sm:col-span-1">
                    <span className="text-xs font-semibold text-slate-600 block mb-1">First period starts</span>
                    <TimePicker value={quick.firstStart} onChange={(v) => setQuick({ ...quick, firstStart: v })} label="First period starts" className="w-full" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 block mb-1">Period length (min)</span>
                    <input type="number" min={5} max={120} value={quick.periodMinutes} onChange={(e) => setQuick({ ...quick, periodMinutes: Number(e.target.value) })} className={numCls} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 block mb-1">Periods a day</span>
                    <input type="number" min={1} max={16} value={quick.count} onChange={(e) => setQuick({ ...quick, count: Number(e.target.value) })} className={numCls} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 block mb-1">Break after period</span>
                    <input type="number" min={0} max={16} value={quick.breakAfter} onChange={(e) => setQuick({ ...quick, breakAfter: Number(e.target.value) })} className={numCls} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 block mb-1">Break length (min)</span>
                    <input type="number" min={0} max={120} value={quick.breakMinutes} onChange={(e) => setQuick({ ...quick, breakMinutes: Number(e.target.value) })} className={numCls} />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    {(() => {
                      const rows = generatePeriods(quick);
                      return rows.length ? `${rows[0].startTime} to ${rows[rows.length - 1].endTime}` : '';
                    })()}
                  </span>
                  <button type="button" onClick={applyQuick} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
                    Create periods
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Periods */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-700">Daily periods ({periods.length})</span>
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={backToBack} onChange={(e) => setBackToBack(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                Keep periods back to back (changing a time moves the later periods)
              </label>
            </div>

            <ul className="border border-slate-200 rounded-xl divide-y divide-slate-100">
              {periods.map((p, idx) => {
                const len = durationMinutes(p);
                return (
                  <li key={idx} className={`p-3 grid grid-cols-[auto_1fr_auto] sm:grid-cols-[2rem_1fr_auto_auto_4rem_auto_auto] items-center gap-2 sm:gap-3 ${p.isBreak ? 'bg-amber-50/60' : 'bg-white'}`}>
                    <span className="text-xs font-bold text-slate-400 text-center">#{idx + 1}</span>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => changeField(idx, { name: e.target.value })}
                      placeholder={p.isBreak ? 'Break' : `Period ${idx + 1}`}
                      aria-label={`Period ${idx + 1} name`}
                      className="min-w-0 px-2.5 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => removePeriod(idx)}
                      disabled={periods.length <= 1}
                      aria-label={`Remove ${p.name || `period ${idx + 1}`}`}
                      className="sm:order-last p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {/* Phone: start – end on one line, length + break below. Desktop: one row. */}
                    <div className="col-span-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:contents">
                      <TimePicker value={p.startTime} onChange={(v) => changeTime(idx, 'startTime', v)} label={`${p.name} start`} className="min-w-0 w-full sm:w-32" />
                      <span className="text-slate-400 text-xs sm:hidden">to</span>
                      <TimePicker value={p.endTime} onChange={(v) => changeTime(idx, 'endTime', v)} label={`${p.name} end`} className="min-w-0 w-full sm:w-32" />
                    </div>
                    <div className="col-span-3 flex items-center justify-between gap-3 sm:contents">
                      <span className={`text-xs tabular-nums sm:w-14 sm:text-right ${len !== null && len > 0 ? 'text-slate-500' : 'text-red-600 font-semibold'}`}>{len !== null ? `${len} min` : '—'}</span>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                        <input type="checkbox" checked={Boolean(p.isBreak)} onChange={(e) => changeField(idx, { isBreak: e.target.checked, breakType: e.target.checked ? 'RECESS' : undefined })} className="h-4 w-4 accent-amber-600" />
                        Break
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={addPeriod} className="mt-2 text-sm font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add period
            </button>
          </div>

          {(errors.length > 0 || warnings.length > 0 || saveError) && (
            <div className="space-y-2">
              {saveError && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{saveError}</div>}
              {errors.map((e) => (
                <div key={e} className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {e}
                </div>
              ))}
              {warnings.map((w) => (
                <div key={w} className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {w}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 flex items-center justify-end gap-2.5 border-t border-slate-100 bg-white shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || errors.length > 0}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
          >
            {isSaving ? 'Saving…' : 'Save for all classes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 6. DELETE CLASS MODAL (Safe In-App Confirmation)
// ==========================================
export interface DeleteClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  classToDelete: AcademicClass | null;
  classes: AcademicClass[];
  enrolledStudentsCount: number;
}

export const DeleteClassModal: React.FC<DeleteClassModalProps> = ({
  isOpen,
  onClose,
  onDeleted,
  classToDelete,
  classes,
  enrolledStudentsCount,
}) => {
  const [reassignAction, setReassignAction] = useState<'REASSIGN' | 'UNASSIGN'>('REASSIGN');
  const otherClasses = classes.filter((c) => c.id !== classToDelete?.id);
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (otherClasses.length > 0) {
      setTargetClassId(otherClasses[0].id);
      setReassignAction('REASSIGN');
    } else {
      setReassignAction('UNASSIGN');
    }
    setError(null);
    setIsDeleting(false);
  }, [classToDelete, isOpen, classes.length]);

  if (!isOpen || !classToDelete) return null;

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      if (enrolledStudentsCount > 0) {
        if (reassignAction === 'REASSIGN') {
          if (!targetClassId) {
            setError('Please select a destination class for student reassignment.');
            setIsDeleting(false);
            return;
          }
          await api.deleteClass(classToDelete.id, { reassignToClassId: targetClassId });
        } else {
          await api.deleteClass(classToDelete.id, { force: true });
        }
      } else {
        await api.deleteClass(classToDelete.id);
      }

      setIsDeleting(false);
      onDeleted();
      onClose();
    } catch (err: any) {
      setIsDeleting(false);
      setError(err?.message || 'Failed to delete class.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 bg-red-50/80 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Delete Academic Class</h3>
              <p className="text-xs text-red-700 font-medium">Permanently remove {classToDelete.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Class Summary Pill */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold">Target Class:</span>
              <span className="text-xs font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                {classToDelete.name}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Configured Sections:</span>
              <span className="font-semibold text-slate-800">
                {classToDelete.sections?.join(', ') || 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Academic Session:</span>
              <span className="font-mono text-slate-700">{classToDelete.academicSession || api.getActiveAcademicSession().name}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
              <span className="text-slate-500 font-medium">Currently Enrolled:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                  enrolledStudentsCount > 0
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {enrolledStudentsCount} Student{enrolledStudentsCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Conditional Guidance */}
          {enrolledStudentsCount === 0 ? (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-xs leading-relaxed flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Safe to delete:</strong> No students are currently enrolled in {classToDelete.name}. Deleting will remove this class, its sections, and associated timetable configurations cleanly.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Active Students Enrolled ({enrolledStudentsCount})</p>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    To safeguard student registration and records, choose how these students should be handled:
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {otherClasses.length > 0 && (
                  <label
                    className={`block p-3 rounded-xl border transition-all cursor-pointer ${
                      reassignAction === 'REASSIGN'
                        ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="reassignChoice"
                        checked={reassignAction === 'REASSIGN'}
                        onChange={() => setReassignAction('REASSIGN')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Transfer students to another class
                      </span>
                    </div>

                    {reassignAction === 'REASSIGN' && (
                      <div className="mt-2.5 pl-6 space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-600 block">
                          Destination Class:
                        </label>
                        <select
                          value={targetClassId}
                          onChange={(e) => setTargetClassId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {otherClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.sections?.join(', ') || 'Default'})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-500">
                          Students will be transferred to Section A of the selected class.
                        </p>
                      </div>
                    )}
                  </label>
                )}

                <label
                  className={`block p-3 rounded-xl border transition-all cursor-pointer ${
                    reassignAction === 'UNASSIGN'
                      ? 'border-red-500 bg-red-50/40 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="reassignChoice"
                      checked={reassignAction === 'UNASSIGN'}
                      onChange={() => setReassignAction('UNASSIGN')}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Unassign students (Leave in School Registry)
                    </span>
                  </div>
                  <p className="mt-1 pl-6 text-[11px] text-slate-500">
                    Students will not be removed from the school, but their class will be marked as "Unassigned" until you place them in a new class.
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? 'Deleting...' : 'Permanently Delete Class'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 7. DELETE SECTION MODAL (Safe In-App Confirmation)
// ==========================================
export interface DeleteSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  parentClass: AcademicClass | null;
  sectionToDelete: AcademicSection | null;
  enrolledStudentsCount: number;
}

export const DeleteSectionModal: React.FC<DeleteSectionModalProps> = ({
  isOpen,
  onClose,
  onDeleted,
  parentClass,
  sectionToDelete,
  enrolledStudentsCount,
}) => {
  const [reassignChoice, setReassignChoice] = useState<'REASSIGN' | 'UNASSIGN'>('REASSIGN');
  const otherSections = (parentClass?.detailedSections || []).filter((s) => s.id !== sectionToDelete?.id && s.name !== sectionToDelete?.name);
  const [targetSectionName, setTargetSectionName] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (otherSections.length > 0) {
      setTargetSectionName(otherSections[0].name);
      setReassignChoice('REASSIGN');
    } else {
      setReassignChoice('UNASSIGN');
    }
    setError(null);
    setIsDeleting(false);
  }, [sectionToDelete, parentClass, isOpen]);

  if (!isOpen || !parentClass || !sectionToDelete) return null;

  const handleConfirmDelete = () => {
    try {
      setIsDeleting(true);
      setError(null);

      if (enrolledStudentsCount > 0) {
        if (reassignChoice === 'REASSIGN' && targetSectionName) {
          api.deleteSection(parentClass.id, sectionToDelete.id, { reassignToSection: targetSectionName });
        } else {
          api.deleteSection(parentClass.id, sectionToDelete.id, { force: true });
        }
      } else {
        api.deleteSection(parentClass.id, sectionToDelete.id);
      }

      setIsDeleting(false);
      onDeleted();
      onClose();
    } catch (err: any) {
      setIsDeleting(false);
      setError(err?.message || 'Failed to delete section.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fadeIn">
        <div className="px-6 py-4 bg-red-50/80 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Delete Section</h3>
              <p className="text-xs text-red-700 font-medium">
                Remove Section {sectionToDelete.name} from {parentClass.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Target Section:</span>
              <span className="font-bold text-blue-900 px-2.5 py-0.5 bg-blue-100 rounded-md">
                Section {sectionToDelete.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Parent Class:</span>
              <span className="font-semibold text-slate-800">{parentClass.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Enrolled Students:</span>
              <span className={`font-bold px-2 py-0.5 rounded-md ${enrolledStudentsCount > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
                {enrolledStudentsCount} Student{enrolledStudentsCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {enrolledStudentsCount === 0 ? (
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                No active students are assigned to Section {sectionToDelete.name}. This section and its timetable schedule will be cleanly removed.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{enrolledStudentsCount} students are currently assigned to Section {sectionToDelete.name}.</strong>
                  <p className="mt-1 text-[11px]">Select how to handle these students:</p>
                </div>
              </div>

              <div className="space-y-2">
                {otherSections.length > 0 && (
                  <label
                    className={`block p-3 rounded-xl border cursor-pointer ${
                      reassignChoice === 'REASSIGN' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="secChoice"
                        checked={reassignChoice === 'REASSIGN'}
                        onChange={() => setReassignChoice('REASSIGN')}
                        className="text-blue-600"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Transfer students to another section
                      </span>
                    </div>
                    {reassignChoice === 'REASSIGN' && (
                      <div className="mt-2 pl-6">
                        <select
                          value={targetSectionName}
                          onChange={(e) => setTargetSectionName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                        >
                          {otherSections.map((s) => (
                            <option key={s.id} value={s.name}>
                              Section {s.name} (Room: {s.roomNumber || 'N/A'})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </label>
                )}

                <label
                  className={`block p-3 rounded-xl border cursor-pointer ${
                    reassignChoice === 'UNASSIGN' ? 'border-red-500 bg-red-50/40' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="secChoice"
                      checked={reassignChoice === 'UNASSIGN'}
                      onChange={() => setReassignChoice('UNASSIGN')}
                      className="text-red-600"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Unassign section for these students
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? 'Deleting...' : 'Delete Section'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 8. DELETE SUBJECT MODAL (Safe In-App Confirmation)
// ==========================================
export interface DeleteSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  subjectToDelete: Subject | null;
}

export const DeleteSubjectModal: React.FC<DeleteSubjectModalProps> = ({
  isOpen,
  onClose,
  onDeleted,
  subjectToDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !subjectToDelete) return null;

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await api.deleteSubject(subjectToDelete.id);
      onDeleted();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete subject.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fadeIn">
        <div className="px-6 py-4 bg-red-50/80 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Delete Subject</h3>
              
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Subject Name:</span>
              <span className="font-bold text-slate-900">{subjectToDelete.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Subject Code:</span>
              <span className="font-mono font-bold text-blue-900">{subjectToDelete.code}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Type / Credits:</span>
              <span className="font-semibold text-slate-700">{subjectToDelete.type} • {subjectToDelete.credits || 4} Credits</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Delete <strong>{subjectToDelete.name} ({subjectToDelete.code})</strong>? This cannot be undone. A subject already used in timetable, exams, marks or homework cannot be deleted; mark it Inactive instead.
          </p>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? 'Deleting...' : 'Delete Subject'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
