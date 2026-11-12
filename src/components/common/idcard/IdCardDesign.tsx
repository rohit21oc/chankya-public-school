import React, { useEffect, useState } from 'react';
import { Droplet, RotateCcw } from 'lucide-react';
import { SchoolSettings } from '../../../types';
import { fileUploadService } from '../../../services/fileUploadService';
import { getSchoolLogoSrc, handleLogoError } from '../../../constants/schoolLogo';
import { IdCardQrState } from '../../../services/idCardQrService';
import { NOT_CONFIGURED, affiliationText, letterheadLine, schoolIdentity as savedSchoolIdentity } from '../../../utils/schoolIdentity';

/**
 * Shared building blocks for the student and staff ID cards (website).
 *
 * One design for both cards: navy header with the school logo, a gold title
 * ribbon, blue side waves, a round photo with the blood group, a details table,
 * and a back side with a second table, the signed QR code and the principal's
 * signature. Cards are 340 x 540 px (CR80 portrait ratio) so the existing PDF
 * export and print layouts keep working.
 *
 * Only real data is shown. A missing value reads "Not recorded"; optional items
 * (blood group, signature image) are simply left out.
 */

export const CARD_W = 340;
export const CARD_H = 540;
export const NOT_RECORDED = 'Not recorded';

const NAVY = '#0B1F4B';
const NAVY_DEEP = '#081638';
const BLUE = '#1F6FD8';
const BLUE_LIGHT = '#5AA2F0';
const GOLD = '#F4B400';
const INK = '#0F172A';
const LINE = '#C7D0DC';
const MUTED = '#475569';

export type SchoolIdentity = {
  name: string;
  board: string;
  affiliation: string;
  address: string;
  logoSrc: string;
  principalName: string;
  signatureSrc: string;
};

export function schoolIdentity(settings: Partial<SchoolSettings> | undefined): SchoolIdentity {
  const s: any = settings || {};
  const sigKey = s.principalSignature || s.principalSignatureFileKey || s.signatureFileKey || '';
  return {
    // Saved School Settings only; nothing is invented when a value is missing.
    name: s.schoolName || NOT_CONFIGURED,
    board: s.affiliatedBoard || '',
    affiliation: s.affiliationCode || s.affiliationNumber || NOT_CONFIGURED,
    address: s.schoolAddress || NOT_CONFIGURED,
    logoSrc: getSchoolLogoSrc(s.schoolLogo || s.logoFileKey),
    principalName: s.principalName || '',
    signatureSrc: sigKey ? fileUploadService.getFileUrl(sigKey) : '',
  };
}

export function displayValue(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v).trim();
  return s || NOT_RECORDED;
}

/** "2007-01-31" -> "31/01/2007". Anything else is shown as stored. */
export function formatCardDate(v?: string): string {
  const s = String(v || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : displayValue(s);
}

/** "ACADEMICS" -> "Academics"; short codes such as "IT" and mixed-case text are kept. */
export function titleCase(v?: string): string {
  const s = String(v || '').trim();
  if (!s || s.length <= 3 || s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

export function initialsOf(name?: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// ---------------------------------------------------------------------------

export const CardFrame: React.FC<{ id: string; label: string; children: React.ReactNode }> = ({ id, label, children }) => (
  <div
    id={id}
    role="img"
    aria-label={label}
    className="relative shrink-0 overflow-hidden rounded-[18px] select-none print:shadow-none print:break-inside-avoid"
    style={{
      width: CARD_W,
      height: CARD_H,
      boxSizing: 'border-box',
      background: '#FFFFFF',
      border: `1px solid ${LINE}`,
      boxShadow: '0 10px 30px rgba(11, 31, 75, 0.18)',
      fontFamily: "'Poppins', 'Inter', system-ui, sans-serif",
      color: INK,
    }}
  >
    {children}
  </div>
);

const Logo: React.FC<{ src: string; size: number }> = ({ src, size }) => (
  <div
    className="shrink-0 rounded-full flex items-center justify-center"
    style={{ width: size, height: size, background: '#FFFFFF', border: `2px solid ${GOLD}`, padding: 2 }}
  >
    {src ? (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="w-full h-full rounded-full object-contain"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        onError={handleLogoError}
      />
    ) : null}
  </div>
);

/** Front header: logo, school name, affiliation and address, with the gold title ribbon. */
export const FrontHeader: React.FC<{ school: SchoolIdentity; title: string }> = ({ school, title }) => (
  <>
    <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 132, background: `linear-gradient(180deg, ${NAVY_DEEP} 0%, ${NAVY} 100%)` }} />
    <div className="absolute flex items-center gap-2.5" style={{ top: 16, left: 16, right: 14 }}>
      <Logo src={school.logoSrc} size={58} />
      <div className="min-w-0">
        <p className="uppercase" style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 700, lineHeight: '18px', letterSpacing: 0.2 }}>
          {school.name}
        </p>
        <p className="uppercase" style={{ color: GOLD, fontSize: 9, fontWeight: 700, marginTop: 3, lineHeight: '11px' }}>
          {school.board ? `${school.board} ` : ''}Affiliation Code: {school.affiliation}
        </p>
        <p style={{ color: '#CBD5E1', fontSize: 8.5, marginTop: 2, lineHeight: '11px' }}>{school.address}</p>
      </div>
    </div>
    <div
      className="absolute flex items-center justify-center uppercase"
      style={{
        top: 96,
        left: 22,
        right: 22,
        height: 26,
        borderRadius: 7,
        background: `linear-gradient(180deg, #FFC928 0%, ${GOLD} 100%)`,
        color: NAVY,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.4,
        boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
      }}
    >
      {title}
    </div>
    {/* Blue side waves under the header */}
    <svg aria-hidden="true" width={CARD_W} height={140} viewBox="0 0 340 140" style={{ position: 'absolute', top: 128, left: 0 }}>
      <path d="M0 0 H70 C40 30 26 70 0 112 Z" fill={BLUE} />
      <path d="M0 0 H34 C18 34 10 60 0 78 Z" fill={BLUE_LIGHT} opacity="0.85" />
      <path d="M340 0 H270 C300 30 314 70 340 112 Z" fill={BLUE} />
      <path d="M340 0 H306 C322 34 330 60 340 78 Z" fill={BLUE_LIGHT} opacity="0.85" />
    </svg>
  </>
);

