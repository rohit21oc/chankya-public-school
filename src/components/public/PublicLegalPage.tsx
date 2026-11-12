import React, { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { SchoolSettings } from '../../types';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { buildCookiePolicy, buildPrivacyPolicy, LEGAL_LAST_UPDATED, type LegalDocId } from '../../constants/legalContent';
import { openCookieSettings } from '../../utils/cookieConsent';

interface PublicLegalPageProps {
  doc: LegalDocId;
  settings: SchoolSettings;
  onBackToHome: () => void;
  onNavigate: (path: string) => void;
}

export const PublicLegalPage: React.FC<PublicLegalPageProps> = ({ doc, settings, onBackToHome, onNavigate }) => {
  const document_ = useMemo(() => (doc === 'cookies' ? buildCookiePolicy(settings) : buildPrivacyPolicy(settings)), [doc, settings]);
  const logo = getSchoolLogoSrc(settings.schoolLogo);

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [doc]);

  const link = (path: string, label: string) => (
    <a
      href={path}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(path);
      }}
      className="font-medium text-blue-800 underline underline-offset-2 hover:text-blue-950"
    >
      {label}
    </a>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            {logo && <img src={logo} onError={handleLogoError} alt="" className="h-8 w-8 shrink-0 object-contain" />}
            <span className="truncate text-sm font-semibold text-slate-900">{settings.schoolName}</span>
          </div>
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="whitespace-nowrap">Website</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{document_.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{document_.summary}</p>
          <p className="mt-2 text-xs text-slate-500">Last updated {LEGAL_LAST_UPDATED}</p>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="mb-3 text-xs font-semibold text-slate-500">On this page</p>
              <ul className="space-y-1 border-l border-slate-200">
                {document_.sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-[13px] text-slate-600 hover:border-blue-800 hover:text-slate-900">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <article className="min-w-0 max-w-3xl space-y-10">
            {document_.sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-lg font-semibold text-slate-900">
                  <span className="mr-2 tabular-nums text-slate-400">{i + 1}.</span>
                  {s.title}
                </h2>
                {s.paragraphs?.map((p, idx) => (
                  <p key={idx} className="mt-3 text-[15px] leading-relaxed text-slate-700">{p}</p>
                ))}
                {s.table && (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full min-w-[520px] text-left text-[13px]">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          {s.table.head.map((h) => (
                            <th key={h} scope="col" className="px-4 py-2.5 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-700">
                        {s.table.rows.map((row, r) => (
                          <tr key={r} className="align-top">
                            {row.map((cell, k) => (
                              <td key={k} className={`px-4 py-3 leading-relaxed ${k === 0 ? 'font-medium text-slate-900' : ''}`}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {s.bullets && (
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700 marker:text-slate-400">
                    {s.bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </article>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-[13px] text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>&copy; {new Date().getFullYear()} {settings.schoolName}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {link('/privacy-policy', 'Privacy Policy')}
            {link('/cookie-policy', 'Cookie Policy')}
            <button type="button" onClick={openCookieSettings} className="font-medium text-blue-800 underline underline-offset-2 hover:text-blue-950">
              Cookie settings
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
