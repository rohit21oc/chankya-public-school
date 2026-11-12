import React, { useState, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Calendar,
  Layers,
  GraduationCap,
} from 'lucide-react';
import { PublicGalleryItem } from '../../types';
import { api } from '../../services/api';
import { mediaSrc, visibleInOrder } from '../../utils/publicMedia';
import { schoolIdentity } from '../../utils/schoolIdentity';

/** School identity from saved School Settings (hidden when a value is not saved). */
const pub = () => schoolIdentity(api.getSettings());
const pubContacts = () => [pub().phones.join(' | '), pub().helpline ? `(Helpline: ${pub().helpline})` : ''].filter(Boolean).join(' ');
const pubNameLine = () => pub().name;

export const PublicGallerySection: React.FC = () => {
  const [gallery, setGallery] = useState<PublicGalleryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    api.getGallery().then((data) => {
      // Only photos switched on in Public Website Management, in their display order.
      if (isMounted) setGallery(visibleInOrder(data));
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // The stored file key first (always valid), then the saved address.
  const getGalleryImageSrc = (item: PublicGalleryItem): string => mediaSrc(item.image, item.imageUrl, (item as any).fileKey);

  // Filters come from the photos themselves, so every category used in the admin panel can be picked
  // (the old fixed list did not match the admin's categories and those photos never showed up).
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(gallery.map((g) => String(g.category || '').trim()).filter(Boolean)))],
    [gallery]
  );

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'All') return gallery;
    return gallery.filter((item) => item.category === selectedCategory);
  }, [gallery, selectedCategory]);

  const activePhoto = activePhotoIndex !== null ? filteredItems[activePhotoIndex] : null;

  const handleNextPhoto = () => {
    if (activePhotoIndex !== null) {
      setActivePhotoIndex((activePhotoIndex + 1) % filteredItems.length);
    }
  };

  const handlePrevPhoto = () => {
    if (activePhotoIndex !== null) {
      setActivePhotoIndex((activePhotoIndex - 1 + filteredItems.length) % filteredItems.length);
    }
  };

  return (
    <section id="gallery" className="py-16 sm:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Photo Gallery & Campus Memories
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            A visual glimpse into our vibrant school life, academic laboratories, annual sports meets, national celebrations, and student achievements in Sheohar.
          </p>

          {/* Filter Categories */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-3">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 max-w-lg mx-auto space-y-3">
            <ImageIcon className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-lg font-bold text-slate-800">No Gallery Photos Published</h3>
            <p className="text-xs text-slate-500">
              Campus and event photographs published through the administrative portal will appear here dynamically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item, idx) => {
              const imgSrc = getGalleryImageSrc(item);
              const isError = imageErrors[item.id] || !imgSrc || imgSrc.trim() === '';

              return (
                <div
                  key={item.id}
                  onClick={() => setActivePhotoIndex(idx)}
                  className="group relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 aspect-4/3 cursor-pointer shadow-xs hover:shadow-lg transition-all duration-200"
                >
                  {!isError ? (
                    <img loading="lazy" decoding="async"
                      src={imgSrc}
                      alt={item.title ? `${item.title} - CHANAKYA PUBLIC SCHOOL & COACHING CENTRE` : 'Campus photo - CHANAKYA PUBLIC SCHOOL & COACHING CENTRE'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      onError={() => setImageErrors((prev) => ({ ...prev, [item.id]: true }))}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#051437] via-[#0B1F4B] to-[#123B8C] flex flex-col items-center justify-center p-4 text-white text-center">
                      <div className="w-10 h-10 rounded-xl bg-white/10 border border-[#D9A441]/40 flex items-center justify-center mb-2 shadow-inner">
                        <GraduationCap className="w-5 h-5 text-[#F3D27A]" />
                      </div>
                      <span className="text-[10px] font-bold text-[#F3D27A] uppercase tracking-wider mb-1">
                        {item.category}
                      </span>
                      <h4 className="text-xs font-bold text-white line-clamp-2 px-2">{item.title}</h4>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-4 text-white">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      {item.category}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{item.title}</h4>
                    {item.caption && (
                      <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">{item.caption}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {activePhoto && (() => {
        const modalImgSrc = getGalleryImageSrc(activePhoto);
        const isModalError = imageErrors[activePhoto.id] || !modalImgSrc || modalImgSrc.trim() === '';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
            <button
              type="button"
              onClick={() => setActivePhotoIndex(null)}
              className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handlePrevPhoto}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={handleNextPhoto}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            <div className="max-w-4xl w-full max-h-[85vh] flex flex-col items-center">
              {!isModalError ? (
                <img
                  src={modalImgSrc}
                  alt={activePhoto.title ? `${activePhoto.title} - CHANAKYA PUBLIC SCHOOL & COACHING CENTRE` : 'Enlarged campus photo - CHANAKYA PUBLIC SCHOOL & COACHING CENTRE'}
                  className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
                  referrerPolicy="no-referrer"
                  onError={() => setImageErrors((prev) => ({ ...prev, [activePhoto.id]: true }))}
                />
              ) : (
                <div className="w-full max-w-lg rounded-2xl bg-gradient-to-br from-[#051437] via-[#0B1F4B] to-[#123B8C] border border-white/20 p-8 text-center text-white space-y-3 shadow-2xl">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 border border-[#D9A441]/40 flex items-center justify-center shadow-inner">
                    <GraduationCap className="w-8 h-8 text-[#F3D27A]" />
                  </div>
                  <span className="text-xs font-bold text-[#F3D27A] uppercase tracking-widest block">
                    {activePhoto.category}
                  </span>
                  <h3 className="text-lg font-bold text-white">{activePhoto.title}</h3>
                  <p className="text-xs text-slate-200">
                    {activePhoto.description || activePhoto.caption || pubNameLine()}
                  </p>
                </div>
              )}
              <div className="text-center mt-4 text-white space-y-1 max-w-xl">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                  {activePhoto.category}
                </span>
                <h3 className="text-base sm:text-lg font-bold">{activePhoto.title}</h3>
                {activePhoto.caption && <p className="text-xs text-slate-300">{activePhoto.caption}</p>}
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
};
