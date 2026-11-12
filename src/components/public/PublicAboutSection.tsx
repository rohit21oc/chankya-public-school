import React, { useState, useEffect } from 'react';
import {
  Building2,
  Compass,
  GraduationCap,
  Award,
  CheckCircle2,
  Users,
  ShieldCheck,
  Quote,
  HeartHandshake,
  ArrowRight,
} from 'lucide-react';
import { PublicLeadershipProfile } from '../../types';
import { api } from '../../services/api';
import { schoolIdentity } from '../../utils/schoolIdentity';
import { mediaSrc } from '../../utils/publicMedia';

export const PublicAboutSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'vision' | 'leadership'>('overview');
  const [imageError, setImageError] = useState(false);
  const [leadershipProfiles, setLeadershipProfiles] = useState<PublicLeadershipProfile[]>([]);

  useEffect(() => {
    let isMounted = true;
    api
      .getLeadership()
      .then((data) => {
        if (isMounted && data) {
          const active = data
            .filter((m) => m.isActive !== false && m.active !== false)
            .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
          setLeadershipProfiles(active);
        }
      })
      .catch((err) => console.warn('Could not load leadership in about section:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section id="about" className="py-16 sm:py-24 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            About RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Founded with the noble mission of delivering transformative, values-centered, and disciplined education in Sheohar, Bihar.
          </p>

          {/* Sub Navigation Tabs */}
          <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs mt-4">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              School Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vision')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'vision'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vision & Mission
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leadership')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'leadership'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Leadership Messages
            </button>
          </div>
        </div>

        {/* Tab 1: School Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in duration-200">
            <div className="lg:col-span-7 space-y-5">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                A Beacon of Academic Distinction & Character Building in Sheohar
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {schoolIdentity(api.getSettings()).name} is a co-educational residential school
                {schoolIdentity(api.getSettings()).address ? `, located at ${schoolIdentity(api.getSettings()).address}` : ''}. Our campus provides a safe and caring place to learn for boys and girls.
              </p>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Our pedagogical approach blends rigorous CBSE syllabi, hands-on scientific experimentation, computerized education, spoken English mastery, and cultural grounding. As a residential school, we ensure continuous mentoring, structured evening prep sessions, and wholesome organic nutrition.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Expert Faculty</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      50+ highly qualified, caring mentors dedicated to individual attention.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Residential Care</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Secure hostels, supervised study hours, and balanced dietary meals.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-800 flex items-center justify-center shrink-0">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Holistic Growth</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Sports, music, debate, robotics, and leadership development programs.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-white p-2">
                {!imageError ? (
                  <img loading="lazy" decoding="async"
                    src="https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=800&auto=format&fit=crop&q=80"
                    alt="School Campus"
                    className="rounded-xl w-full h-80 object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="rounded-xl w-full h-80 bg-gradient-to-br from-[#051437] via-[#0B1F4B] to-[#123B8C] flex flex-col items-center justify-center p-6 text-white text-center">
                    <Building2 className="w-12 h-12 text-[#F3D27A] mb-3" />
                    <h4 className="text-base font-bold text-white uppercase tracking-wider">Campus & Infrastructure</h4>
                    <p className="text-xs text-slate-200 mt-1 max-w-xs">
                      {schoolIdentity(api.getSettings()).address}
                    </p>
                  </div>
                )}
                <div className="p-4 bg-slate-900 text-white rounded-b-xl mt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
                    <span>RESIDENTIAL PDS PUBLIC SCHOOL</span>
                    <span className="font-mono">SHEOHAR, BIHAR</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Located near Shahpur Road on BRC Road, offering modern academic buildings, well-ventilated classrooms, lush campus grounds, and comprehensive residential blocks.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Vision & Mission */}
        {activeTab === 'vision' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-200">
            {/* Vision */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900">Our Vision</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                To be a premier center of educational excellence in Bihar that nurtures young minds into responsible, intellectually enlightened, and morally grounded leaders. We envision every child equipped with critical thinking, scientific curiosity, and a deep sense of social responsibility.
              </p>
              <ul className="space-y-2 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Nurturing academic excellence without commercial compromise</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Instilling Indian moral values, humility, and national pride</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Empowering students from rural and semi-urban regions to compete globally</span>
                </li>
              </ul>
            </div>

            {/* Mission */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900">Our Mission</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                To provide a stimulating learning environment through modern instructional techniques, dedicated residential mentorship, and state-of-the-art facilities that unlock the full intellectual, physical, and emotional potential of every student.
              </p>
              <ul className="space-y-2 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Strong foundation in STEM, languages, and analytical reasoning</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Zero-tolerance for indiscipline; fostering honesty and empathy</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Safe, supportive residential home away from home with 24x7 supervision</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 3: Leadership Messages */}
        {activeTab === 'leadership' && (
          <div id="leadership" className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {leadershipProfiles.slice(0, 2).map((prof) => {
                const photoSrc = mediaSrc(prof.photo, prof.photoUrl);
                return (
                  <div
                    key={prof.id}
                    className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                          {prof.designation}
                        </span>
                        <Quote className="w-6 h-6 text-slate-300 shrink-0" />
                      </div>

                      {prof.quote && (
                        <h4 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                          &quot;{prof.quote}&quot;
                        </h4>
                      )}

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic line-clamp-5">
                        &quot;{prof.message || prof.shortBio || prof.fullBio}&quot;
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border-2 border-blue-200 shrink-0 relative flex items-center justify-center">
                          {photoSrc ? (
                            <img loading="lazy" decoding="async"
                              src={photoSrc}
                              alt={prof.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="text-xs font-black text-blue-900">
                              {prof.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .substring(0, 2)
                                .toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-slate-900">{prof.name}</h5>
                          <p className="text-[11px] text-slate-500 font-medium">{prof.designation}</p>
                        </div>
                      </div>

                      <a
                        href={`/management/${prof.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          const target = document.getElementById('management-team');
                          if (target) {
                            target.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Profile</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}

              {leadershipProfiles.length === 0 && (
                <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
                  Leadership messages will display here once added in the management portal.
                </div>
              )}
            </div>

            <div className="text-center pt-2">
              <a
                href="#management-team"
                onClick={(e) => {
                  e.preventDefault();
                  const target = document.getElementById('management-team');
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-blue-700 hover:text-blue-900 transition-colors"
              >
                <span>View Full Management Team & Profile Cards</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
