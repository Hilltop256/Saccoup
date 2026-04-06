import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { IMAGES } from '@/lib/constants';
import * as ds from '@/lib/dataService';
import { supabase } from '@/lib/supabase';

interface MsgRow {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_photo?: string;
  message: string;
  created_at: string;
  is_own: boolean;
}

const ChatPage: React.FC = () => {
  const { user, selectedGroup } = useAppContext();
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!selectedGroup?.id) { setLoading(false); return; }
    try {
      const result = await ds.listMessages(selectedGroup.id, 100);
      if (result.success) {
        setMessages((result.messages || []).map((m: any) => ({
          id: m.id,
          sender_id: m.sender_id,
          sender_name: m.sender_name || 'Unknown',
          sender_photo: m.sender_photo,
          message: m.message,
          created_at: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          is_own: m.sender_id === user?.member_id,
        })));
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
    setLoading(false);
  }, [selectedGroup?.id, user?.member_id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Supabase Realtime subscription for live messages
  useEffect(() => {
    if (!selectedGroup?.id) return;

    const channel = supabase
      .channel(`messages:group_id=eq.${selectedGroup.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${selectedGroup.id}`,
        },
        (payload) => {
          const m = payload.new;
          if (m.sender_id === user?.member_id) return; // Already shown via optimistic update
          setMessages(prev => {
            // Deduplicate by ID
            if (prev.some(msg => msg.id === m.id)) return prev;
            return [...prev, {
              id: m.id,
              sender_id: m.sender_id,
              sender_name: m.sender_name || 'Unknown',
              sender_photo: m.sender_photo,
              message: m.message,
              created_at: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
              is_own: false,
            }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGroup?.id, user?.member_id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedGroup?.id || !user?.member_id || sending) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);

    // Optimistic update
    const optimisticMsg: MsgRow = {
      id: `temp-${Date.now()}`,
      sender_id: user.member_id,
      sender_name: user.full_name,
      sender_photo: user.photo_url || undefined,
      message: text,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      is_own: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      await ds.sendMessage(selectedGroup.id, user.member_id, text);
      // Reload to get server-assigned ID
      await loadMessages();
    } catch (e) {
      console.error('Send failed:', e);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setNewMessage(text);
    }
    setSending(false);
  };

  const getAvatar = (msg: MsgRow, idx: number) => {
    if (msg.is_own) return user?.photo_url || IMAGES.avatars[0];
    return msg.sender_photo || IMAGES.avatars[idx % IMAGES.avatars.length];
  };

  const todayLabel = new Date().toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (!selectedGroup) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Group Selected</h3>
        <p className="text-sm text-gray-500">Select a group to access its chat.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="bg-white rounded-t-xl border border-gray-100 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0066CC] to-[#00CC99] flex items-center justify-center text-white font-bold text-sm">
            {selectedGroup.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-gray-900">{selectedGroup.name}</h2>
            <p className="text-xs text-gray-500">{selectedGroup.members_count} member{selectedGroup.members_count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => window.open('https://chat.whatsapp.com/YOUR_GROUP_INVITE_CODE', '_blank')}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
          title="Join WhatsApp Group"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.173-.149.348-.397.522-.596.174-.199.232-.347.347-.521.114-.174.572-.397.861-.595.287-.198.478-.347.682-.521.149-.174.248-.298.341-.496.093-.198.496-.748.677-1.028.181-.28.322-.347.448-.347.124 0 .248.002.372.008.124.006.248.049.372.124.124.075.199.174.273.273.074.099.149.199.199.348.05.149.1.298.15.447.05.149.05.298-.024.447-.074.149-.149.273-.249.447-.1.174-.174.348-.248.521-.074.174-.149.348-.299.521-.149.174-.348.298-.596.447-.248.149-.596.323-.92.496-.324.174-.596.273-.92.348-.323.074-.596.124-.844.174-.249.05-.447.074-.596.099-.149.025-.298.074-.447.124zM12.53 22.05c-.074.124-.174.249-.298.348-.124.099-.273.174-.447.248-.174.074-.348.124-.596.149-.249.025-.521.025-.77-.025-.249-.05-.447-.174-.596-.348-.149-.174-.223-.423-.298-.596-.074-.174-.124-.348-.174-.521-.05-.174-.074-.423-.049-.596.025-.174.074-.398.149-.596.074-.199.174-.398.298-.596.124-.199.273-.398.447-.596.174-.199.398-.398.645-.596.248-.199.521-.423.843-.67.323-.249.596-.521.77-.843.174-.323.248-.67.248-1.073 0-.149-.025-.323-.074-.496-.05-.174-.124-.423-.249-.671-.124-.249-.249-.496-.398-.77-.149-.273-.298-.521-.447-.77-.149-.248-.323-.496-.52-.744-.199-.249-.423-.521-.678-.818-.255-.298-.545-.596-.87-.818-.323-.223-.72-.398-1.123-.521-.398-.124-.845-.174-1.247-.124-.398.05-.845.174-1.222.398-.374.223-.77.521-1.147.944-.374.423-.692.92-.92 1.547-.224.627-.273 1.322-.199 1.996.074.671.347 1.395.845 1.996.497.6 1.196 1.073 1.996 1.347.796.273 1.645.347 2.443.299.796-.05 1.595-.273 2.39-.596.796-.323 1.495-.77 2.043-1.347.549-.576.92-1.296 1.073-2.118.15-.82.124-1.696-.124-2.443-.025-.1-.074-.248-.124-.397l-.074-.199z"/>
          </svg>
          WhatsApp
        </button>
        <button
          onClick={loadMessages}
          className="p-2 text-gray-400 hover:text-[#0066CC] hover:bg-[#0066CC]/10 rounded-lg transition-colors"
          title="Refresh messages"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 border-x border-gray-100 px-4 py-6 space-y-4">
        <div className="text-center">
          <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100">{todayLabel}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="w-8 h-8 animate-spin text-[#0066CC]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1">Start the conversation with your group</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={msg.id} className={`flex gap-3 ${msg.is_own ? 'flex-row-reverse' : ''}`}>
              {!msg.is_own && (
                <img
                  src={getAvatar(msg, idx)}
                  alt={msg.sender_name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                  onError={(e) => { (e.target as HTMLImageElement).src = IMAGES.avatars[idx % IMAGES.avatars.length]; }}
                />
              )}
              <div className={`max-w-[70%] ${msg.is_own ? 'items-end' : ''}`}>
                {!msg.is_own && (
                  <p className="text-xs font-medium text-gray-600 mb-1">{msg.sender_name}</p>
                )}
                <div className={`px-4 py-2.5 rounded-2xl ${
                  msg.is_own
                    ? 'bg-[#0066CC] text-white rounded-br-md'
                    : 'bg-white text-gray-900 rounded-bl-md border border-gray-100 shadow-sm'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.message}</p>
                </div>
                <p className={`text-[10px] text-gray-400 mt-1 ${msg.is_own ? 'text-right' : ''}`}>
                  {msg.is_own ? 'You · ' : ''}{msg.created_at}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white rounded-b-xl border border-gray-100 shadow-sm px-4 py-3">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${selectedGroup.name}...`}
            className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-2.5 bg-[#0066CC] text-white rounded-xl hover:bg-[#004C99] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;