/** Round photo with a red blood-group pill. Falls back to initials when there is no photo. */
export const PhotoBadge: React.FC<{ photoKey?: string; name: string; bloodGroup?: string; size: number }> = ({ photoKey, name, bloodGroup, size }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoKey]);
  const src = photoKey ? fileUploadService.getFileUrl(photoKey) : '';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
        style={{ border: '6px solid #FFFFFF', background: '#E2E8F0', boxShadow: '0 6px 16px rgba(11,31,75,0.25)' }}
      >
        {src && !failed ? (
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-top"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <span style={{ color: NAVY, fontSize: size * 0.32, fontWeight: 700 }}>{initialsOf(name)}</span>
        )}
      </div>
      {bloodGroup ? (
        <div
          className="absolute flex items-center gap-1"
          style={{
            right: -10,
            bottom: 6,
            padding: '3px 10px 3px 8px',
            borderRadius: 999,
            background: '#C8102E',
            border: '2px solid #FFFFFF',
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: 700,
            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          }}
        >
          <Droplet aria-hidden="true" style={{ width: 11, height: 11 }} fill="#FFFFFF" color="#FFFFFF" />
          <span>{bloodGroup}</span>
        </div>
      ) : null}
    </div>
  );
};

/** Bordered two-column details table used on both sides. */
export const DetailTable: React.FC<{ rows: [string, string][]; width?: number; labelWidth?: number; rowHeight?: number; valueLines?: number }> = ({
  rows,
  width = 270,
  labelWidth = 104,
  rowHeight = 26,
  valueLines = 1,
}) => (
  <div className="shrink-0" style={{ width, border: `1px solid ${LINE}`, background: '#FFFFFF' }}>
    {rows.map(([label, value], i) => {
      const missing = value === NOT_RECORDED;
      return (
        <div key={label} className="flex" style={{ minHeight: rowHeight, borderTop: i ? `1px solid ${LINE}` : 'none' }}>
          <div className="flex items-center" style={{ width: labelWidth, padding: '0 8px', fontSize: 12, fontWeight: 700, color: INK, borderRight: `1px solid ${LINE}` }}>
            {label}:
          </div>
          <div
            className="flex items-center min-w-0 flex-1"
            style={{ padding: '3px 8px', fontSize: 12, lineHeight: '15px', color: missing ? '#64748B' : INK, fontWeight: missing ? 400 : 500, fontStyle: missing ? 'italic' : 'normal', fontVariantNumeric: 'tabular-nums' }}
          >
            <span
              style={{
                display: '-webkit-box',
                WebkitLineClamp: valueLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
              title={value}
            >
              {value}
            </span>
          </div>
        </div>
      );
    })}
  </div>
);

export const NameBlock: React.FC<{ name: string; subtitle?: React.ReactNode }> = ({ name, subtitle }) => (
  <div className="text-center shrink-0" style={{ width: CARD_W - 28 }}>
    <p
      className="uppercase"
      style={{ color: NAVY, fontSize: name.length > 22 ? 17 : 20, fontWeight: 800, lineHeight: '23px', letterSpacing: 0.2, wordBreak: 'break-word' }}
    >
      {name}
    </p>
    {subtitle ? <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 700, color: '#1E293B', lineHeight: '14px' }}>{subtitle}</div> : null}
  </div>
);

/** Navy wave along the bottom edge. */
export const BottomWave: React.FC = () => (
  <svg aria-hidden="true" width={CARD_W} height={64} viewBox="0 0 340 64" style={{ position: 'absolute', bottom: 0, left: 0 }}>
    <path d="M0 22 C70 2 150 2 210 20 C260 34 300 34 340 18 V64 H0 Z" fill={NAVY} />
    <path d="M150 30 C200 22 250 30 300 22 L300 27 C250 36 200 28 150 35 Z" fill={BLUE_LIGHT} />
    <path d="M190 40 C230 34 270 40 320 32 L320 35 C270 44 230 38 190 43 Z" fill={BLUE} />
  </svg>
);

