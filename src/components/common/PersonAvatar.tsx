import React, { useEffect, useState } from 'react';
import { getFileContentUrl } from '../../services/apiConfig';

/** Round profile photo with initials as the fallback (no photo, or the photo fails to load). */
export const initialsOf = (name?: string) =>
  String(name || '?')
    .split(/\s+/)
    .map((x) => x[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

interface Props {
  name?: string;
  photo?: string | null;
  size?: number;
  className?: string;
  /** Makes the avatar a button (e.g. to open the person's profile). */
  onClick?: () => void;
  label?: string;
}

export const PersonAvatar: React.FC<Props> = ({ name, photo, size = 40, className = '', onClick, label }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  const src = photo && !failed ? getFileContentUrl(photo) : '';
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) };
  const inner = src ? (
    <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="w-full h-full object-cover" />
  ) : (
    <span aria-hidden="true">{initialsOf(name)}</span>
  );
  const base = `rounded-full overflow-hidden shrink-0 bg-[#0B1F4B] text-amber-300 font-bold flex items-center justify-center ${className}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={style} className={`${base} ring-offset-2 hover:ring-2 hover:ring-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`} aria-label={label || `View ${name || 'profile'}`}>
        {inner}
      </button>
    );
  }
  return (
    <span style={style} className={base} role={src ? 'img' : undefined} aria-label={src ? name : undefined}>
      {inner}
    </span>
  );
};
