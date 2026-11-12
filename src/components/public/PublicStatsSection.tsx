import React, { useState, useEffect } from 'react';
import {
  Award,
  Users,
  GraduationCap,
  Building,
  ShieldCheck,
  Bus,
} from 'lucide-react';
import { api } from '../../services/api';

export const PublicStatsSection: React.FC = () => {
  const [statsData, setStatsData] = useState<{
    activeStudents: number;
    activeStaff: number;
    activeClasses: number;
    activeSubjects: number;
    activeRoutes: number;
    activeRooms: number;
    classRange: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    api.getPublicStats().then((data) => {
      if (isMounted) {
        setStatsData(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const stats = [
    {
      id: 'stat-1',
      number: statsData ? statsData.classRange : 'Class 1–8',
      label: 'Classes & Academic Wings',
      sub: statsData ? `${statsData.activeClasses} active graded levels` : 'Comprehensive co-ed schooling',
      icon: Award,
      color: 'text-amber-400',
    },
    {
      id: 'stat-2',
      number: statsData ? String(statsData.activeStudents) : '0',
      label: 'Active Students Enrolled',
      sub: 'Verified institutional enrollment',
      icon: Users,
      color: 'text-blue-400',
    },
    {
      id: 'stat-3',
      number: statsData ? String(statsData.activeStaff) : '0',
      label: 'Qualified Educators & Staff',
      sub: 'Trained, dedicated & compassionate',
      icon: GraduationCap,
      color: 'text-emerald-400',
    },
    {
      id: 'stat-4',
      number: statsData ? String(statsData.activeClasses) : '0',
      label: 'Active Class Sections',
      sub: statsData ? `${statsData.activeSubjects} curriculum subjects taught` : 'Class 1 to 8 curriculum',
      icon: Building,
      color: 'text-indigo-400',
    },
    {
      id: 'stat-5',
      number: statsData ? String(statsData.activeRooms) : '0',
      label: 'Hostel Rooms',
      sub: 'Dormitories, dining & warden support',
      icon: ShieldCheck,
      color: 'text-teal-400',
    },
    {
      id: 'stat-6',
      number: statsData ? String(statsData.activeRoutes) : '0',
      label: 'Active Transport Routes',
      sub: 'Secure transport & GPS monitoring',
      icon: Bus,
      color: 'text-rose-400',
    },
  ];

  // Hostel / transport tiles only make sense when the school has set those up.
  const visibleStats = stats.filter((st) => !(['stat-5', 'stat-6'].includes(st.id) && (!statsData || Number(st.number) === 0)));

  return (
    <section id="stats" className="py-14 sm:py-20 bg-slate-900 text-white relative overflow-hidden">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Excellence by the Numbers
          </h3>
          <p className="text-xs sm:text-sm text-slate-400">
            The foundation of Chanakya Public School & Coaching Centre rests on verified milestones and uncompromising quality.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
          {visibleStats.map((st) => {
            const Icon = st.icon;
            return (
              <div
                key={st.id}
                className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/60 backdrop-blur-xs flex flex-col items-center text-center justify-between group hover:border-slate-500 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl bg-slate-900/90 flex items-center justify-center mb-3 shadow-inner ${st.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-white tracking-tight group-hover:scale-105 transition-transform">
                    {st.number}
                  </div>
                  <div className="text-xs font-bold text-slate-200 mt-1 leading-snug">
                    {st.label}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    {st.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
