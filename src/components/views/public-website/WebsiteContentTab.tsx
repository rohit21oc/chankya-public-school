import React, { useState } from 'react';
import {
  FileText,
  Save,
  CheckCircle2,
  Loader2,
  Sparkles,
  BookOpen,
  Home,
  Award,
  Compass,
  Plus,
  Trash2,
} from 'lucide-react';
import { PublicWebsiteContent } from '../../../types';

interface WebsiteContentTabProps {
  content: PublicWebsiteContent;
  onSaveContent: (updated: PublicWebsiteContent) => Promise<void>;
}

export const WebsiteContentTab: React.FC<WebsiteContentTabProps> = ({
  content,
  onSaveContent,
}) => {
  const [formData, setFormData] = useState<PublicWebsiteContent>({ ...content });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Vision points helper
  const [newVisionPoint, setNewVisionPoint] = useState('');
  const [newMissionPoint, setNewMissionPoint] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await onSaveContent(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save website content: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const addVisionPoint = () => {
    if (!newVisionPoint.trim()) return;
    setFormData((prev) => ({
      ...prev,
      visionPoints: [...(prev.visionPoints || []), newVisionPoint.trim()],
    }));
    setNewVisionPoint('');
  };

  const removeVisionPoint = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      visionPoints: (prev.visionPoints || []).filter((_, i) => i !== idx),
    }));
  };

  const addMissionPoint = () => {
    if (!newMissionPoint.trim()) return;
    setFormData((prev) => ({
      ...prev,
      missionPoints: [...(prev.missionPoints || []), newMissionPoint.trim()],
    }));
    setNewMissionPoint('');
  };

  const removeMissionPoint = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      missionPoints: (prev.missionPoints || []).filter((_, i) => i !== idx),
    }));
  };

  return (
    <form onSubmit={handleSave} className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            <span>Core Website Text & Institutional Philosophy</span>
          </h3>
          <p className="text-xs text-slate-500">
            Edit the About Us, Vision, Mission, Academic Philosophy, and Hostel statements shown on the public portal.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-xs transition cursor-pointer disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save Content Changes</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>All website content changes have been saved to database and live portal!</span>
        </div>
      )}

      {/* 1. About Us Section */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h4 className="text-sm font-black text-slate-900">About the School Narrative</h4>
        </div>

        <div className="space-y-1 text-xs">
          <label className="font-bold text-slate-700">Detailed About Us Text</label>
          <textarea
            rows={5}
            value={formData.aboutSchool || ''}
            onChange={(e) => setFormData({ ...formData, aboutSchool: e.target.value })}
            placeholder="Comprehensive description of Residential PDS Public School..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 leading-relaxed focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* 2. Vision & Mission */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vision */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Compass className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-black text-slate-900">Our Vision</h4>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Vision Statement</label>
              <textarea
                rows={3}
                value={formData.visionStatement || ''}
                onChange={(e) => setFormData({ ...formData, visionStatement: e.target.value })}
                placeholder="Core visionary statement..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Vision Points */}
            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-700 block">Key Pillars of Vision</label>
              <div className="space-y-1.5">
                {(formData.visionPoints || []).map((pt, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <span className="text-slate-800">{pt}</span>
                    <button
                      type="button"
                      onClick={() => removeVisionPoint(i)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newVisionPoint}
                  onChange={(e) => setNewVisionPoint(e.target.value)}
                  placeholder="Add a pillar..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={addVisionPoint}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mission */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Award className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-black text-slate-900">Our Mission</h4>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Mission Statement</label>
              <textarea
                rows={3}
                value={formData.missionStatement || ''}
                onChange={(e) => setFormData({ ...formData, missionStatement: e.target.value })}
                placeholder="Institutional mission statement..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* Mission Points */}
            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-700 block">Mission Action Commitments</label>
              <div className="space-y-1.5">
                {(formData.missionPoints || []).map((pt, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <span className="text-slate-800">{pt}</span>
                    <button
                      type="button"
                      onClick={() => removeMissionPoint(i)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newMissionPoint}
                  onChange={(e) => setNewMissionPoint(e.target.value)}
                  placeholder="Add commitment..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={addMissionPoint}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Academic & Hostel Philosophy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <BookOpen className="w-4 h-4 text-purple-600" />
            <h4 className="text-sm font-black text-slate-900">Academic Excellence Overview</h4>
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-700">Academic Program Description</label>
            <textarea
              rows={4}
              value={formData.academicsOverview || ''}
              onChange={(e) => setFormData({ ...formData, academicsOverview: e.target.value })}
              placeholder="Describe pedagogical approach, NEP alignment, and faculty rigor..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 leading-relaxed focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Home className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-black text-slate-900">Residential Life & Hostel</h4>
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-700">Hostel & Boarding Narrative</label>
            <textarea
              rows={4}
              value={formData.hostelOverview || ''}
              onChange={(e) => setFormData({ ...formData, hostelOverview: e.target.value })}
              placeholder="Highlight 24x7 security, dining hygiene, evening study hours..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 leading-relaxed focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end pt-4">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xs transition cursor-pointer disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save Content Changes</span>
        </button>
      </div>
    </form>
  );
};
