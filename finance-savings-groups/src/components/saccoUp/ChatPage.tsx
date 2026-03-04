import React, { useState, useRef, useEffect } from 'react';
import { MOCK_CHAT, IMAGES, type ChatMessage } from '@/lib/constants';

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'You',
      sender_avatar: IMAGES.avatars[0],
      message: newMessage.trim(),
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      is_own: true,
    };
    setMessages([...messages, msg]);
    setNewMessage('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="bg-white rounded-t-xl border border-gray-100 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0066CC] to-[#00CC99] flex items-center justify-center text-white font-bold text-sm">KW</div>
          <div>
            <h2 className="font-bold text-gray-900">Kampala Women Savings Club</h2>
            <p className="text-xs text-gray-500">8 members - 5 online</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-400 hover:text-[#0066CC] hover:bg-[#0066CC]/10 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          </button>
          <button className="p-2 text-gray-400 hover:text-[#0066CC] hover:bg-[#0066CC]/10 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" /></svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 border-x border-gray-100 px-4 py-6 space-y-4">
        <div className="text-center">
          <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100">Today, February 14, 2026</span>
        </div>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.is_own ? 'flex-row-reverse' : ''}`}>
            {!msg.is_own && <img src={msg.sender_avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1" />}
            <div className={`max-w-[70%] ${msg.is_own ? 'items-end' : ''}`}>
              {!msg.is_own && <p className="text-xs font-medium text-gray-600 mb-1">{msg.sender}</p>}
              <div className={`px-4 py-2.5 rounded-2xl ${msg.is_own ? 'bg-[#0066CC] text-white rounded-br-md' : 'bg-white text-gray-900 rounded-bl-md border border-gray-100'}`}>
                <p className="text-sm leading-relaxed">{msg.message}</p>
              </div>
              <p className={`text-[10px] text-gray-400 mt-1 ${msg.is_own ? 'text-right' : ''}`}>{msg.created_at}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white rounded-b-xl border border-gray-100 shadow-sm px-4 py-3">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-3">
          <button type="button" className="p-2 text-gray-400 hover:text-[#0066CC] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
          />
          <button type="submit" disabled={!newMessage.trim()} className="p-2.5 bg-[#0066CC] text-white rounded-xl hover:bg-[#004C99] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;