/** Back header: logo and school name on a curved navy band. */
export const BackHeader: React.FC<{ school: SchoolIdentity }> = ({ school }) => (
  <>
    <svg aria-hidden="true" width={CARD_W} height={134} viewBox="0 0 340 134" style={{ position: 'absolute', top: 0, left: 0 }}>
      <defs>
        <linearGradient id="idcard-back-navy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={NAVY_DEEP} />
          <stop offset="1" stopColor={NAVY} />
        </linearGradient>
      </defs>
      <path d="M0 0 H340 V92 C250 128 90 128 0 92 Z" fill="url(#idcard-back-navy)" />
      <path d="M0 96 C90 132 250 132 340 96 L340 102 C250 140 90 140 0 102 Z" fill={BLUE} />
    </svg>
    <div className="absolute flex items-center gap-3" style={{ top: 20, left: 22, right: 18 }}>
      <Logo src={school.logoSrc} size={58} />
      <p className="uppercase min-w-0" style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 700, lineHeight: '20px' }}>
        {school.name}
      </p>
    </div>
  </>
);

/** Signed QR code, with clear states while it loads or when the server gives none. */
export const QrBlock: React.FC<{ qr: IdCardQrState; size?: number }> = ({ qr, size = 108 }) => (
  <div
    className="shrink-0 flex items-center justify-center"
    style={{ width: size + 16, height: size + 16, border: `3px solid ${BLUE}`, borderRadius: 4, background: '#FFFFFF' }}
  >
    {qr.status === 'ready' ? (
      <img src={qr.dataUrl} alt="ID card QR code for attendance" style={{ width: size, height: size }} />
    ) : qr.status === 'loading' ? (
      <div data-idcard-pending="qr" className="animate-pulse motion-reduce:animate-none" style={{ width: size, height: size, background: '#E2E8F0' }} />
    ) : (
      <p className="text-center" style={{ width: size - 8, fontSize: 10.5, lineHeight: '14px', color: MUTED }}>
        QR code is not available right now.
      </p>
    )}
  </div>
);

export const SignatureBlock: React.FC<{ school: SchoolIdentity }> = ({ school }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [school.signatureSrc]);
  return (
    <div className="shrink-0 flex flex-col items-center" style={{ width: 200 }}>
      <div className="flex items-end justify-center" style={{ height: 28, width: '100%', borderBottom: `1px solid #94A3B8` }}>
        {school.signatureSrc && !failed ? (
          <img
            src={school.signatureSrc}
            alt=""
            aria-hidden="true"
            style={{ maxHeight: 28, maxWidth: 160, objectFit: 'contain' }}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : null}
      </div>
      <p style={{ marginTop: 3, fontSize: 11.5, lineHeight: '14px', color: '#1E293B' }}>Principal's Signature</p>
    </div>
  );
};

/** Middle area of a face, between the header and the bottom wave. */
export const CardBody: React.FC<{ top: number; bottom?: number; gap?: number; children: React.ReactNode }> = ({ top, bottom = 62, gap = 10, children }) => (
  <div className="absolute flex flex-col items-center" style={{ top, bottom, left: 0, right: 0, gap }}>
    {children}
  </div>
);

// ---------------------------------------------------------------------------

/**
 * Shows one face at a time; tap the card or the button to turn it over.
 * The turn is a 3D rotation (transform only) and is skipped for people who
 * prefer reduced motion.
 */
export const FlipIdCard: React.FC<{ front: React.ReactNode; back: React.ReactNode; label: string }> = ({ front, back, label }) => {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((f) => !f);
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label}. Showing ${flipped ? 'back' : 'front'} side. Press to turn over.`}
        aria-pressed={flipped}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        className="cursor-pointer rounded-[18px] outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40"
        style={{ width: CARD_W, height: CARD_H, perspective: 1400 }}
      >
        <div
          className="relative w-full h-full transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
          style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }} aria-hidden={flipped}>
            {front}
          </div>
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            aria-hidden={!flipped}
          >
            {back}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 active:scale-[0.98] transition-transform print:hidden"
      >
        <RotateCcw aria-hidden="true" className="w-4 h-4" />
        {flipped ? 'Show front side' : 'Show back side'}
      </button>
    </div>
  );
};

export type CardSide = 'front' | 'back' | 'both' | 'flip';

/** Lays out the requested side(s): one face, both side by side (print/PDF), or the flip card. */
export const CardSides: React.FC<{ side: CardSide; front: React.ReactNode; back: React.ReactNode; label: string }> = ({ side, front, back, label }) => {
  if (side === 'flip') return <FlipIdCard front={front} back={back} label={label} />;
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 print:gap-4 print:p-0">
      {(side === 'both' || side === 'front') && front}
      {(side === 'both' || side === 'back') && back}
    </div>
  );
};
