import React, { useState } from 'react';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  Eye,
  CheckCircle2,
  XCircle,
  UploadCloud,
  Loader2,
  ExternalLink,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { PublicHeroSlide } from '../../../types';
import { fileUploadService } from '../../../services/fileUploadService';
import { affiliationText, schoolIdentity } from '../../../utils/schoolIdentity';
import { api } from '../../../services/api';
import { mediaSrc } from '../../../utils/publicMedia';

interface HeroSliderTabProps {
  slides: PublicHeroSlide[];
  onSaveSlide: (slide: Partial<PublicHeroSlide>) => Promise<void>;
  onUpdateSlide: (id: string, updates: Partial<PublicHeroSlide>) => Promise<void>;
  onDeleteSlide: (id: string) => Promise<void>;
  onReorderSlides: (reordered: PublicHeroSlide[]) => Promise<void>;
}

export const HeroSliderTab: React.FC<HeroSliderTabProps> = ({
  slides = [],
  onSaveSlide,
  onUpdateSlide,
  onDeleteSlide,
  onReorderSlides,
}) => {
  const [editingSlide, setEditingSlide] = useState<PublicHeroSlide | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [badge, setBadge] = useState('');
  const [description, setDescription] = useState('');
  const [primaryCtaText, setPrimaryCtaText] = useState('ADMISSION ENQUIRY');
  const [primaryCtaAction, setPrimaryCtaAction] = useState('enquiry');
  const [secondaryCtaText, setSecondaryCtaText] = useState('EXPLORE CAMPUS');
  const [secondaryCtaAction, setSecondaryCtaAction] = useState('facilities');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFileKey, setImageFileKey] = useState('');
  const [mobileImageUrl, setMobileImageUrl] = useState('');
  const [mobileImageFileKey, setMobileImageFileKey] = useState('');
  const [isActive, setIsActive] = useState(true);

  const openAddModal = () => {
    setEditingSlide(null);
    setTitle('');
    setSubtitle('');
    setBadge(affiliationText(schoolIdentity(api.getSettings()), 'Affiliation Code'));
    setDescription('');
    setPrimaryCtaText('ADMISSION ENQUIRY');
    setPrimaryCtaAction('enquiry');
    setSecondaryCtaText('EXPLORE CAMPUS');
    setSecondaryCtaAction('facilities');
    setImageUrl('');
    setImageFileKey('');
    setMobileImageUrl('');
    setMobileImageFileKey('');
    setIsActive(true);
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const openEditModal = (slide: PublicHeroSlide) => {
    setEditingSlide(slide);
    setTitle(slide.title || '');
    setSubtitle(slide.subtitle || '');
    setBadge(slide.badge || '');
    setDescription(slide.description || '');
    setPrimaryCtaText(slide.primaryCtaText || 'ADMISSION ENQUIRY');
    setPrimaryCtaAction(slide.primaryCtaAction || 'enquiry');
    setSecondaryCtaText(slide.secondaryCtaText || 'EXPLORE CAMPUS');
    setSecondaryCtaAction(slide.secondaryCtaAction || 'facilities');
    setImageUrl(slide.desktopImage || slide.imageUrl || slide.image || '');
    setImageFileKey(slide.desktopImageFileKey || '');
    setMobileImageUrl(slide.mobileImage || '');
    setMobileImageFileKey(slide.mobileImageFileKey || '');
    setIsActive(slide.isActive !== false);
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'desktop' | 'mobile'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress(10);
      const result = await fileUploadService.uploadDirectToR2(
        file,
        'public-website/hero',
        (progress) => {
          setUploadProgress(Math.min(95, Math.max(10, progress)));
        }
      );

      if (type === 'desktop') {
        setImageUrl(result.publicUrl);
        setImageFileKey(result.fileKey);
      } else {
        setMobileImageUrl(result.publicUrl);
        setMobileImageFileKey(result.fileKey);
      }
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 1000);
    } catch (err: any) {
      alert(`Image upload failed: ${err.message || 'Please check network connection'}`);
      setUploadProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Title is optional: a banner image can carry its own message.
    if (!title.trim() && !imageUrl.trim()) {
      alert('Please add a banner image or a headline title');
      return;
    }

    try {
      setIsSubmitting(true);
      const slidePayload: Partial<PublicHeroSlide> = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        badge: badge.trim(),
        description: description.trim(),
        primaryCtaText: primaryCtaText.trim(),
        primaryCtaAction,
        secondaryCtaText: secondaryCtaText.trim(),
        secondaryCtaAction,
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1600&auto=format&fit=crop&q=85',
        desktopImage: imageUrl || 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1600&auto=format&fit=crop&q=85',
        desktopImageFileKey: imageFileKey || undefined,
        mobileImage: mobileImageUrl || undefined,
        mobileImageFileKey: mobileImageFileKey || undefined,
        isActive,
      };

      if (editingSlide) {
        await onUpdateSlide(editingSlide.id, slidePayload);
      } else {
        await onSaveSlide({
          ...slidePayload,
          displayOrder: slides.length + 1,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Failed to save slide: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const moveSlide = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= slides.length) return;

    const newSlides = [...slides];
    const temp = newSlides[index];
    newSlides[index] = newSlides[targetIdx];
    newSlides[targetIdx] = temp;

    // Re-assign displayOrder
    const updated = newSlides.map((s, idx) => ({ ...s, displayOrder: idx + 1 }));
    await onReorderSlides(updated);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>Hero Slider & Homepage Banners</span>
          </h3>
          <p className="text-xs text-slate-500">
            Manage prominent slideshow banners, call-to-action buttons, and high-resolution visuals.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Slide</span>
        </button>
      </div>

      {/* Slides list */}
      <div className="space-y-4">
        {(slides || []).map((slide, idx) => {
          const img = mediaSrc((slide as any).desktopImageFileKey, slide.desktopImage, slide.imageUrl, slide.image) || null;
          return (
            <div
              key={slide.id}
              className={`p-5 rounded-2xl bg-white border transition shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5 ${
                slide.isActive === false ? 'opacity-60 bg-slate-50 border-slate-200' : 'border-slate-200 hover:border-amber-300'
              }`}
            >
              <div className="flex items-start gap-4 min-w-0">
                {/* Thumbnail */}
                <div className="w-28 h-20 sm:w-36 sm:h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                  {img ? (
                    <img
                      src={img}
                      alt={slide.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded text-[10px] font-black bg-slate-950/70 text-amber-300 backdrop-blur-xs">
                    #{idx + 1}
                  </span>
                </div>

                {/* Content */}
                <div className="space-y-1.5 min-w-0">
                  {slide.badge && (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      {slide.badge}
                    </span>
                  )}
                  <h4 className="text-base font-black text-slate-900 truncate">
                    {slide.title || <span className="font-semibold italic text-slate-500">Image only (no headline)</span>}
                  </h4>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed max-w-2xl">
                    {slide.subtitle}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">
                      Primary CTA: <span className="text-amber-700 font-bold">{slide.primaryCtaText}</span> ({slide.primaryCtaAction})
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700">
                      Secondary: <span className="text-slate-900 font-bold">{slide.secondaryCtaText}</span> ({slide.secondaryCtaAction})
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                {/* Active Switch */}
                <button
                  onClick={() => onUpdateSlide(slide.id, { isActive: slide.isActive === false })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    slide.isActive !== false
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                  }`}
                  title="Toggle visibility on website"
                >
                  {slide.isActive !== false ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Live</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>Hidden</span>
                    </>
                  )}
                </button>

                {/* Move Up / Down */}
                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                  <button
                    disabled={idx === 0}
                    onClick={() => moveSlide(idx, 'up')}
                    className="p-1.5 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Move slide up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    disabled={idx === slides.length - 1}
                    onClick={() => moveSlide(idx, 'down')}
                    className="p-1.5 hover:bg-slate-200 text-slate-600 border-l border-slate-200 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Move slide down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Edit */}
                <button
                  onClick={() => openEditModal(slide)}
                  className="p-2 rounded-lg border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-700 hover:text-amber-900 transition cursor-pointer"
                  title="Edit banner"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => setDeleteTargetId(slide.id)}
                  className="p-2 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-700 transition cursor-pointer"
                  title="Delete slide"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {slides.length === 0 && (
          <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-slate-300 space-y-3">
            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">No Hero Banners Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click &quot;Add New Slide&quot; above to create your first homepage banner.
            </p>
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Slide */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">
                {editingSlide ? 'Edit Hero Banner' : 'Create New Hero Banner'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Image Upload Area */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">
                  Banner image (desktop)
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
                  <div className="w-full sm:w-44 h-24 rounded-lg bg-slate-200 overflow-hidden shrink-0 relative flex items-center justify-center border border-slate-200">
                    {imageUrl && imageUrl.trim() ? (
                      <img
                        src={mediaSrc(imageUrl)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-2 flex-1 w-full">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs transition">
                      <UploadCloud className="w-4 h-4 text-amber-400" />
                      <span>Upload image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, 'desktop')}
                      />
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Recommended resolution: 1920x800px (JPG, PNG, WEBP max 5MB).
                    </p>
                    {uploadProgress !== null && (
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct Image URL fallback */}
                <div className="pt-1">
                  <span className="text-[11px] text-slate-500 block mb-1">Or Direct Image CDN URL:</span>
                  <input
                    // Text, not "url": uploads fill in a site-relative path (/api/files/content?key=...),
                    // which the browser's URL check rejects and blocks saving.
                    type="text"
                    inputMode="url"
                    spellCheck={false}
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/... or /api/files/content?key=..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Title & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700">Headline Title <span className="font-normal text-slate-500">(optional)</span></label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. LEARN. LEAD. GROW."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Top Badge</label>
                  <input
                    type="text"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    placeholder="e.g. Admissions open 2026-27"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Subtitle */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Subheading / Description</label>
                <textarea
                  rows={3}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Provide an inspiring 1-2 sentence description..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs leading-relaxed focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* CTAs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-2">
                  <label className="font-bold text-slate-900 block">Primary Action Button</label>
                  <input
                    type="text"
                    value={primaryCtaText}
                    onChange={(e) => setPrimaryCtaText(e.target.value)}
                    placeholder="Button Text"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
                  />
                  <select
                    value={primaryCtaAction}
                    onChange={(e) => setPrimaryCtaAction(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="enquiry">Opens Admission Enquiry Modal</option>
                    <option value="facilities">Scrolls to Facilities</option>
                    <option value="admissions">Scrolls to Admissions</option>
                    <option value="results">Navigates to Board Results</option>
                    <option value="contact">Scrolls to Contact Info</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-slate-900 block">Secondary Action Button</label>
                  <input
                    type="text"
                    value={secondaryCtaText}
                    onChange={(e) => setSecondaryCtaText(e.target.value)}
                    placeholder="Button Text"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
                  />
                  <select
                    value={secondaryCtaAction}
                    onChange={(e) => setSecondaryCtaAction(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="facilities">Scrolls to Facilities</option>
                    <option value="enquiry">Opens Admission Enquiry Modal</option>
                    <option value="admissions">Scrolls to Admissions</option>
                    <option value="results">Navigates to Board Results</option>
                    <option value="contact">Scrolls to Contact Info</option>
                  </select>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="slideIsActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <label htmlFor="slideIsActive" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Publish this slide immediately to the public website
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingSlide ? 'Save Slide Changes' : 'Create Hero Banner'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Slide */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4">
            <h4 className="text-base font-bold text-slate-900">Remove Hero Banner?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove this banner from the public homepage slider? Associated
              image files will also be unlinked.
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
                  await onDeleteSlide(deleteTargetId);
                  setDeleteTargetId(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Delete Banner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
