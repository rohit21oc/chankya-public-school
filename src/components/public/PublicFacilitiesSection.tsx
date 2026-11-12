import React, { useState, useEffect, useMemo } from 'react';
import {
  Building,
  Home,
  Bus,
  FlaskConical,
  Laptop,
  BookOpen,
  Trophy,
  ShieldCheck,
  CheckCircle2,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { PublicFacility } from '../../types';
import { api } from '../../services/api';
import { mediaSrc, visibleInOrder } from '../../utils/publicMedia';

interface PublicFacilitiesSectionProps {
  onOpenEnquiry: () => void;
}

export const PublicFacilitiesSection: React.FC<PublicFacilitiesSectionProps> = ({
  onOpenEnquiry,
}) => {
  const [facilities, setFacilities] = useState<PublicFacility[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeFacility, setActiveFacility] = useState<PublicFacility | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    api.getFacilities().then((data) => {
      // Only facilities switched on in Public Website Management, in their display order.
      if (isMounted) setFacilities(visibleInOrder(data));
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const getFacilityIcon = (fac: PublicFacility) => {
    const cat = (fac.category || '').toUpperCase();
    const title = (fac.title || '').toLowerCase();
    if (cat.includes('LAB') || title.includes('science') || title.includes('chemistry') || title.includes('physics')) return FlaskConical;
    if (title.includes('computer') || title.includes('smart') || title.includes('digital') || title.includes('tech')) return Laptop;
    if (title.includes('library') || title.includes('book') || cat.includes('ACADEMIC')) return BookOpen;
    if (cat.includes('RESIDENTIAL') || title.includes('hostel') || title.includes('board') || title.includes('dining')) return Home;
    if (cat.includes('TRANSPORT') || title.includes('bus') || title.includes('van')) return Bus;
    if (cat.includes('SPORTS') || title.includes('playground') || title.includes('athletic')) return Trophy;
    return Building;
  };

  const getFacilityImageSrc = (fac: PublicFacility): string => mediaSrc((fac as any).imageFileKey, fac.image, fac.imageUrl);

  const categories = ['ALL', 'RESIDENTIAL', 'LABORATORY', 'ACADEMIC', 'SPORTS', 'TRANSPORT'];

  const filteredFacilities = useMemo(() => {
    if (selectedCategory === 'ALL') return facilities;
    return facilities.filter((f) => f.category === selectedCategory);
  }, [facilities, selectedCategory]);

  return (
    <section id="facilities" className="py-16 sm:py-24 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            World-Class Campus Facilities & Residential Care
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            From modern science and computer laboratories to safe residential boarding and GPS-enabled school buses, we provide an environment where children thrive securely.
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
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Facilities Grid */}
        {filteredFacilities.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 max-w-lg mx-auto space-y-3">
            <Building className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-lg font-bold text-slate-800">No Facilities Published</h3>
            <p className="text-xs text-slate-500">
              Campus facilities published through the administrative portal will appear here dynamically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFacilities.map((fac) => {
            const Icon = getFacilityIcon(fac);
            const imgSrc = getFacilityImageSrc(fac);
            const isError = imageErrors[fac.id] || !imgSrc;

            return (
              <div
                key={fac.id}
                onClick={() => setActiveFacility(fac)}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-lg hover:border-blue-300 transition-all duration-200 flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="relative h-48 overflow-hidden bg-slate-100">
                    {!isError ? (
                      <img loading="lazy" decoding="async"
                        src={imgSrc}
                        alt={`${fac.title} - RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        onError={() => setImageErrors((prev) => ({ ...prev, [fac.id]: true }))}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#051437] via-[#0B1F4B] to-[#123B8C] flex flex-col items-center justify-center p-4 text-white text-center">
                        <div className="w-12 h-12 rounded-xl bg-white/10 border border-[#D9A441]/40 flex items-center justify-center mb-2 shadow-inner">
                          <Icon className="w-6 h-6 text-[#F3D27A]" />
                        </div>
                        <p className="text-xs font-bold text-white tracking-wide line-clamp-1">{fac.title}</p>
                      </div>
                    )}
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-900/80 text-white backdrop-blur-xs shadow-sm">
                      {fac.category}
                    </span>
                  </div>

                  <div className="p-5 space-y-2.5">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-900 transition-colors">
                      {fac.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {fac.description}
                    </p>

                    <div className="pt-2">
                      <div className="flex flex-wrap gap-1.5">
                        {fac.features?.slice(0, 3).map((feat, fIdx) => (
                          <span
                            key={fIdx}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium text-slate-700"
                          >
                            {feat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between text-xs text-blue-700 font-bold group-hover:text-blue-900">
                  <span>View Details & Amenities</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Residential Highlight Banner */}
        <div className="mt-12 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-blue-950 to-indigo-950 text-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-3">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Home className="w-4 h-4" />
              <span>Full Residential Boarding Care</span>
            </span>
            <h3 className="text-xl sm:text-2xl font-black">
              Safe, Caring & Disciplined Hostel for Boys and Girls
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Equipped with round-the-clock wardens, supervised evening prep sessions, 24×7 CCTV perimeter safety, pure RO drinking water, hygienic mess dining, and medical checkups.
            </p>
          </div>

          <div className="lg:col-span-4 flex justify-center lg:justify-end">
            <button
              type="button"
              onClick={onOpenEnquiry}
              className="px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-400/20 transition-all cursor-pointer whitespace-nowrap"
            >
              Enquire for Hostel Admission
            </button>
          </div>
        </div>
      </div>

      {/* Facility Detail Modal */}
      {activeFacility && (() => {
        const ModalIcon = getFacilityIcon(activeFacility);
        const modalImgSrc = getFacilityImageSrc(activeFacility);
        const isModalImgError = imageErrors[activeFacility.id] || !modalImgSrc;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
              <div className="relative h-60 bg-slate-100 shrink-0">
                {!isModalImgError ? (
                  <img loading="lazy" decoding="async"
                    src={modalImgSrc}
                    alt={`${activeFacility.title} - RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setImageErrors((prev) => ({ ...prev, [activeFacility.id]: true }))}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#051437] via-[#0B1F4B] to-[#123B8C] flex flex-col items-center justify-center p-6 text-white text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 border border-[#D9A441]/40 flex items-center justify-center mb-3 shadow-inner backdrop-blur-xs">
                      <ModalIcon className="w-8 h-8 text-[#F3D27A]" />
                    </div>
                    <h4 className="text-lg font-bold text-white tracking-wide">{activeFacility.title}</h4>
                    <p className="text-xs text-slate-300 mt-1">RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setActiveFacility(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <span className="absolute bottom-3 left-3 px-3 py-1 rounded-md text-xs font-bold bg-blue-900 text-white shadow-xs uppercase">
                  {activeFacility.category}
                </span>
              </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <h3 className="text-xl font-black text-slate-900">{activeFacility.title}</h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {activeFacility.description}
              </p>

              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Key Amenities & Equipment:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeFacility.features?.map((feat, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-150 text-xs text-slate-800"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">Available to enrolled students</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveFacility(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFacility(null);
                    onOpenEnquiry();
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-900 text-white text-xs font-bold hover:bg-blue-800 transition-colors cursor-pointer"
                >
                  Admission Enquiry
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </section>
  );
};
