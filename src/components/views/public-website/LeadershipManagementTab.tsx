import React, { useState, useRef } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Quote,
  Loader2,
  Mail,
  Phone,
  GraduationCap,
  ArrowUp,
  ArrowDown,
  Camera,
  Search,
  Eye,
  RefreshCw,
  Building,
  Award,
  Briefcase,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';
import { PublicLeadershipProfile } from '../../../types';
import { fileUploadService } from '../../../services/fileUploadService';
import { PublicManagementProfileModal } from '../../public/PublicManagementProfileModal';
import { mediaSrc } from '../../../utils/publicMedia';

/** A photo that fails to load is replaced by the person's initials (no broken image / alt text). */
const hideBrokenPhoto = (e: React.SyntheticEvent<HTMLImageElement>, name: string) => {
  const img = e.currentTarget;
  const box = img.parentElement;
  img.style.display = 'none';
  if (box && !box.querySelector('[data-initials]')) {
    const d = document.createElement('div');
    d.setAttribute('data-initials', '');
    d.className = 'w-full h-full flex items-center justify-center bg-blue-50 text-blue-900 font-bold text-xs';
    d.textContent = String(name || '?').replace(/^(dr|mr|mrs|ms|er|prof)\.?\s+/i, '').split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
    box.appendChild(d);
  }
};

interface LeadershipManagementTabProps {
  leadership: PublicLeadershipProfile[];
  onSaveProfile: (profile: Partial<PublicLeadershipProfile>) => Promise<void>;
  onUpdateProfile: (id: string, updates: Partial<PublicLeadershipProfile>) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
}

