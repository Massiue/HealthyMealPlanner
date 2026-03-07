import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { Send, Bot, User as UserIcon, Loader2, Trash2, History, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface ChatHistoryItem {
  id: string;
  query: string;
  response: string;
  timestamp: string;
}

const API_BASE = '/api';
const HISTORY_LIMIT = 10;

const QUICK_QUESTIONS = [
  'What should I eat for breakfast?',
  'Suggest a high-protein meal.',
  'How many calories should I eat daily?',
];

const NutritionChatbotPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('nutriplan_token') || '';
  const historyStorageKey = token ? `nutriplan_chat_history_${token.slice(-12)}` : '';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (!historyStorageKey) return;
    try {
      const raw = localStorage.getItem(historyStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setHistory(parsed.slice(0, HISTORY_LIMIT));
      }
    } catch {
      setHistory([]);
    }
  }, [historyStorageKey]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!showHistoryMenu) return;
      const target = event.target as Node;
      if (historyMenuRef.current && !historyMenuRef.current.contains(target)) {
        setShowHistoryMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showHistoryMenu]);

  const persistHistory = (items: ChatHistoryItem[]) => {
    setHistory(items);
    if (!historyStorageKey) return;
    localStorage.setItem(historyStorageKey, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chatbot/nutrition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: trimmed }),
      });

      const payload = await response.json();
      const botReply =
        response.ok && payload?.reply
          ? String(payload.reply)
          : String(payload?.error || "I'm sorry, I couldn't process that request.");

      const botMessage: Message = {
        role: 'bot',
        content: botReply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);

      if (response.ok && payload?.reply) {
        const newHistoryItem: ChatHistoryItem = {
          id: `${Date.now()}`,
          query: trimmed,
          response: String(payload.reply),
          timestamp: new Date().toISOString(),
        };
        persistHistory([newHistoryItem, ...history].slice(0, HISTORY_LIMIT));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: 'Sorry, I encountered an error. Please try again later.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-180px)] max-w-4xl mx-auto bg-white rounded-3xl shadow-xl shadow-emerald-900/5 overflow-hidden border border-emerald-100">
      <div className="bg-emerald-600 p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white backdrop-blur-md">
            <Bot size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">AI Nutrition Chatbot</h1>
            <p className="text-emerald-100 text-sm">Personalized health and diet assistant</p>
          </div>
        </div>
        <div ref={historyMenuRef} className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="p-2 text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Clear Chat"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={() => setShowHistoryMenu((prev) => !prev)}
            className="p-2 text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Recent History"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {showHistoryMenu && (
        <div className="absolute right-4 top-[88px] z-20 w-[min(92vw,420px)] bg-white border border-emerald-100 rounded-2xl shadow-xl p-4">
          <h2 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
            <History size={14} className="text-emerald-600" />
            Recent History
          </h2>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500">No recent history yet.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left bg-emerald-50/50 hover:bg-emerald-100/60 border border-emerald-100 p-3 rounded-xl transition-colors"
                  onClick={() => {
                    setMessages((prev) => [
                      ...prev,
                      { role: 'user', content: item.query, timestamp: new Date(item.timestamp) },
                      { role: 'bot', content: item.response, timestamp: new Date(item.timestamp) },
                    ]);
                    setShowHistoryMenu(false);
                  }}
                >
                  <p className="text-xs font-semibold text-emerald-700 line-clamp-1">{item.query}</p>
                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">{item.response}</p>
                </button>
              ))}
            </div>
          )}
          {history.length > 0 && (
            <button
              onClick={() => persistHistory([])}
              className="mt-3 text-[11px] text-emerald-600 hover:text-emerald-700 font-medium underline"
            >
              Clear all history
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-emerald-50/30">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="bg-white border border-emerald-100 rounded-2xl p-4 md:p-5">
              <h3 className="text-xs md:text-sm font-semibold text-emerald-800 mb-3">Try asking</h3>
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => setInput(question)}
                    className="text-xs md:text-sm px-3 py-2 rounded-full border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <motion.div
              key={`${msg.role}-${index}-${msg.timestamp.getTime()}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-emerald-600 border border-emerald-100 shadow-sm'
                }`}>
                  {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-4 rounded-2xl shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-emerald-50 rounded-tl-none'
                }`}>
                  <div className="prose prose-sm max-w-none prose-emerald">
                    <div className={msg.role === 'user' ? 'text-white' : 'text-slate-800'}>
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  </div>
                  <div className={`text-[10px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="flex gap-3 items-center bg-white p-4 rounded-2xl border border-emerald-50 shadow-sm">
              <Loader2 className="animate-spin text-emerald-600" size={18} />
              <span className="text-sm text-slate-500 font-medium italic">Assistant is thinking...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="sticky bottom-0 z-10 p-6 bg-white border-t border-emerald-50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about meals, protein, calories, recipes..."
            className="flex-1 bg-emerald-50/50 border border-emerald-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 placeholder:text-slate-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-emerald-600 text-white p-4 rounded-2xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
          >
            <Send size={24} />
          </button>
        </form>
        <p className="text-center text-[11px] text-slate-400 mt-4">
          AI-generated advice should be verified with a professional.
        </p>
      </div>
    </div>
  );
};

export default NutritionChatbotPage;
