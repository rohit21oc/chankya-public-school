import React, { useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
  Clock,
  Laptop,
} from 'lucide-react';

interface PublicAcademicsSectionProps {
  onOpenEnquiry: () => void;
  onOpenCalendarModal: () => void;
}

export const PublicAcademicsSection: React.FC<PublicAcademicsSectionProps> = ({
  onOpenEnquiry,
  onOpenCalendarModal,
}) => {
  const [selectedWing, setSelectedWing] = useState<'all' | 'pre-primary' | 'primary' | 'middle'>('all');

  const wings = [
    {
      id: 'pre-primary',
      title: 'Foundational Wing',
      subtitle: 'Nursery, LKG, UKG',
      age: 'Ages 3 to 6 Years',
      desc: 'Play-way methodology, sensory stimulation, phonics, storytelling, foundational numeracy, and joyful learning in a nurturing child-friendly environment.',
      subjects: ['English Phonics', 'Rhymes & Storytelling', 'Number Work', 'Art & Craft', 'EVS & Moral Etiquette'],
      color: 'border-pink-200 bg-pink-50/40 text-pink-900',
      badgeColor: 'bg-pink-100 text-pink-800',
    },
    {
      id: 'primary',
      title: 'Primary Wing',
      subtitle: 'Classes 1st to 5th',
      age: 'Ages 6 to 11 Years',
      desc: 'Developing conceptual clarity, fluent reading, mathematical logic, environmental science, and strong moral principles through creative group projects.',
      subjects: ['English Grammar & Literature', 'Mathematics', 'Environmental Studies', 'Hindi Language', 'General Knowledge', 'Computer Basics'],
      color: 'border-blue-200 bg-blue-50/40 text-blue-900',
      badgeColor: 'bg-blue-100 text-blue-800',
    },
    {
      id: 'middle',
      title: 'Middle School Wing',
      subtitle: 'Classes 6th to 8th',
      age: 'Ages 11 to 14 Years',
      desc: 'Deepening analytical inquiry in Science, Social Studies, advanced Mathematics, Sanskrit/Hindi, and digital computer programming with laboratory practicals.',
      subjects: ['General Science (Physics/Chem/Bio)', 'Algebra & Geometry', 'History, Civics, Geography', 'English & Hindi', 'Sanskrit', 'Computer Coding'],
      color: 'border-emerald-200 bg-emerald-50/40 text-emerald-900',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
  ];

  const filteredWings = selectedWing === 'all' ? wings : wings.filter((w) => w.id === selectedWing);

  return (
    <section id="academics" className="py-16 sm:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Academic Wings & Curriculum (Nursery to 8th)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Following the national CBSE pedagogical framework from Nursery to Class 8, our curriculum is structured to ignite curiosity, critical reasoning, and academic distinction at every developmental stage.
          </p>

          {/* Wing Filter Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-3">
            <button
              type="button"
              onClick={() => setSelectedWing('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedWing === 'all'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Wings
            </button>
            <button
              type="button"
              onClick={() => setSelectedWing('pre-primary')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedWing === 'pre-primary'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Foundational (Nursery-UKG)
            </button>
            <button
              type="button"
              onClick={() => setSelectedWing('primary')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedWing === 'primary'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Primary (1st-5th)
            </button>
            <button
              type="button"
              onClick={() => setSelectedWing('middle')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedWing === 'middle'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Middle (6th-8th)
            </button>
          </div>
        </div>

        {/* Wings Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {filteredWings.map((wing) => (
            <div
              key={wing.id}
              className={`p-6 rounded-2xl border ${wing.color} flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${wing.badgeColor}`}>
                    {wing.subtitle}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">{wing.age}</span>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-slate-900">{wing.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{wing.desc}</p>

                <div className="pt-3 border-t border-slate-200/60">
                  <h4 className="text-xs font-bold text-slate-800 mb-2">Key Subjects & Focus Areas:</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {wing.subjects.map((sub, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-2.5 py-1 rounded-lg bg-white/80 border border-slate-200 text-[11px] font-medium text-slate-700"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-xs text-slate-500">English Medium Instruction</span>
                <button
                  type="button"
                  onClick={onOpenEnquiry}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-900 text-white text-xs font-bold hover:bg-blue-800 transition-colors cursor-pointer"
                >
                  Enquire for {wing.subtitle}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Academic Pillars Banner */}
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 text-white flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-bold">
              <Calendar className="w-4 h-4" />
              <span>Session 2026-2027 Schedule</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black">
              Academic Calendar, Examinations & Holidays
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              View scheduled Unit Tests, Half-Yearly Assessments, Annual Evaluations, co-curricular sports events, and national holiday calendars.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenCalendarModal}
              className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>View Academic Calendar</span>
            </button>
            <button
              type="button"
              onClick={onOpenEnquiry}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20 transition-colors cursor-pointer"
            >
              Enquire for Admission
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
