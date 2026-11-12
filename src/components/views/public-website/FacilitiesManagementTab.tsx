import React, { useState } from 'react';
import {
  Building,
  Plus,
  Trash2,
  Edit2,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  BookOpen,
  FlaskConical,
  Laptop,
  Bus,
  Home,
  Trophy,
} from 'lucide-react';
import { PublicFacility } from '../../../types';
import { fileUploadService } from '../../../services/fileUploadService';
import { mediaSrc } from '../../../utils/publicMedia';

interface FacilitiesManagementTabProps {
  facilities: PublicFacility[];
  onSaveFacility: (facility: Partial<PublicFacility>) => Promise<void>;
  onUpdateFacility: (id: string, updates: Partial<PublicFacility>) => Promise<void>;
  onDeleteFacility: (id: string) => Promise<void>;
}

export const FacilitiesManagementTab: React.FC<FacilitiesManagementTabProps> = ({
  facilities = [],
  onSaveFacility,
  onUpdateFacility,
  onDeleteFacility,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<PublicFacility | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('ACADEMIC');
  const [imageUrl, setImageUrl] = useState('');
  const [iconName, setIconName] = useState('BookOpen');
  const [featureInput, setFeatureInput] = useState('');
  const [featuresList, setFeaturesList] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  const openAddModal = () => {
    setEditingFacility(null);
    setTitle('');
    setDescription('');
    setCategory('ACADEMIC');
    setImageUrl('');
    setIconName('BookOpen');
    setFeatureInput('');
    setFeaturesList(['Modern Infrastructure', 'Well Equipped', 'Safety Certified']);
    setIsActive(true);
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const openEditModal = (fac: PublicFacility) => {
    setEditingFacility(fac);
    setTitle(fac.title);
    setDescription(fac.description);
    setCategory(fac.category || 'ACADEMIC');
    setImageUrl(fac.imageUrl || fac.image || '');
    setIconName(fac.iconName || 'BookOpen');
    setFeatureInput('');
    setFeaturesList(fac.features || []);
    setIsActive(fac.isActive !== false);
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress(15);
      const result = await fileUploadService.uploadDirectToR2(
        file,
        'public-website/facilities',
        (progress) => {
          setUploadProgress(Math.min(95, Math.max(15, progress)));
        }
      );
      setImageUrl(result.publicUrl);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 1000);
    } catch (err: any) {
      alert(`Upload failed: ${err.message || 'Please check network connection'}`);
      setUploadProgress(null);
    }
  };

  const addFeature = () => {
    if (!featureInput.trim()) return;
    setFeaturesList([...featuresList, featureInput.trim()]);
    setFeatureInput('');
  };

  const removeFeature = (idx: number) => {
    setFeaturesList(featuresList.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Title and description are required');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<PublicFacility> = {
        title: title.trim(),
        description: description.trim(),
        category,
        imageUrl: imageUrl || undefined,
        image: imageUrl || undefined,
        iconName,
        features: featuresList,
        isActive,
      };

      if (editingFacility) {
        await onUpdateFacility(editingFacility.id, payload);
      } else {
        await onSaveFacility({
          ...payload,
          displayOrder: facilities.length + 1,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Error saving facility: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderIcon = (name?: string) => {
    switch (name) {
      case 'FlaskConical':
        return <FlaskConical className="w-5 h-5" />;
      case 'Laptop':
        return <Laptop className="w-5 h-5" />;
      case 'Home':
        return <Home className="w-5 h-5" />;
      case 'Bus':
        return <Bus className="w-5 h-5" />;
      case 'Trophy':
        return <Trophy className="w-5 h-5" />;
      default:
        return <BookOpen className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-teal-600" />
            <span>Campus Infrastructure & Facilities</span>
          </h3>
          <p className="text-xs text-slate-500">
            Showcase classrooms, science laboratories, digital learning labs, boarding hostel, and athletic grounds.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Facility</span>
        </button>
      </div>

      {/* Facilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(facilities || []).map((fac) => {
          const img = mediaSrc((fac as any).imageFileKey, fac.image, fac.imageUrl) || null;
          return (
            <div
              key={fac.id}
              className={`p-5 rounded-2xl bg-white border transition shadow-xs flex flex-col justify-between space-y-4 ${
                fac.isActive === false ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:border-teal-300'
              }`}
            >
              <div className="space-y-3">
                {/* Image */}
                <div className="h-36 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative flex items-center justify-center">
                  {img ? (
                    <img
                      src={img}
                      alt={fac.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Building className="w-10 h-10 text-slate-300" />
                  )}
                  <div className="absolute top-2 left-2 p-2 rounded-lg bg-slate-900/80 text-teal-300 backdrop-blur-xs">
                    {renderIcon(fac.iconName)}
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900">{fac.title}</h4>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {fac.description}
                  </p>
                </div>

                {/* Features Pills */}
                {fac.features && fac.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {fac.features.map((feat, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-100"
                      >
                        ✓ {feat}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <button
                  onClick={() => onUpdateFacility(fac.id, { isActive: fac.isActive === false })}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer ${
                    fac.isActive !== false ? 'text-teal-700 bg-teal-50' : 'text-slate-500 bg-slate-100'
                  }`}
                >
                  {fac.isActive !== false ? 'Published' : 'Hidden'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(fac)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition cursor-pointer"
                    title="Edit facility"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTargetId(fac.id)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Delete facility"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {facilities.length === 0 && (
          <div className="col-span-full p-12 text-center rounded-2xl bg-white border border-dashed border-slate-300 space-y-3">
            <Building className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">No facilities recorded</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your laboratories, library, boarding infrastructure, and sports facilities.
            </p>
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Facility */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                {editingFacility ? 'Edit Campus Facility' : 'Add Campus Facility'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Facility Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Modern Physics & Chemistry Laboratories"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="ACADEMIC">Academic & Labs</option>
                    <option value="HOSTEL">Boarding & Hostel</option>
                    <option value="SPORTS">Sports & Fitness</option>
                    <option value="TRANSPORT">Fleet & Transport</option>
                    <option value="GENERAL">General Campus</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Icon</label>
                  <select
                    value={iconName}
                    onChange={(e) => setIconName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="BookOpen">Book / Academic</option>
                    <option value="FlaskConical">Science Flask / Lab</option>
                    <option value="Laptop">Computer / Digital</option>
                    <option value="Home">Hostel / Home</option>
                    <option value="Bus">Bus / Transport</option>
                    <option value="Trophy">Sports / Trophy</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Description *</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details of student capacity, equipment, and learning impact..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs leading-relaxed focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              {/* Photo Upload */}
              <div className="space-y-2 p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                <label className="font-bold text-slate-700 block">Facility photo</label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs transition">
                    <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                  {imageUrl && <span className="text-[11px] text-teal-700 font-bold">Photo linked</span>}
                  {uploadProgress !== null && (
                    <span className="text-[11px] font-bold text-teal-600">
                      Uploading {uploadProgress}%
                    </span>
                  )}
                </div>

                <input
                  // Text, not "url": uploads fill in a site-relative path (/api/files/content?key=...),
                  // which the browser's URL check rejects and blocks saving.
                  type="text"
                  inputMode="url"
                  spellCheck={false}
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Or enter direct CDN image URL..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              {/* Features List */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Key Feature Highlights</label>
                <div className="flex flex-wrap gap-1.5">
                  {featuresList.map((f, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 flex items-center gap-1"
                    >
                      <span>{f}</span>
                      <button
                        type="button"
                        onClick={() => removeFeature(i)}
                        className="text-slate-400 hover:text-rose-600 ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    placeholder="Add feature highlight (e.g. Smart Projector)..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold text-xs"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="facActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300"
                />
                <label htmlFor="facActive" className="font-bold text-slate-800 cursor-pointer">
                  Show on public website facilities section
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingFacility ? 'Save Changes' : 'Create Facility'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4">
            <h4 className="text-base font-bold text-slate-900">Remove Campus Facility?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              This facility will be removed from the public website showcase.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onDeleteFacility(deleteTargetId);
                  setDeleteTargetId(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Delete Facility
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
