import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  UploadCloud,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  Sparkles,
  Loader2,
  Tag,
} from 'lucide-react';
import { PublicWebsiteEvent } from '../../../types';
import { fileUploadService } from '../../../services/fileUploadService';

interface EventsManagementTabProps {
  events: PublicWebsiteEvent[];
  onSaveEvent: (event: Partial<PublicWebsiteEvent>) => Promise<void>;
  onUpdateEvent: (id: string, updates: Partial<PublicWebsiteEvent>) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

export const EventsManagementTab: React.FC<EventsManagementTabProps> = ({
  events = [],
  onSaveEvent,
  onUpdateEvent,
  onDeleteEvent,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PublicWebsiteEvent | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<
    'ACADEMIC' | 'SPORTS' | 'CULTURAL' | 'CELEBRATION' | 'EXAM' | 'OTHER'
  >('CELEBRATION');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('School Main Campus');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [imageFileKey, setImageFileKey] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const openAddModal = () => {
    setEditingEvent(null);
    setTitle('');
    setCategory('CELEBRATION');
    setStartDate(new Date().toISOString().substring(0, 10));
    setEndDate('');
    setTime('09:00 AM - 01:00 PM');
    setVenue('School Main Campus, Sheohar');
    setDescription('');
    setImage('');
    setImageFileKey('');
    setIsFeatured(false);
    setIsActive(true);
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const openEditModal = (ev: PublicWebsiteEvent) => {
    setEditingEvent(ev);
    setTitle(ev.title);
    setCategory(ev.category || 'CELEBRATION');
    setStartDate(ev.startDate || '');
    setEndDate(ev.endDate || '');
    setTime(ev.time || '');
    setVenue(ev.venue || '');
    setDescription(ev.description || '');
    setImage(ev.image || '');
    setImageFileKey(ev.imageFileKey || '');
    setIsFeatured(ev.isFeatured === true);
    setIsActive(ev.isActive !== false);
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress(20);
      const result = await fileUploadService.uploadDirectToR2(
        file,
        'public-website/events',
        (progress) => {
          setUploadProgress(Math.min(95, Math.max(20, progress)));
        }
      );
      setImage(result.publicUrl);
      setImageFileKey(result.fileKey);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 1000);
    } catch (err: any) {
      alert(`Upload failed: ${err.message || 'Please check network connection'}`);
      setUploadProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) {
      alert('Event title and date are required');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<PublicWebsiteEvent> = {
        title: title.trim(),
        category,
        startDate,
        endDate: endDate || undefined,
        time: time.trim() || undefined,
        venue: venue.trim() || undefined,
        description: description.trim(),
        image: image || undefined,
        imageFileKey: imageFileKey || undefined,
        isFeatured,
        isActive,
      };

      if (editingEvent) {
        await onUpdateEvent(editingEvent.id, payload);
      } else {
        await onSaveEvent({
          ...payload,
          displayOrder: events.length + 1,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Error saving event: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <span>School Events Calendar</span>
          </h3>
          <p className="text-xs text-slate-500">
            Showcase upcoming celebrations, academic exhibitions, sports meets, and parent-teacher gatherings.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Event</span>
        </button>
      </div>

      {/* Events List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(events || []).map((ev) => (
          <div
            key={ev.id}
            className={`p-5 rounded-2xl bg-white border transition shadow-xs flex flex-col justify-between space-y-4 ${
              ev.isActive === false ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="space-y-3">
              {/* Image banner */}
              {ev.image && ev.image.trim() ? (
                <div className="h-36 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative">
                  <img
                    src={ev.image}
                    alt={ev.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {ev.isFeatured && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-slate-950 flex items-center gap-1 shadow-xs">
                      <Sparkles className="w-3 h-3" />
                      <span>Featured Event</span>
                    </span>
                  )}
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {ev.category}
                </span>
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{ev.startDate}</span>
                </span>
              </div>

              <h4 className="text-sm font-black text-slate-900 leading-snug">{ev.title}</h4>
              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{ev.description}</p>

              <div className="space-y-1 text-[11px] text-slate-500 pt-1">
                {ev.time && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{ev.time}</span>
                  </div>
                )}
                {ev.venue && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{ev.venue}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <button
                onClick={() => onUpdateEvent(ev.id, { isActive: ev.isActive === false })}
                className={`text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer ${
                  ev.isActive !== false ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                }`}
              >
                {ev.isActive !== false ? 'Active' : 'Hidden'}
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(ev)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                  title="Edit event"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTargetId(ev.id)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="Delete event"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div className="col-span-full p-12 text-center rounded-2xl bg-white border border-dashed border-slate-300 space-y-3">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">No events scheduled</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add annual sports days, science fairs, and national celebrations.
            </p>
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Event */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                {editingEvent ? 'Edit School Event' : 'Create School Event'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Event Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Annual Sports Meet 2026"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="CELEBRATION">Celebration</option>
                    <option value="SPORTS">Sports & Athletics</option>
                    <option value="ACADEMIC">Academic Exhibition</option>
                    <option value="CULTURAL">Cultural Function</option>
                    <option value="EXAM">Examination</option>
                    <option value="OTHER">General Event</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Time / Hours</label>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="e.g. 09:30 AM - 02:00 PM"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Venue</label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. School Playground, Sheohar"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Event Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details about program, participants, guest of honor..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Cover Image */}
              <div className="space-y-2 p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                <label className="font-bold text-slate-700 block">Cover image</label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs transition">
                    <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
                    <span>Upload Cover</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                  {image && <span className="text-[11px] text-emerald-700 font-bold">Image loaded</span>}
                  {uploadProgress !== null && (
                    <span className="text-[11px] font-bold text-emerald-600">
                      Uploading {uploadProgress}%
                    </span>
                  )}
                </div>

                <input
                  // Text, not "url": uploads fill in a site-relative path (/api/files/content?key=...),
                  // which the browser's URL check rejects and blocks saving.
                  type="text"
                  inputMode="url"
                  spellCheck={false}
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="Or enter direct CDN image URL..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded border-slate-300"
                  />
                  <span className="font-bold text-slate-800">Feature on Homepage</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                  />
                  <span className="font-bold text-slate-800">Publish Immediately</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingEvent ? 'Save Event' : 'Create Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4">
            <h4 className="text-base font-bold text-slate-900">Delete School Event?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              This event will be permanently unlinked from the public events calendar.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onDeleteEvent(deleteTargetId);
                  setDeleteTargetId(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
