import React, { useEffect, useRef, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import { closeCookieSettings, saveConsent, useConsent, useCookiePanelOpen } from '../../utils/cookieConsent';
import { navigate, parseCurrentRoute, subscribeToRouteChanges } from '../../services/routerService';

/**
 * Cookie and local-storage notice for the public website and sign-in pages.
 * Accept and Essential-only carry equal weight. The panel can be reopened from the footer.
 */
export const CookieConsent: React.FC = () => {
  const [inPortal, setInPortal] = useState(() => parseCurrentRoute().type === 'portal');
  useEffect(() => subscribeToRouteChanges((r) => setInPortal(r.type === 'portal')), []);
  return inPortal ? null : <CookieConsentPanel />;
};

const CookieConsentPanel: React.FC = () => {
  const consent = useConsent();
  const forced = useCookiePanelOpen();
  const [customising, setCustomising] = useState(false);
  const [embeds, setEmbeds] = useState(consent.embeds);
  const firstButton = useRef<HTMLButtonElement>(null);
  const visible = !consent.decided || forced;

  useEffect(() => {
    if (forced) {
      setCustomising(true);
      setEmbeds(consent.embeds);
    }
  }, [forced, consent.embeds]);

  useEffect(() => {
    if (visible && customising) firstButton.current?.focus();
  }, [visible, customising]);

  useEffect(() => {
    if (!visible || !customising) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && consent.decided) {
        setCustomising(false);
        closeCookieSettings();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, customising, consent.decided]);

  if (!visible) return null;

  const finish = (choice: { embeds: boolean }) => {
    saveConsent(choice);
    setCustomising(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      className="fixed inset-x-0 bottom-0 z-[100] print:hidden px-3 pb-3 sm:px-4 sm:pb-4 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.14)] motion-safe:animate-[cookie-in_220ms_ease-out]">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700" aria-hidden="true">
              <Cookie className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h2 id="cookie-title" className="text-sm font-semibold text-slate-900">
                  Cookies and local storage
                </h2>
                {consent.decided && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomising(false);
                      closeCookieSettings();
                    }}
                    className="-m-1 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
                    aria-label="Close cookie settings"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {!customising ? (
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                  We store a small amount of data on your device to keep you signed in and to remember this choice. The map on our Contact section is provided by Google and loads only if you allow it. We do not use advertising or analytics cookies.{' '}
                  <a
                    href="/cookie-policy"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/cookie-policy');
                    }}
                    className="font-medium text-blue-800 underline underline-offset-2 hover:text-blue-950"
                  >
                    Cookie Policy
                  </a>
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="text-[13px] font-medium text-slate-900">Essential</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">Keeps you signed in and records this choice. The site cannot work without it.</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">Always on</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3">
                    <div>
                      <p id="embeds-label" className="text-[13px] font-medium text-slate-900">Embedded third-party content</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">Shows the Google Maps location on the Contact section. Google may set its own cookies and receives your IP address when the map loads.</p>
                    </div>
                    <button
                      ref={firstButton}
                      type="button"
                      role="switch"
                      aria-checked={embeds}
                      aria-labelledby="embeds-label"
                      onClick={() => setEmbeds((v) => !v)}
                      className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${embeds ? 'bg-blue-800' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${embeds ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {!customising ? (
              <button
                type="button"
                onClick={() => setCustomising(true)}
                className="min-h-10 rounded-lg px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
              >
                Manage choices
              </button>
            ) : (
              <button
                type="button"
                onClick={() => finish({ embeds })}
                className="min-h-10 rounded-lg px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
              >
                Save choices
              </button>
            )}
            <button
              type="button"
              onClick={() => finish({ embeds: false })}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => finish({ embeds: true })}
              className="min-h-10 rounded-lg border border-blue-900 bg-blue-900 px-4 text-[13px] font-semibold text-white hover:bg-blue-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
