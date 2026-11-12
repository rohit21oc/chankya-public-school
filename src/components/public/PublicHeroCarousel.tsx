import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { PublicHeroSlide } from '../../types';
import { mediaSrc } from '../../utils/publicMedia';

/**
 * Landing hero: full-bleed campus photo on navy, a large headline that rises in
 * word by word, one green primary action, and thin curved lines that draw in
 * with a green light riding along them. Slides, titles, subtitles and buttons
 * all come from the website settings (hero slides); nothing here is invented.
 */

interface PublicHeroCarouselProps {
  slides?: PublicHeroSlide[];
  onOpenEnquiry: () => void;
  onGoToResults: () => void;
  onGoToLogin: () => void;
  onExploreFacilities: () => void;
}

const SLIDE_MS = 6500;

const getSlideImageUrl = (slide: PublicHeroSlide): string => {
  const s: any = slide;
  return mediaSrc(s.desktopImageFileKey, s.desktopImage, s.imageUrl, s.image, s.photo);
};
/** Phone banner when the admin uploaded one (Hero Slider → mobile image). */
const getSlideMobileUrl = (slide: PublicHeroSlide): string => {
  const s: any = slide;
  return mediaSrc(s.mobileImageFileKey, s.mobileImage);
};

/** Headline split into words so each can rise in turn. */
const RiseText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {String(text || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((w, i) => (
        <React.Fragment key={`${w}-${i}`}>
          <span className="lp-hero__word" style={{ ['--i' as any]: i }}>
            <span>{w}</span>
          </span>{' '}
        </React.Fragment>
      ))}
  </>
);

export const PublicHeroCarousel: React.FC<PublicHeroCarouselProps> = ({
  slides: propSlides,
  onOpenEnquiry,
  onGoToResults,
  onGoToLogin,
  onExploreFacilities,
}) => {
  const slides = propSlides || [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const touchX = useRef<number | null>(null);

  const safeIndex = index >= 0 && index < slides.length ? index : 0;
  const go = (d: number) => slides.length > 1 && setIndex((p) => (p + d + slides.length) % slides.length);

  useEffect(() => {
    slides.forEach((s) => {
      const src = getSlideImageUrl(s);
      if (src && !src.startsWith('data:')) new Image().src = src;
    });
  }, [slides]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setTimeout(() => setIndex((p) => (p + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [paused, safeIndex, slides.length]);

  const handleAction = (action?: string) => {
    if (action === 'enquiry') onOpenEnquiry();
    else if (action === 'results') onGoToResults();
    else if (action === 'login') onGoToLogin();
    else if (action === 'facilities') onExploreFacilities();
  };

  const slide = slides[safeIndex];
  // Defaults only when no slides are set up at all; a saved slide shows exactly what the admin entered.
  const title = slide ? (slide.title || '').trim() : 'Residential PDS Public School';
  const subtitle = slide
    ? (slide.subtitle || '').trim()
    : 'Holistic English-medium schooling blending rigorous academic curriculum, moral integrity, modern laboratories, and complete residential boarding in Sheohar, Bihar.';
  const hasText = Boolean(title || subtitle);
  const primary = slide ? { text: slide.primaryCtaText, act: () => handleAction(slide.primaryCtaAction) } : { text: 'Admission enquiry', act: onOpenEnquiry };
  const secondary = slide ? { text: slide.secondaryCtaText, act: () => handleAction(slide.secondaryCtaAction) } : { text: 'Explore campus', act: onExploreFacilities };

  return (
    <section
      className="lp-hero relative overflow-hidden text-white"
      aria-label="Welcome"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const d = touchX.current - e.changedTouches[0].clientX;
        if (Math.abs(d) > 40) go(d > 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      {/* Photos (cross-fade) */}
      <div className="absolute inset-0" aria-hidden="true">
        {slides.map((s, i) => {
          const src = getSlideImageUrl(s);
          const ok = src && !imageErrors[s.id];
          return (
            <div key={s.id} className={`lp-hero__photo ${i === safeIndex ? 'is-on' : ''}`}>
              {ok ? (
                <picture>
                  {getSlideMobileUrl(s) ? <source media="(max-width: 639px)" srcSet={getSlideMobileUrl(s)} /> : null}
                  <img
                    src={src}
                    alt=""
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    onError={() => setImageErrors((p) => ({ ...p, [s.id]: true }))}
                  />
                </picture>
              ) : null}
            </div>
          );
        })}
        <div className={`lp-hero__shade ${hasText ? '' : 'is-light'}`} />
      </div>

      {/* Curved lines with a green light riding along */}
      <svg className="lp-hero__lines" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
        <path className="lp-line" d="M-40 900 C 300 640, 760 600, 1480 760" />
        <path className="lp-line lp-line--2" d="M380 900 C 640 700, 1040 660, 1480 690" />
        <path className="lp-line lp-line--ride" d="M-40 900 C 300 640, 760 600, 1480 760" />
        <path className="lp-line lp-line--ride lp-line--ride2" d="M380 900 C 640 700, 1040 660, 1480 690" />
      </svg>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-24 sm:pb-28 min-h-[600px] sm:min-h-[680px] lg:min-h-[760px] flex flex-col justify-between gap-10">
        {title ? (
          <h1 key={`t-${safeIndex}`} className="lp-hero__title max-w-4xl">
            <RiseText text={title} />
          </h1>
        ) : (
          <h1 className="sr-only">Residential PDS Public School</h1>
        )}

        <div key={`c-${safeIndex}`} className="lp-hero__copy max-w-xl space-y-5 mt-auto">
          {subtitle ? <p className="text-base sm:text-lg leading-relaxed lp-hero__sub">{subtitle}</p> : null}
          {hasText ? (
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-white lp-hero__sub">
            {['Nursery to Class 8 · CBSE pattern', 'Residential hostel care', 'English medium'].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 lp-green" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
          ) : null}
          <div className="flex flex-wrap items-center gap-5 pt-1">
            {primary.text ? (
              <button type="button" onClick={primary.act} className="lp-btn">
                {primary.text}
              </button>
            ) : null}
            {secondary.text ? (
              <button type="button" onClick={secondary.act} className="lp-link">
                {secondary.text}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <div className="absolute z-20 bottom-6 right-4 sm:right-8 flex items-center gap-3">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose slide">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === safeIndex}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`lp-dot ${i === safeIndex ? 'is-on' : ''}`}
              />
            ))}
          </div>
          <button type="button" onClick={() => go(-1)} aria-label="Previous slide" className="lp-round">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next slide" className="lp-round">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </section>
  );
};