export const LeadershipManagementTab: React.FC<LeadershipManagementTabProps> = ({
  leadership = [],
  onSaveProfile,
  onUpdateProfile,
  onDeleteProfile,
}) => {
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals & Active Targets
  const [editingProfile, setEditingProfile] = useState<PublicLeadershipProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<PublicLeadershipProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PublicLeadershipProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Photo replacement dedicated state
  const [replacingTargetId, setReplacingTargetId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [roleCategory, setRoleCategory] = useState<string>('PRINCIPAL');
  const [photo, setPhoto] = useState('');
  const [photoFileKey, setPhotoFileKey] = useState('');
  const [quote, setQuote] = useState('');
  const [message, setMessage] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [qualification, setQualification] = useState('');
  const [experience, setExperience] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);
  const [showOnWebsite, setShowOnWebsite] = useState(true);
  const [showProfile, setShowProfile] = useState(true);

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Sort leadership by displayOrder
  const safeLeadership = Array.isArray(leadership) ? leadership : [];
  const sortedLeadership = [...safeLeadership].sort(
    (a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0)
  );

  // Filtered members
  const filteredMembers = sortedLeadership.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.qualification && m.qualification.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.education && m.education.toLowerCase().includes(searchQuery.toLowerCase()));

    const isMemberActive = m.isActive !== false && m.active !== false;
    if (statusFilter === 'ACTIVE') return matchesSearch && isMemberActive;
    if (statusFilter === 'INACTIVE') return matchesSearch && !isMemberActive;
    return matchesSearch;
  });

  const activeCount = sortedLeadership.filter((m) => m.isActive !== false && m.active !== false).length;
  const inactiveCount = sortedLeadership.length - activeCount;

  // Form Openers
  const openAddModal = () => {
    setEditingProfile(null);
    setName('');
    setDesignation('');
    setRoleCategory('PRINCIPAL');
    setPhoto('');
    setPhotoFileKey('');
    setQuote('');
    setMessage('');
    setShortBio('');
    setQualification('');
    setExperience('');
    setResponsibilities('');
    setEmail('');
    setPhone('');
    setDisplayOrder(sortedLeadership.length + 1);
    setIsActive(true);
    setShowOnWebsite(true);
    setShowProfile(true);
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const openEditModal = (prof: PublicLeadershipProfile) => {
    setEditingProfile(prof);
    setName(prof.name || '');
    setDesignation(prof.designation || '');
    setRoleCategory(prof.roleCategory || 'PRINCIPAL');
    setPhoto(prof.photo || prof.photoUrl || '');
    setPhotoFileKey(prof.photoFileKey || '');
    setQuote(prof.quote || '');
    setMessage(prof.message || prof.fullBio || '');
    setShortBio(prof.shortBio || '');
    setQualification(prof.education || prof.qualification || '');
    setExperience(prof.experience || '');
    setResponsibilities(prof.responsibilities || '');
    setEmail(prof.email || '');
    setPhone(prof.phone || '');
    setDisplayOrder(Number(prof.displayOrder) || 1);
    setIsActive(prof.isActive !== false && prof.active !== false);
    setShowOnWebsite(prof.showOnWebsite !== false);
    setShowProfile(prof.showProfile !== false);
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  // Upload handler for Modal Form
  const handleModalPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress(25);
      const result = await fileUploadService.uploadDirectToR2(
        file,
        'public-website/leadership',
        (progress) => {
          setUploadProgress(Math.min(95, Math.max(25, progress)));
        }
      );
      setPhoto(result.publicUrl);
      setPhotoFileKey(result.fileKey);
      setUploadProgress(100);
      showToast('success', 'Photo uploaded. Save form to finalize.');
      setTimeout(() => setUploadProgress(null), 1000);
    } catch (err: any) {
      showToast('error', `Upload failed: ${err.message || 'Please check network connection'}`);
      setUploadProgress(null);
    }
  };

  // Quick Replace Photo for existing member
  const handleTriggerQuickReplace = (id: string) => {
    setReplacingTargetId(id);
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = '';
      replaceFileInputRef.current.click();
    }
  };

  const handleExecuteQuickReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = replacingTargetId;
    if (!file || !targetId) return;

    const targetMember = sortedLeadership.find((m) => m.id === targetId);
    if (!targetMember) return;

    try {
      setUploadProgress(30);
      const result = await fileUploadService.uploadDirectToR2(
        file,
        'public-website/leadership',
        (progress) => setUploadProgress(Math.min(95, Math.max(30, progress)))
      );

      // Update member with new photo; backend PUT automatically deletes old stored photo
      await onUpdateProfile(targetId, {
        photo: result.publicUrl,
        photoUrl: result.publicUrl,
        photoFileKey: result.fileKey,
      });

      setUploadProgress(100);
      showToast('success', 'Photo replaced successfully.');
    } catch (err: any) {
      showToast('error', `Photo replacement failed: ${err.message || 'Please retry'}`);
    } finally {
      setReplacingTargetId(null);
      setTimeout(() => setUploadProgress(null), 800);
    }
  };

  // Save / Update Member Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'Full Name is required.');
      return;
    }
    if (!designation.trim()) {
      showToast('error', 'Designation is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<PublicLeadershipProfile> = {
        name: name.trim(),
        designation: designation.trim(),
        roleCategory,
        photo: photo || undefined,
        photoUrl: photo || undefined,
        photoFileKey: photoFileKey || undefined,
        quote: quote.trim() || undefined,
        message: message.trim() || undefined,
        fullBio: message.trim() || undefined,
        shortBio: shortBio.trim() || undefined,
        qualification: qualification.trim() || undefined,
        education: qualification.trim() || undefined,
        experience: experience.trim() || undefined,
        responsibilities: responsibilities.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        displayOrder: Number(displayOrder) || sortedLeadership.length + 1,
        isActive,
        active: isActive,
        showOnWebsite,
        showProfile,
      };

      if (editingProfile) {
        await onUpdateProfile(editingProfile.id, payload);
        showToast('success', 'Management profile updated successfully.');
      } else {
        await onSaveProfile(payload);
        showToast('success', 'Management member added successfully.');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast('error', `Error saving profile: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reordering: Move Up
  const handleMoveUp = async (member: PublicLeadershipProfile) => {
    const index = sortedLeadership.findIndex((m) => m.id === member.id);
    if (index <= 0) return;

    const previousMember = sortedLeadership[index - 1];
    const currentOrder = Number(member.displayOrder) || index + 1;
    const prevOrder = Number(previousMember.displayOrder) || index;

    // Swap orders
    await onUpdateProfile(member.id, { displayOrder: prevOrder });
    await onUpdateProfile(previousMember.id, { displayOrder: currentOrder });
    showToast('success', `Moved "${member.name}" up.`);
  };

  // Reordering: Move Down
  const handleMoveDown = async (member: PublicLeadershipProfile) => {
    const index = sortedLeadership.findIndex((m) => m.id === member.id);
    if (index === -1 || index >= sortedLeadership.length - 1) return;

    const nextMember = sortedLeadership[index + 1];
    const currentOrder = Number(member.displayOrder) || index + 1;
    const nextOrder = Number(nextMember.displayOrder) || index + 2;

    // Swap orders
    await onUpdateProfile(member.id, { displayOrder: nextOrder });
    await onUpdateProfile(nextMember.id, { displayOrder: currentOrder });
    showToast('success', `Moved "${member.name}" down.`);
  };

  // One-Click Status Toggle
  const handleToggleStatus = async (member: PublicLeadershipProfile) => {
    const nextState = !(member.isActive !== false && member.active !== false);
    await onUpdateProfile(member.id, { isActive: nextState, active: nextState });
    showToast('success', `Profile set to ${nextState ? 'Active' : 'Inactive'}.`);
  };

  // Delete Member
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onDeleteProfile(deleteTarget.id);
      showToast('success', 'Management member deleted successfully.');
      setDeleteTarget(null);
    } catch (err: any) {
      showToast('error', `Failed to delete member: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hidden input for quick photo replacement */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleExecuteQuickReplace}
      />

      {/* Floating Feedback Notification */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-bold shadow-md transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="p-1 hover:bg-black/10 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Global Upload Progress Bar */}
      {uploadProgress !== null && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-blue-900">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
              <span>Uploading portrait image to media storage...</span>
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-700 transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <span>Management Team</span>
            </h3>
            <p className="text-xs text-slate-500">
              Manage leadership profiles, designations, messages, photos, and public display order for
              Residential PDS Public School Sheohar.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Management Member</span>
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, designation, or qualification..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({sortedLeadership.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                statusFilter === 'INACTIVE'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Inactive ({inactiveCount})
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Table View (>= 1024px) */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <th className="py-3.5 px-4 w-16 text-center">Photo</th>
              <th className="py-3.5 px-4">Name & Designation</th>
              <th className="py-3.5 px-4 w-32 text-center">Status</th>
              <th className="py-3.5 px-4 w-36 text-center">Display Order</th>
              <th className="py-3.5 px-4 w-32">Updated</th>
              <th className="py-3.5 px-4 w-48 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredMembers.map((member, index) => {
              const photoSrc = mediaSrc(member.photo, member.photoUrl) || null;
              const isMemberActive = member.isActive !== false && member.active !== false;

              return (
                <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Photo Column */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="w-12 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 mx-auto relative group shrink-0">
                      {photoSrc ? (
                        <img
                          src={photoSrc}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => hideBrokenPhoto(e, member.name)}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-900 font-bold text-xs">
                          {member.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Name & Designation */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{member.name}</span>
                        {member.qualification && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                            {member.qualification}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="font-semibold text-blue-900">{member.designation}</span>
                        {member.shortBio && (
                          <span className="text-slate-400 text-[11px] truncate max-w-xs">
                            • {member.shortBio}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Status Toggle */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handleToggleStatus(member)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                        isMemberActive
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                      }`}
                      title="Click to toggle status"
                    >
                      {isMemberActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-slate-400" />
                          <span>Inactive</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Display Order Controls */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                      <button
                        onClick={() => handleMoveUp(member)}
                        disabled={index === 0}
                        className="p-1 hover:bg-slate-200 rounded disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5 text-slate-700" />
                      </button>
                      <span className="w-7 text-center font-bold text-slate-800">
                        {member.displayOrder || index + 1}
                      </span>
                      <button
                        onClick={() => handleMoveDown(member)}
                        disabled={index === sortedLeadership.length - 1}
                        className="p-1 hover:bg-slate-200 rounded disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5 text-slate-700" />
                      </button>
                    </div>
                  </td>

                  {/* Updated Date */}
                  <td className="py-3.5 px-4 text-slate-500">
                    {member.updatedAt
                      ? new Date(member.updatedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : 'Recently'}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* View Profile */}
                      <button
                        onClick={() => setPreviewProfile(member)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-600 hover:text-blue-900 transition cursor-pointer"
                        title="View profile preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Replace Photo */}
                      <button
                        onClick={() => handleTriggerQuickReplace(member.id)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-800 transition cursor-pointer"
                        title="Replace photo"
                      >
                        <Camera className="w-4 h-4" />
                      </button>

                      {/* Edit Details */}
                      <button
                        onClick={() => openEditModal(member)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-600 hover:text-blue-900 transition cursor-pointer"
                        title="Edit profile details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget(member)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-700">No management members found</p>
                  <p className="text-xs text-slate-400">
                    Try adjusting your search query or add a new profile.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile & Tablet Responsive Cards (< 1024px) */}
      <div className="lg:hidden space-y-4">
        {filteredMembers.map((member, index) => {
          const photoSrc = mediaSrc(member.photo, member.photoUrl) || null;
          const isMemberActive = member.isActive !== false && member.active !== false;

          return (
            <div
              key={member.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-xs"
            >
              {/* Card Header: Photo + Name + Designation */}
              <div className="flex items-start gap-3">
                <div className="w-16 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                  {photoSrc ? (
                    <img
                      src={photoSrc}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => hideBrokenPhoto(e, member.name)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-900 font-bold text-sm">
                      {member.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                      {member.designation}
                    </span>
                    <button
                      onClick={() => handleToggleStatus(member)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isMemberActive
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isMemberActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 truncate">{member.name}</h4>
                  {member.qualification && (
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      {member.qualification}
                    </p>
                  )}
                  {member.shortBio && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {member.shortBio}
                    </p>
                  )}
                </div>
              </div>

              {/* Order & Controls Row */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                  <span className="text-[11px] text-slate-500 font-medium">Order:</span>
                  <span className="font-bold text-slate-800">
                    {member.displayOrder || index + 1}
                  </span>
                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      onClick={() => handleMoveUp(member)}
                      disabled={index === 0}
                      className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3 h-3 text-slate-700" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(member)}
                      disabled={index === sortedLeadership.length - 1}
                      className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3 h-3 text-slate-700" />
                    </button>
                  </div>
                </div>

                {/* Mobile Quick Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPreviewProfile(member)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleTriggerQuickReplace(member.id)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-amber-50 text-slate-600"
                    title="Replace Photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(member)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-blue-50 text-slate-600"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(member)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredMembers.length === 0 && (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
            No management members match your search.
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL (Section 5 Requirement) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {editingProfile ? 'Edit Management Member' : 'Add Management Member'}
                </h3>
                <p className="text-xs text-slate-500">
                  Fill in the credentials, portrait photo, and official statement.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Photo Upload & Live Preview */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Portrait Profile Photo <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-30 rounded-xl overflow-hidden bg-slate-200 border-2 border-slate-300 shadow-2xs shrink-0 flex items-center justify-center">
                    {photo && photo.trim() ? (
                      <img
                        src={mediaSrc(photo)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Camera className="w-8 h-8 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                      <button
                        type="button"
                        onClick={() => modalFileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                      >
                        {photo ? 'Replace Photo' : 'Upload Photo'}
                      </button>
                      {photo && (
                        <button
                          type="button"
                          onClick={() => {
                            setPhoto('');
                            setPhotoFileKey('');
                          }}
                          className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Recommended: High resolution 4:5 vertical portrait image (JPG, PNG, WebP).
                    </p>
                    <input
                      ref={modalFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleModalPhotoUpload}
                    />
                  </div>
                </div>
              </div>

              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Basic Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Rajesh Kumar Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Designation <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Principal / Director"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Role Category
                    </label>
                    <select
                      value={roleCategory}
                      onChange={(e) => setRoleCategory(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-hidden bg-white"
                    >
                      <option value="PRINCIPAL">Principal</option>
                      <option value="DIRECTOR">Director / Secretary</option>
                      <option value="CHAIRMAN">Chairman / Founder</option>
                      <option value="ACADEMIC_HEAD">Academic Head</option>
                      <option value="MANAGEMENT">Board of Management</option>
                      <option value="OTHER">Other Administrator</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={displayOrder}
                      onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Short Bio (Summary shown on landing cards)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief 1-2 sentence description of background and leadership focus..."
                    value={shortBio}
                    onChange={(e) => setShortBio(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Profile / Official Message
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Detailed official statement, educational philosophy, or full message to parents..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Optional Credentials */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Optional Credentials & Contact
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Education / Qualification
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. M.Sc. (Physics), B.Ed., Ph.D."
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Professional Experience
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 18+ Years in Senior CBSE School Administration"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Key Responsibilities
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Curriculum planning, faculty development, residential hostel supervision"
                    value={responsibilities}
                    onChange={(e) => setResponsibilities(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quote / Vision Statement
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Education is the light that awakens the innate intellect of every child."
                    value={quote}
                    onChange={(e) => setQuote(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Official Email
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. principal@pdsresidential.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 9507595491"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Website Display Settings */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Website Display Settings
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-bold text-slate-800">Active Status</span>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-blue-900 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-bold text-slate-800">Show on Team</span>
                    <input
                      type="checkbox"
                      checked={showOnWebsite}
                      onChange={(e) => setShowOnWebsite(e.target.checked)}
                      className="w-4 h-4 text-blue-900 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-bold text-slate-800">Allow More Info</span>
                    <input
                      type="checkbox"
                      checked={showProfile}
                      onChange={(e) => setShowProfile(e.target.checked)}
                      className="w-4 h-4 text-blue-900 rounded focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingProfile ? 'Update Member' : 'Save Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-base font-bold text-slate-900">Delete Management Member?</h4>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove <strong>&quot;{deleteTarget.name}&quot;</strong>? Their
                portrait photo will also be removed from storage.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Delete Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Preview Modal */}
      <PublicManagementProfileModal
        member={previewProfile}
        isOpen={!!previewProfile}
        onClose={() => setPreviewProfile(null)}
      />
    </div>
  );
};
