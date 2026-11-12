import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Plus,
  UploadCloud,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  Tag,
  Filter,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { PublicGalleryItem } from '../../../types';
import { fileUploadService } from '../../../services/fileUploadService';
import { mediaSrc } from '../../../utils/publicMedia';

const CATEGORIES = [
  'All',
  'Campus',
  'Smart Classes',
  'Science Lab',
  'Sports',
  'Cultural',
  'Hostel',
  'Annual Function',
];

interface GalleryManagementTabProps {
  gallery: PublicGalleryItem[];
  onSaveItem: (item: Partial<PublicGalleryItem>) => Promise<void>;
  onUpdateItem: (id: string, updates: Partial<PublicGalleryItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export const GalleryManagementTab: React.FC<GalleryManagementTabProps> = ({
  gallery = [],
  onSaveItem,
  onUpdateItem,
  onDeleteItem,
}) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PublicGalleryItem | null>(null);
  const [previewLightboxUrl, setPreviewLightboxUrl] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Campus');
  const [imageUrl, setImageUrl] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [isActive, setIsActive] = useState(true);

  const safeGallery = Array.isArray(gallery) ? gallery : [];
  // Built-in categories plus any category already used by a photo (older photos used other names;
  // without them those photos could not be filtered and editing one would silently change its category).
  const allCategories = Array.from(new Set([...CATEGORIES, ...safeGallery.map((g) => String(g.category || '').trim()).filter(Boolean)]));

  const filteredGallery =
    activeCategory === 'All'
      ? safeGallery
      : safeGallery.filter((item) => item.category === activeCategory);

  const openAddModal = () => {
    setEditingItem(null);
    setTitle('');
    setCategory(activeCategory === 'All' ? 'Campus' : activeCategory);
    setImageUrl('');
    setFileKey('');
    setIsActive(true);
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: PublicGalleryItem) => {
    setEditingItem(item);
    setTitle(item.title || '');
    setCategory(item.category || 'Campus');
    setImageUrl(item.imageUrl || item.image || '');
    // Keep the stored key so saving an edit does not swap it for the address form.
    setFileKey(item.image && !/^(https?:|data:|\/api\/)/i.test(item.image) ? item.image : '');
    setIsActive(item.isActive !== false);
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
        'public-website/gallery',
        (progress) => {
          setUploadProgress(Math.min(95, Math.max(15, progress)));
        }
      );
      setImageUrl(result.publicUrl);
      setFileKey(result.fileKey);
      if (!title) {
        // Auto populate title from file name without extension
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 1000);
    } catch (err: any) {
      alert(`Upload failed: ${err.message || 'Please check network connection'}`);
      setUploadProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please provide a photo caption or title');
      return;
    }
    if (!imageUrl.trim()) {
      alert('Please upload an image or provide an image URL');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<PublicGalleryItem> = {
        title: title.trim(),
        category,
        image: fileKey || imageUrl,
        imageUrl,
        isActive,
      };

      if (editingItem) {
        await onUpdateItem(editingItem.id, payload);
      } else {
        await onSaveItem({
          ...payload,
          displayOrder: gallery.length + 1,
          createdAt: new Date().toISOString().substring(0, 10),
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Error saving photo: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-600" />
            <span>School Photo Gallery Management</span>
          </h3>
          <p className="text-xs text-slate-500">
            Upload campus infrastructure photos, student life, sports, and laboratory activities.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Photo to Gallery</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeCategory === cat
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {cat}
            <span
              className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                activeCategory === cat ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {cat === 'All'
                ? safeGallery.length
                : safeGallery.filter((g) => g.category === cat).length}
            </span>
          </button>
        ))}
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {(filteredGallery || []).map((item) => {
          const img = mediaSrc(item.image, item.imageUrl);
          return (
            <div
              key={item.id}
              className={`group bg-white rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between ${
                item.isActive === false ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              {/* Image Container */}
              <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                {img && img.trim() ? (
                  <img
                    src={img}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
                <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/70 text-white backdrop-blur-xs">
                  {item.category}
                </span>

                {/* Lightbox Quick View */}
                {img && img.trim() && (
                  <button
                    onClick={() => setPreviewLightboxUrl(img || null)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 transition hover:bg-slate-900 cursor-pointer"
                    title="View full image"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Card Footer */}
              <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1" title={item.title}>
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Added: {item.createdAt || 'Standard Collection'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  {/* Active Toggle */}
                  <button
                    onClick={() => onUpdateItem(item.id, { isActive: item.isActive === false })}
                    className={`text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer ${
                      item.isActive !== false
                        ? 'text-emerald-700 bg-emerald-50'
                        : 'text-slate-500 bg-slate-100'
                    }`}
                  >
                    {item.isActive !== false ? 'Active' : 'Hidden'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                      title="Edit photo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTargetId(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Delete photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredGallery.length === 0 && (
          <div className="col-span-full p-12 text-center rounded-2xl bg-white border border-dashed border-slate-300 space-y-3">
            <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">No photos in {activeCategory} category</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Upload memories or select a different category filter above.
            </p>
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Photo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                {editingItem ? 'Edit Gallery Photo' : 'Upload Gallery Photo'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Upload to Cloudflare R2 */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Photo</label>
                <div className="aspect-16/10 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-4 text-center overflow-hidden relative">
                  {imageUrl && imageUrl.trim() ? (
                    <img
                      src={mediaSrc(imageUrl)}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="space-y-2">
                      <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-[11px] text-slate-500">JPG, PNG, WEBP (Max 5MB)</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition shadow-xs">
                    <UploadCloud className="w-4 h-4 text-amber-400" />
                    <span>Upload photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                  {uploadProgress !== null && (
                    <span className="text-xs font-bold text-blue-600">Uploading {uploadProgress}%</span>
                  )}
                </div>

                <div className="pt-1">
                  <span className="text-[11px] text-slate-500 block mb-1">Or direct CDN Image URL:</span>
                  <input
                    // Text, not "url": uploads fill in a site-relative path (/api/files/content?key=...),
                    // which the browser's URL check rejects and blocks saving.
                    type="text"
                    inputMode="url"
                    spellCheck={false}
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/... or /api/files/content?key=..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Caption / Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Modern Physics Lab Experiment"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Display Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  {allCategories.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="galleryActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="galleryActive" className="font-bold text-slate-800 cursor-pointer">
                  Publish to website immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingItem ? 'Save Changes' : 'Add to Gallery'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {previewLightboxUrl && previewLightboxUrl.trim() && (
        <div
          onClick={() => setPreviewLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md cursor-pointer animate-in fade-in"
        >
          <div className="max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl relative">
            <img
              src={previewLightboxUrl}
              alt="Enlarged preview"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
            <button
              onClick={() => setPreviewLightboxUrl(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 text-white font-bold hover:bg-slate-800 text-xs"
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4">
            <h4 className="text-base font-bold text-slate-900">Delete Photo from Gallery?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              This photo will be permanently unlinked from the public school gallery website.
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
                  await onDeleteItem(deleteTargetId);
                  setDeleteTargetId(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Delete Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
