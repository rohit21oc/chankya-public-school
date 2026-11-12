import React, { useState } from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  CheckCircle2,
  Building,
  Navigation,
  ExternalLink,
  Headphones,
} from 'lucide-react';
import { SchoolSettings } from '../../types';
import { api } from '../../services/api';
import { useConsent, openCookieSettings } from '../../utils/cookieConsent';
import { affiliationText, schoolIdentity } from '../../utils/schoolIdentity';

interface PublicContactSectionProps {
  settings?: SchoolSettings;
}

export const PublicContactSection: React.FC<PublicContactSectionProps> = ({ settings }) => {
  const { embeds: embedsAllowed } = useConsent();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Saved School Settings only; nothing is invented when a value is missing.
  const sid = schoolIdentity(settings);
  const address = sid.address;
  const email = sid.email;
  const helpline = sid.helpline;
  const affiliationCode = sid.affiliationNo;
  const headerContacts = sid.phones;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const digits = phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  const phoneBad = phone.length > 0 && digits.length !== 10;

  const handleQuickContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || digits.length !== 10) {
      setError('Please enter your name and a 10-digit mobile number.');
      return;
    }
    setBusy(true);
    setError('');
    const r = await api.submitCallbackRequest({ name: name.trim(), mobile: digits, message: message.trim(), preferredTime });
    setBusy(false);
    if (r.success) {
      setReference(r.referenceNumber || '');
      setSubmitted(true);
      setName('');
      setPhone('');
      setMessage('');
      setPreferredTime('');
    } else {
      setError(r.error || 'Could not send your request.');
    }
  };

  return (
    <section id="contact" className="py-16 sm:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Campus Location & Contact Information
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            We welcome parents and guardians to visit our campus in Sheohar during regular office hours to experience our facilities first-hand.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Contact Cards */}
          <div className="lg:col-span-5 space-y-4">
            {/* Campus Address Card */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Campus Address
                </h4>
                <p className="text-sm font-bold text-slate-900 leading-snug">
                  RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {address}
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-mono text-emerald-700 font-medium">
                    Plus Code: G77Q+2J Sheohar, Bihar
                  </span>
                </div>
              </div>
            </div>

            {/* Helpline Phone Card */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Admission & Contact Numbers
                </h4>
                <div className="flex flex-wrap items-center gap-2 text-base font-black text-slate-900">
                  <a
                    href={`tel:${headerContacts[0]}`}
                    className="hover:text-blue-800 transition-colors"
                  >
                    {headerContacts[0]}
                  </a>
                  {headerContacts[1] && (
                    <>
                      <span className="text-slate-400 font-normal">|</span>
                      <a
                        href={`tel:${headerContacts[1]}`}
                        className="hover:text-blue-800 transition-colors"
                      >
                        {headerContacts[1]}
                      </a>
                    </>
                  )}
                </div>
                {helpline && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-0.5">
                    <Headphones className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Helpline: <a href={`tel:${helpline}`} className="font-bold text-slate-800 hover:underline">{helpline}</a></span>
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  Available Mon - Sat during regular school hours (7:30 AM – 4:30 PM)
                </p>
              </div>
            </div>

            {/* Email Address Card */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Official Email Correspondence
                </h4>
                <a
                  href={`mailto:${email}`}
                  className="text-xs sm:text-sm font-bold text-slate-900 hover:text-blue-800 transition-colors block break-all"
                >
                  {email}
                </a>
                <p className="text-[11px] text-slate-500">
                  For official school enquiries, registrations and circulars
                </p>
              </div>
            </div>

            {/* Office Hours */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Visiting & Office Hours
                </h4>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  Monday to Saturday: 07:30 AM – 04:30 PM
                </p>
                <p className="text-[11px] text-slate-500">
                  Closed on Sundays and Gazetted National Holidays
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Google Maps Embed (Satellite View) & Quick Callback */}
          <div className="lg:col-span-7 space-y-6">
            {/* Map Frame */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 relative">
              <div className="p-3 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2">
                  <Navigation className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-bold">RESIDENTIAL PDS PUBLIC SCHOOL • Sheohar, Bihar (G77Q+2J)</span>
                </div>
                <a
                  href="https://www.google.com/maps/place/PDS+PUBLIC+SCHOOL/@26.5125425,85.2865357,745m/data=!3m2!1e3!4b1!4m6!3m5!1s0x39ece71e1548a643:0x68ea7ac1528724d4!8m2!3d26.5125425!4d85.2891106!16s%2Fg%2F11rv6286td"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline flex items-center gap-1 font-semibold text-[11px] self-start sm:self-auto"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Map: loads Google content only after the visitor allows embedded content */}
              <div className="w-full h-72 sm:h-80 bg-slate-100">
                {embedsAllowed ? (
                  <iframe
                    title="Residential PDS Public School Sheohar Satellite Map"
                    src="https://maps.google.com/maps?q=26.5125425,85.2891106&t=k&z=17&ie=UTF8&iwloc=&output=embed"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                    <MapPin className="h-6 w-6 text-slate-400" aria-hidden="true" />
                    <p className="max-w-xs text-sm text-slate-600">The map is provided by Google and is hidden because embedded content is turned off.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <button type="button" onClick={openCookieSettings} className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50">Change cookie settings</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Location Bar without displaying raw numeric coordinates */}
              <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-blue-700" />
                  <span>{address}</span>
                </span>
                <span className="flex items-center gap-1.5 font-mono text-emerald-700 font-semibold">
                  <span>Plus Code: G77Q+2J Sheohar, Bihar</span>
                </span>
              </div>
            </div>

            {/* Quick Callback Message Form */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
              <h4 className="text-sm font-bold text-slate-900 mb-1">Request a Quick Callback</h4>
              <p className="text-xs text-slate-600 mb-4">
                Leave your contact details and our admissions desk will call you back promptly.
              </p>

              {submitted ? (
                <div role="status" className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                    <p className="leading-relaxed">
                      Thank you. Our admissions desk will call you back shortly
                      {reference ? <> (request no. <span className="font-mono font-bold">{reference}</span>)</> : null}.
                    </p>
                  </div>
                  <button type="button" onClick={() => setSubmitted(false)} className="text-emerald-800 font-semibold underline underline-offset-2 cursor-pointer">
                    Send another request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleQuickContact} className="space-y-3" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="cb-name" className="block text-xs font-semibold text-slate-700 mb-1">Your name</label>
                      <input id="cb-name" type="text" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30" />
                    </div>
                    <div>
                      <label htmlFor="cb-phone" className="block text-xs font-semibold text-slate-700 mb-1">Mobile number</label>
                      <input id="cb-phone" type="tel" inputMode="numeric" autoComplete="tel" maxLength={14} value={phone} onChange={(e) => setPhone(e.target.value)} required
                        aria-invalid={phoneBad} aria-describedby={phoneBad ? 'cb-phone-err' : undefined}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 ${phoneBad ? 'border-red-400' : 'border-slate-300'}`} />
                      {phoneBad && <p id="cb-phone-err" className="mt-1 text-xs text-red-600">Enter a 10-digit mobile number.</p>}
                    </div>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-700 mb-1">Best time to call</span>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Best time to call">
                      {['Morning', 'Afternoon', 'Evening'].map((t) => (
                        <button key={t} type="button" aria-pressed={preferredTime === t} onClick={() => setPreferredTime(preferredTime === t ? '' : t)}
                          className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${preferredTime === t ? 'bg-blue-900 border-blue-900 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-blue-700'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="cb-msg" className="block text-xs font-semibold text-slate-700 mb-1">Question or class of interest (optional)</label>
                    <textarea id="cb-msg" rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 resize-none" />
                  </div>
                  {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
                  <p className="text-[11px] text-slate-500 leading-relaxed">We use your number only to call you about admissions.</p>
                  <button type="submit" disabled={busy}
                    className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]">
                    <Send className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{busy ? 'Sending...' : 'Send Callback Request'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
