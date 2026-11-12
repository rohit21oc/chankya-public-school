import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Code2,
  Copy,
  Globe,
  Layers,
  Play,
  Send,
  Smartphone,
} from 'lucide-react';
import { api } from '../../services/api';

export const ApiDocsView: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'ENDPOINTS' | 'SCHEMA'>('ENDPOINTS');

  const endpoints = [
    {
      method: 'GET',
      path: '/api/v1/students',
      desc: 'Retrieve student directory with class, section, roll number & 8-digit admission number filters.',
      auth: 'Bearer JWT (Admin, Teacher, Staff)',
      sampleResponse: `[
  {
    "id": "st-1",
    "name": "Aarav Gupta",
    "rollNumber": "1",
    "admissionNumber": "20260401",
    "registrationNumber": "CPS2026100001",
    "className": "Class 10",
    "section": "A",
    "status": "ACTIVE"
  }
]`,
    },
    {
      method: 'POST',
      path: '/api/v1/students/admit',
      desc: 'Admit student and auto-issue 8-digit admission number and registration number.',
      auth: 'Bearer JWT (Admin)',
      sampleResponse: `{
  "success": true,
  "data": {
    "admissionNumber": "20260407",
    "registrationNumber": "CPS2026100007",
    "rollNumber": "7",
    "name": "Siddharth Verma"
  }
}`,
    },
    {
      method: 'GET',
      path: '/api/v1/timetable',
      desc: 'Fetch weekly timetable for mobile student & teacher daily schedules.',
      auth: 'Bearer JWT (All Users)',
      sampleResponse: `[
  {
    "dayOfWeek": "MONDAY",
    "periodNumber": 1,
    "startTime": "08:00 AM",
    "endTime": "08:45 AM",
    "subjectName": "Mathematics",
    "teacherName": "Rajesh Kumar",
    "roomNumber": "Room 204"
  }
]`,
    },
    {
      method: 'POST',
      path: '/api/v1/attendance',
      desc: 'Commit student daily attendance register with absentee SMS notification trigger.',
      auth: 'Bearer JWT (Teacher, Principal)',
      sampleResponse: `{
  "success": true,
  "committedCount": 28,
  "notifiedAbsentees": 2
}`,
    },
    {
      method: 'POST',
      path: '/api/v1/fees/collect',
      desc: 'Process fee collection, update ledger, and generate receipt number REC-2026-XXXX.',
      auth: 'Bearer JWT (Accountant, Admin)',
      sampleResponse: `{
  "receiptNumber": "REC-2026-0004",
  "amount": 18500,
  "paymentMethod": "ONLINE_UPI",
  "status": "SUCCESS"
}`,
    },
    {
      method: 'GET',
      path: '/api/v1/notices',
      desc: 'Fetch institutional circulars with targeted audience segmentation.',
      auth: 'Bearer JWT (All Users)',
      sampleResponse: `[
  {
    "id": "not-1",
    "title": "Mid-Term Examination 2026 Date Sheet",
    "targetAudience": "ALL",
    "isUrgent": true
  }
]`,
    },
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Mobile REST API & Swagger Documentation</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android & iOS Ready</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            API-first REST endpoints for the single-school central architecture. Fully compatible with native mobile apps.
          </p>
        </div>

        <div className="text-xs font-mono bg-slate-900 text-white px-3 py-1.5 rounded-lg">
          Base URL: <strong>https://your-school-domain.example/api/v1</strong>
        </div>
      </div>

      {/* Endpoints List */}
      <div className="space-y-4">
        {endpoints.map((ep, idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                    ep.method === 'GET'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {ep.method}
                </span>
                <span className="font-mono text-sm font-bold text-slate-900">{ep.path}</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">{ep.auth}</span>
            </div>

            <p className="text-xs text-slate-600">{ep.desc}</p>

            <div className="bg-slate-900 text-slate-200 rounded-lg p-3 text-xs font-mono relative overflow-x-auto">
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 mb-2 border-b border-slate-800">
                <span>Response Format (JSON)</span>
                <button
                  onClick={() => handleCopy(ep.sampleResponse, idx)}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-emerald-400 text-xs">{ep.sampleResponse}</pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
