import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Quote,
  Building,
  GraduationCap,
} from 'lucide-react';
import { PublicLeadershipProfile } from '../../types';
import { api } from '../../services/api';
import { realtimeService } from '../../services/realtimeService';
import { PublicManagementProfileModal } from './PublicManagementProfileModal';
import { mediaSrc } from '../../utils/publicMedia';

interface PublicManagementTeamSectionProps {
  initialMembers?: PublicLeadershipProfile[];
  onOpenProfile?: (id: string) => void;
}

export const PublicManagementTeamSection: React.FC<PublicManagementTeamSectionProps> = ({
  initialMembers,
  onOpenProfile,
}) => {
  const [members, setMembers] = useState<PublicLeadershipProfile[]>(() => {
    if (initialMembers && initialMembers.length > 0) {
      return [...initialMembers]
        .filter((m) => m.isActive !== false && m.active !== false && m.showOnWebsite !== false)
        .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(!initialMembers || initialMembers.length === 0);
  const [activeProfile, setActiveProfile] = useState<PublicLeadershipProfile | null>(null);

  // Logical slide index (0 to members.length - 1)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  // Drag / touch state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartXRef = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);

  // Responsive visible cards count
  const [visibleCards, setVisibleCards] = useState<number>(3);

  // Interaction timer for auto-slide resumption
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const carouselContainerRef = useRef<HTMLDivElement>(null);

  // Function to filter and sort active leadership profiles
  const filterAndSortMembers = useCallback((data: PublicLeadershipProfile[]) => {
    return (data || [])
      .filter((m) => m.isActive !== false && m.active !== false && m.showOnWebsite !== false)
      .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
  }, []);

  // Fetch leadership profiles dynamically from API
  const loadMembers = useCallback(async () => {
    try {
      const data = await api.getLeadership();
      const sorted = filterAndSortMembers(data);
      setMembers(sorted);
    } catch (err) {
      console.warn('Could not load management team:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterAndSortMembers]);

  // Initial load
  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Real-time synchronization: subscribe to WEBSITE entity changes & window events
  useEffect(() => {
    const unsubscribe = realtimeService.subscribe('WEBSITE', (event) => {
      if (['CREATE', 'UPDATE', 'DELETE'].includes(event.action)) {
        loadMembers();
      }
    });

    const handleExternalUpdate = () => {
      loadMembers();
    };

    window.addEventListener('cps_entity_website', handleExternalUpdate);
    window.addEventListener('leadership_updated', handleExternalUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('cps_entity_website', handleExternalUpdate);
      window.removeEventListener('leadership_updated', handleExternalUpdate);
    };
  }, [loadMembers]);

  // Responsive breakpoint tracking:
  // Desktop (>= 1024px): 3 cards
  // Tablet (640px - 1023px): 2 cards
  // Mobile (< 640px): 1 card
  useEffect(() => {
    const updateVisibleCards = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      if (w < 640) {
        setVisibleCards(1);
      } else if (w < 1024) {
        setVisibleCards(2);
      } else {
        setVisibleCards(3);
      }
    };

    updateVisibleCards();
    window.addEventListener('resize', updateVisibleCards);
    return () => window.removeEventListener('resize', updateVisibleCards);
  }, []);

  // Listen for direct URL navigation /management/:id or /leadership/:id
  useEffect(() => {
    const handleUrlHashOrPath = () => {
      const pathname = window.location.pathname;
      const hash = window.location.hash;
      let targetId: string | null = null;

      if (pathname.startsWith('/management/')) {
        targetId = pathname.replace('/management/', '').trim();
      } else if (pathname.startsWith('/leadership/')) {
        targetId = pathname.replace('/leadership/', '').trim();
      } else if (hash.startsWith('#management-profile-')) {
        targetId = hash.replace('#management-profile-', '').trim();
      }

      if (targetId && members.length > 0) {
        const found =
          members.find(
            (m) =>
              m.id === targetId ||
              m.id.toLowerCase() === targetId.toLowerCase() ||
              m.id.toLowerCase() === `lead-${targetId.toLowerCase()}` ||
              m.id.endsWith(`-${targetId}`)
          ) ||
          (() => {
            const idx = parseInt(targetId, 10);
            return !isNaN(idx) && idx >= 1 && idx <= members.length ? members[idx - 1] : null;
          })();
        if (found) {
          setActiveProfile(found);
        }
      }
    };

    handleUrlHashOrPath();
    window.addEventListener('popstate', handleUrlHashOrPath);
    return () => window.removeEventListener('popstate', handleUrlHashOrPath);
  }, [members]);

  const handleOpenMoreInfo = (member: PublicLeadershipProfile) => {
    if (dragDistanceRef.current > 8) return; // Prevent click when user was dragging
    setActiveProfile(member);
    if (onOpenProfile) {
      onOpenProfile(member.id);
    } else {
      window.history.pushState(null, '', `/management/${member.id}`);
    }
  };

  const handleCloseModal = () => {
    setActiveProfile(null);
    if (window.location.pathname.startsWith('/management/') || window.location.pathname.startsWith('/leadership/')) {
      window.history.pushState(null, '', '/#management-team');
    }
  };

  // Pause auto-slide temporarily when user interacts
  const pauseTemporarily = useCallback(() => {
    setIsInteracting(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 4000); // Resume auto-slide after 4 seconds of inactivity
  }, []);

  const totalMembers = members.length;
  const effectiveVisible = Math.min(visibleCards, totalMembers);
  const needsCarousel = totalMembers > effectiveVisible;

  // Clone count for seamless circular sliding
  const cloneCount = effectiveVisible;

  // Build displayItems with clones at both ends when circular sliding is active
  const displayItems = React.useMemo(() => {
    if (!needsCarousel || totalMembers === 0) {
      return members;
    }
    const clonesBefore = members.slice(-cloneCount);
    const clonesAfter = members.slice(0, cloneCount);
    return [...clonesBefore, ...members, ...clonesAfter];
  }, [members, needsCarousel, cloneCount, totalMembers]);

  // Navigate to next slide
  const handleNext = useCallback(() => {
    if (!needsCarousel) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => prev + 1);
  }, [needsCarousel]);

  // Navigate to previous slide
  const handlePrev = useCallback(() => {
    if (!needsCarousel) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => prev - 1);
  }, [needsCarousel]);

  // Navigate to specific slide/dot
  const handleDotClick = (index: number) => {
    if (!needsCarousel) return;
    pauseTemporarily();
    setIsTransitioning(true);
    setCurrentIndex(index);
  };

  // Check and handle wrap-around reset after CSS transition completes
  const handleTransitionEnd = useCallback(() => {
    if (!needsCarousel) return;

    if (currentIndex >= totalMembers) {
      // Reached past the end clone: reset seamlessly to beginning
      setIsTransitioning(false);
      setCurrentIndex(0);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setIsTransitioning(true);
      }, 50);
    } else if (currentIndex < 0) {
      // Reached before the start clone: reset seamlessly to last item
      setIsTransitioning(false);
      setCurrentIndex(totalMembers - 1);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setIsTransitioning(true);
      }, 50);
    }
  }, [currentIndex, totalMembers, needsCarousel]);

  // Auto-slide effect (every 3 seconds)
  useEffect(() => {
    if (!needsCarousel || isHovered || isInteracting || isDragging) {
      return;
    }

    // Respect reduced-motion preferences
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      handleNext();
    }, 3000);

    return () => clearInterval(interval);
  }, [needsCarousel, isHovered, isInteracting, isDragging, handleNext]);

  // Drag and touch handlers
  const handleDragStart = (clientX: number) => {
    if (!needsCarousel) return;
    pauseTemporarily();
    setIsDragging(true);
    dragStartXRef.current = clientX;
    dragDistanceRef.current = 0;
  };

  const handleDragMove = (clientX: number) => {
    if (!isDragging || dragStartXRef.current === null) return;
    const diff = clientX - dragStartXRef.current;
    dragDistanceRef.current = Math.abs(diff);
    setDragOffset(diff);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragOffset < -50) {
      // Swiped left -> next
      handleNext();
    } else if (dragOffset > 50) {
      // Swiped right -> prev
      handlePrev();
    }

    setDragOffset(0);
    dragStartXRef.current = null;
    pauseTemporarily();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!needsCarousel) return;
    if (e.key === 'ArrowLeft') {
      pauseTemporarily();
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      pauseTemporarily();
      handleNext();
    }
  };

  // If no members are loaded and not loading, gracefully hide the section
  if (!isLoading && members.length === 0) {
    return null;
  }

  // Active dot index mapped to 0..N-1
  const activeDotIndex =
    totalMembers > 0 ? ((currentIndex % totalMembers) + totalMembers) % totalMembers : 0;

  // Track position translation
  const trackIndex = needsCarousel ? cloneCount + currentIndex : 0;
  const gapPx = visibleCards === 1 ? 16 : 24;

  return (
    <section
      id="management-team"
      className="py-16 sm:py-20 bg-white border-b border-slate-200 scroll-mt-20 overflow-hidden"
      aria-roledescription="carousel"
      aria-label="Management Team Carousel"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
          <div className="space-y-3 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Our Management Team
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Meet the visionary educators and administrators steering Chanakya Public School & Coaching Centre
              Sheohar towards scholastic distinction, character development, and holistic excellence.
            </p>
          </div>

          {/* Carousel Arrows (visible when more than 1 member) */}
          {totalMembers > 1 && (
            <div className="flex items-center gap-2.5 self-start md:self-end">
              <button
                onClick={() => {
                  pauseTemporarily();
                  handlePrev();
                }}
                disabled={!needsCarousel}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 hover:text-blue-900 shadow-2xs hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600"
                aria-label="Previous management member"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  pauseTemporarily();
                  handleNext();
                }}
                disabled={!needsCarousel}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 hover:text-blue-900 shadow-2xs hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600"
                aria-label="Next management member"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Loading State Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4 animate-pulse"
              >
                <div className="aspect-[4/5] bg-slate-200 rounded-xl" />
                <div className="h-5 bg-slate-200 rounded-md w-3/4" />
                <div className="h-4 bg-slate-200 rounded-md w-1/2" />
                <div className="h-10 bg-slate-200 rounded-xl w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Responsive Carousel Slider */}
        {!isLoading && totalMembers > 0 && (
          <div className="space-y-8">
            {/* Carousel Viewport Container */}
            <div
              ref={carouselContainerRef}
              className="relative overflow-hidden w-full select-none"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => {
                setIsHovered(false);
                if (isDragging) handleDragEnd();
              }}
              onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
              onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
              onTouchEnd={handleDragEnd}
              onMouseDown={(e) => handleDragStart(e.clientX)}
              onMouseMove={(e) => handleDragMove(e.clientX)}
              onMouseUp={handleDragEnd}
              style={{
                cursor: needsCarousel ? (isDragging ? 'grabbing' : 'grab') : 'default',
              }}
            >
              {/* Sliding Track */}
              <div
                className={`flex ${
                  !needsCarousel && totalMembers === 1
                    ? 'justify-center'
                    : !needsCarousel && totalMembers === 2
                    ? 'justify-center max-w-4xl mx-auto'
                    : ''
                }`}
                onTransitionEnd={handleTransitionEnd}
                style={{
                  gap: `${gapPx}px`,
                  transform: needsCarousel
                    ? `translateX(calc(-${trackIndex} * ((100% + ${gapPx}px) / ${visibleCards}) + ${dragOffset}px))`
                    : 'none',
                  transition:
                    isTransitioning && !isDragging
                      ? 'transform 500ms cubic-bezier(0.25, 1, 0.5, 1)'
                      : 'none',
                }}
              >
                {displayItems.map((member, index) => {
                  const photoSrc = mediaSrc(member.photo, member.photoUrl);
                  const qualification = member.education || member.qualification;

                  // Compute card width percentage according to visible cards on current breakpoint
                  const cardFlexStyle = needsCarousel
                    ? {
                        flex: `0 0 calc((100% - ${(visibleCards - 1) * gapPx}px) / ${visibleCards})`,
                        maxWidth: `calc((100% - ${(visibleCards - 1) * gapPx}px) / ${visibleCards})`,
                        minWidth: 0,
                      }
                    : totalMembers === 1
                    ? {
                        flex: '0 0 100%',
                        maxWidth: '24rem', // 384px centered card
                        minWidth: 0,
                      }
                    : totalMembers === 2
                    ? {
                        flex: `0 0 calc((100% - ${gapPx}px) / 2)`,
                        maxWidth: `calc((100% - ${gapPx}px) / 2)`,
                        minWidth: 0,
                      }
                    : {
                        flex: `0 0 calc((100% - ${(visibleCards - 1) * gapPx}px) / ${visibleCards})`,
                        maxWidth: `calc((100% - ${(visibleCards - 1) * gapPx}px) / ${visibleCards})`,
                        minWidth: 0,
                      };

                  return (
                    <div
                      key={`${member.id}-${index}`}
                      style={cardFlexStyle}
                      className="group bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 hover:border-blue-400/80 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden shrink-0"
                    >
                      {/* Top: Portrait Photo Container (4:5 ratio) */}
                      <div className="relative aspect-[4/5] w-full bg-slate-100 overflow-hidden shrink-0">
                        {photoSrc ? (
                          <img
                            src={photoSrc}
                            alt={member.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            draggable={false}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#123B8C] to-slate-900 text-amber-400 p-6 text-center">
                            <Building className="w-16 h-16 mb-2 opacity-40 text-white" />
                            <span className="text-3xl font-black">
                              {member.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .substring(0, 2)
                                .toUpperCase()}
                            </span>
                          </div>
                        )}

                        {/* Role Floating Badge */}
                        <div className="absolute top-3.5 left-3.5 pointer-events-none">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/95 backdrop-blur-md text-[#123B8C] border border-blue-100 shadow-sm">
                            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>{member.designation}</span>
                          </span>
                        </div>

                        {/* Optional Quote overlay if available */}
                        {member.quote && (
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent p-4 text-white text-xs italic opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-start gap-2 pointer-events-none">
                            <Quote className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">&quot;{member.quote}&quot;</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Content Area */}
                      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          {/* Member Name */}
                          <h3 className="text-xl font-black text-slate-900 group-hover:text-[#123B8C] transition-colors tracking-tight">
                            {member.name}
                          </h3>

                          {/* Designation & Education */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              {member.designation}
                            </span>
                            {qualification && (
                              <span className="inline-flex items-center gap-1 text-slate-500 font-medium truncate max-w-[200px]">
                                <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{qualification}</span>
                              </span>
                            )}
                          </div>

                          {/* Short Introduction if available */}
                          {member.shortBio && (
                            <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed pt-1">
                              {member.shortBio}
                            </p>
                          )}
                        </div>

                        {/* More Info Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenMoreInfo(member);
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-[#123B8C] text-slate-800 hover:text-white font-bold text-xs sm:text-sm border border-slate-200 hover:border-transparent transition-all duration-200 cursor-pointer group/btn shadow-2xs"
                          aria-label={`View full profile of ${member.name}`}
                        >
                          <span>More Info</span>
                          <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Pagination Dots (exactly N dots for N active members when N > 1) */}
            {totalMembers > 1 && (
              <div
                className="flex items-center justify-center gap-2.5 pt-2"
                role="tablist"
                aria-label="Management Team Pagination"
              >
                {members.map((member, idx) => {
                  const isActive = activeDotIndex === idx;
                  return (
                    <button
                      key={member.id || idx}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`Go to slide ${idx + 1}: ${member.name}`}
                      onClick={() => handleDotClick(idx)}
                      className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                        isActive
                          ? 'w-8 bg-[#123B8C] shadow-xs'
                          : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                      }`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Profile Modal */}
      <PublicManagementProfileModal
        member={activeProfile}
        isOpen={!!activeProfile}
        onClose={handleCloseModal}
      />
    </section>
  );
};
