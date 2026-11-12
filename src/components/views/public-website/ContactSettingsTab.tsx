import React, { useState } from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Globe,
  Save,
  CheckCircle2,
  Loader2,
  Building,
  Share2,
} from 'lucide-react';
import { SchoolSettings, PublicWebsiteContent } from '../../../types';

interface ContactSettingsTabProps {
  settings: SchoolSettings;
  content: PublicWebsiteContent;
  onUpdateSettings: (updated: Partial<SchoolSettings>) => Promise<void>;
  onUpdateContent: (updated: PublicWebsiteContent) => Promise<void>;
}

export const ContactSettingsTab: React.FC<ContactSettingsTabProps> = ({
  settings,
  content,
  onUpdateSettings,
  onUpdateContent,
}) => {
  const [address, setAddress] = useState(
    content.contactInfo?.address || settings.schoolAddress || (settings as any).address || ''
  );
  const [primaryPhone, setPrimaryPhone] = useState(
    content.contactInfo?.phone || settings.contactNumber || (settings as any).phone || ''
  );
  const [secondaryPhone, setSecondaryPhone] = useState(
    content.contactInfo?.secondaryPhone || (Array.isArray(settings.headerContacts) ? settings.headerContacts[1] || '' : '')
  );
  const [email, setEmail] = useState(
    content.contactInfo?.email || settings.email || ''
  );
  const [affiliationCode, setAffiliationCode] = useState(
    (settings as any).cbseAffiliationNumber || settings.affiliationNumber || settings.affiliationCode || ''
  );
  const [visitingHours, setVisitingHours] = useState(
    content.contactInfo?.visitingHours || 'Monday - Saturday: 8:00 AM - 04:00 PM'
  );
  const [googleMapsEmbedUrl, setGoogleMapsEmbedUrl] = useState(
    content.contactInfo?.googleMapsEmbedUrl || ''
  );
  const [facebookUrl, setFacebookUrl] = useState(
    content.contactInfo?.socialLinks?.facebook || ''
  );
  const [youtubeUrl, setYoutubeUrl] = useState(
    content.contactInfo?.socialLinks?.youtube || ''
  );
  const [instagramUrl, setInstagramUrl] = useState(
    content.contactInfo?.socialLinks?.instagram || ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);

      // 1. Update school settings
      await onUpdateSettings({
        address,
        phone: primaryPhone,
        email,
        cbseAffiliationNumber: affiliationCode,
      });

      // 2. Update website content contactInfo
      const updatedContent: PublicWebsiteContent = {
        ...content,
        contactInfo: {
          address,
          phone: primaryPhone,
          secondaryPhone,
          email,
          visitingHours,
          googleMapsEmbedUrl,
          socialLinks: {
            facebook: facebookUrl,
            youtube: youtubeUrl,
            instagram: instagramUrl,
          },
        },
      };
      await onUpdateContent(updatedContent);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save contact info: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-600" />
            <span>Campus Contact & Location Information</span>
          </h3>
          <p className="text-xs text-slate-500">
            Configure official physical address, helpline numbers, visiting hours, and social channels.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-xs transition cursor-pointer disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save Contact Information</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Contact details and campus location updated across website and documents!</span>
        </div>
      )}

      {/* Main Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Physical Address */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building className="w-4 h-4 text-slate-700" />
            <h4 className="text-sm font-black text-slate-900">Campus Location & CBSE Code</h4>
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-700">Official Postal Address</label>
            <textarea
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full street address..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 leading-relaxed focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-700">Affiliation Code</label>
            <input
              type="text"
              value={affiliationCode}
              onChange={(e) => setAffiliationCode(e.target.value)}
              placeholder="e.g. 10030206405"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-700">Campus Visiting & Enquiry Hours</label>
            <input
              type="text"
              value={visitingHours}
              onChange={(e) => setVisitingHours(e.target.value)}
              placeholder="e.g. Monday - Saturday: 8:00 AM - 04:00 PM"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Telephones & Emails */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Phone className="w-4 h-4 text-slate-700" />
            <h4 className="text-sm font-black text-slate-900">Official Communication Channels</h4>
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-700">Primary Admission Helpline</label>
            <input
              type="tel"
              value={primaryPhone}
              onChange={(e) => setPrimaryPhone(e.target.value)}
              placeholder="+91 95075 95491"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-700">Secondary / Emergency Phone</label>
            <input
              type="tel"
              value={secondaryPhone}
              onChange={(e) => setSecondaryPhone(e.target.value)}
              placeholder="+91 95075 95492"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-700">Official General Inquiries Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@pdspublicschool.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Social Links & Map */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Share2 className="w-4 h-4 text-slate-700" />
          <h4 className="text-sm font-black text-slate-900">Social Media & Map Location</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-700">Facebook Page URL</label>
            <input
              type="url"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              placeholder="https://facebook.com/pdspublicschool"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">YouTube Channel URL</label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/@pdspublicschool"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">Instagram Handle / URL</label>
            <input
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/pdssheohar"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="space-y-1 text-xs pt-2">
          <label className="font-bold text-slate-700">Google Maps Embed URL / Link</label>
          <input
            type="text"
            value={googleMapsEmbedUrl}
            onChange={(e) => setGoogleMapsEmbedUrl(e.target.value)}
            placeholder="https://www.google.com/maps/embed?pb=..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          />
        </div>
      </div>
    </form>
  );
};
