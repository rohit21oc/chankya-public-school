import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Notice, UserRole, SchoolSettings } from '../../types';
import { api } from '../../services/api';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { NoticesTab } from './communication/NoticesTab';
import { NoticeComposerModal } from './communication/NoticeComposerModal';
import { ParentEventsPanel } from '../parent/ParentEventsPanel';
import { canPublishNotices } from '../../utils/communicationAccess';

interface CommunicationViewProps {
  userRole: UserRole;
  settings?: SchoolSettings;
}

/**
 * Notices. Admins and teachers can publish; everyone sees the notices meant for them.
 * (The separate SMS sending / SMS history screens were removed at the school's request.)
 */
export const CommunicationView: React.FC<CommunicationViewProps> = ({ userRole }) => {
  const [notices, setNotices] = useState<Notice[]>(() => api.getNotices());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNoticeComposerOpen, setIsNoticeComposerOpen] = useState(false);

  const mayPublish = canPublishNotices(userRole);

  const refreshData = async () => {
    try {
      const updated = await api.syncNotices();
      setNotices([...updated]);
      setLoadError(null);
    } catch {
      setLoadError('Notices could not be loaded. Showing the last saved list.');
    } finally {
      setLoaded(true);
    }
  };

  useRealtimeListener(['NOTICE', 'SESSION'], () => {
    refreshData();
  });

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Notices <span className="ml-1 text-sm font-medium text-slate-500 tabular-nums">{notices.length}</span></h2>
        {mayPublish && (
          <button
            onClick={() => setIsNoticeComposerOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New notice
          </button>
        )}
      </div>

      {loadError && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{loadError}</p>}

      <NoticesTab userRole={userRole} notices={notices} loaded={loaded} onRefresh={refreshData} onOpenComposer={() => setIsNoticeComposerOpen(true)} />
      {userRole === 'PARENT' && (
        <div className="mt-5">
          <ParentEventsPanel />
        </div>
      )}

      {isNoticeComposerOpen && (
        <NoticeComposerModal
          onClose={() => setIsNoticeComposerOpen(false)}
          onSaved={() => {
            setIsNoticeComposerOpen(false);
            refreshData();
          }}
        />
      )}
    </div>
  );
};
