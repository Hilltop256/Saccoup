import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import * as ds from '@/lib/dataService';

interface AnnouncementRow {
  id: string; title: string; content: string; author: string;
  is_pinned: boolean; created_at: string;
}

const AnnouncementsPage: React.FC = () => {
  const { user, selectedGroup } = useAppContext();
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', is_pinned: false });

  const loadAnnouncements = useCallback(async () => {
    if (!selectedGroup?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await ds.listAnnouncements(selectedGroup.id);
      if (result.success) {
        setAnnouncements((result.announcements || []).map((a: any) => ({
          id: a.id, title: a.title, content: a.content,
          author: a.author || 'Admin', is_pinned: a.is_pinned || false,
          created_at: a.created_at?.split('T')[0] || '',
        })));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedGroup?.id]);

  useEffect(() => { loadAnnouncements(); }, [loadAnnouncements]);

  const handleCreate = async () => {
    if (!newAnnouncement.title || !newAnnouncement.content || !selectedGroup?.id) return;
    setIsCreating(true);
    try {
      const result = await ds.createAnnouncement({
        group_id: selectedGroup.id,
        author_id: user?.member_id,
        author_name: user?.full_name || 'Admin',
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        is_pinned: newAnnouncement.is_pinned,
      });
      if (result.success) {
        setSuccess('Announcement published!');
        setNewAnnouncement({ title: '', content: '', is_pinned: false });
        setShowCreateModal(false);
        await loadAnnouncements();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (e: any) { console.error(e); }
    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await ds.deleteAnnouncement(id);
      await loadAnnouncements();
    } catch (e) { console.error(e); }
  };

  const pinned = announcements.filter(a => a.is_pinned);
  const regular = announcements.filter(a => !a.is_pinned);

  if (!selectedGroup) {
    return <div className="bg-white rounded-xl border p-12 text-center"><h3 className="text-lg font-bold text-gray-900 mb-2">No Group Selected</h3></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Announcements</h1><p className="text-sm text-gray-500">Keep your group informed with important updates</p></div>
        <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
          New Announcement
        </button>
      </div>

      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center"><svg className="w-8 h-8 animate-spin text-[#0066CC] mx-auto mb-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : announcements.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center"><p className="text-sm text-gray-500">No announcements yet. Create your first one!</p></div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#0066CC]" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" /></svg>
                Pinned
              </h2>
              <div className="space-y-4">
                {pinned.map(a => (
                  <div key={a.id} className="bg-[#0066CC]/5 border border-[#0066CC]/20 rounded-xl p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">{a.title}</h3>
                        <p className="mt-2 text-sm text-gray-600 leading-relaxed">{a.content}</p>
                        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500"><span>{a.author}</span><span>{a.created_at}</span></div>
                      </div>
                      <button onClick={() => handleDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-4">
            {regular.map(a => (
              <div key={a.id} className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{a.title}</h3>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{a.content}</p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-500"><span>{a.author}</span><span>{a.created_at}</span></div>
                  </div>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">New Announcement</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Title *</label><input type="text" value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg" placeholder="Announcement title" /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Content *</label><textarea value={newAnnouncement.content} onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-none" rows={4} placeholder="Write your announcement..." /></div>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newAnnouncement.is_pinned} onChange={(e) => setNewAnnouncement({...newAnnouncement, is_pinned: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-[#0066CC]" /><span className="text-sm text-gray-700">Pin this announcement</span></label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleCreate} disabled={isCreating || !newAnnouncement.title || !newAnnouncement.content} className="flex-1 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] disabled:opacity-50">
                {isCreating ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPage;
