import React, { useState, useRef, useEffect, useContext } from 'react';
import Markdown from 'react-markdown';
import { Send, Bot, User as UserIcon, Loader2, Trash2, History, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Meal, MealType } from '../types';
import { AuthContext } from '../App';

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  suggestedMeals?: Meal[];
  assignmentState?: 'pending' | 'assigned' | 'dismissed';
  selectedSuggestedMealIndex?: number;
}

interface ChatHistoryItem {
  id: string;
  query: string;
  response: string;
  timestamp: string;
}

interface StoredMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
  suggestedMeals?: Meal[];
  assignmentState?: 'pending' | 'assigned' | 'dismissed';
  selectedSuggestedMealIndex?: number;
}

interface NutritionChatbotPageProps {
  onAssignMeal: (meal: Meal) => Promise<void>;
}

const API_BASE = '/api';
const HISTORY_LIMIT = 10;

const normalizeSuggestedMeal = (raw: any): Meal | null => {
  const normalizedMealType = String(raw?.mealType || '').toLowerCase();
  const mealType =
    normalizedMealType === 'breakfast'
      ? MealType.BREAKFAST
      : normalizedMealType === 'dinner'
        ? MealType.DINNER
        : MealType.LUNCH;

  if (!raw?.id || !raw?.mealName) {
    return null;
  }

  return {
    id: String(raw.id),
    mealName: String(raw.mealName),
    mealType,
    calories: Number(raw?.calories || 0),
    protein: Number(raw?.protein || 0),
    imageUrl: String(raw?.imageUrl || ''),
    dietTag: String(raw?.dietTag || 'Vegetarian'),
  };
};

const NutritionChatbotPage: React.FC<NutritionChatbotPageProps> = ({ onAssignMeal }) => {
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [assigningMealId, setAssigningMealId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('nutriplan_token') || '';
  const storageUserKey = user?.id || 'anonymous';
  const chatStorageKey = `nutriplan_chat_messages_${storageUserKey}`;
  const draftStorageKey = `nutriplan_chat_draft_${storageUserKey}`;
  const historyStorageKey = `nutriplan_chat_history_${storageUserKey}`;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (!chatStorageKey) return;
    try {
      const raw = localStorage.getItem(chatStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setMessages(
          parsed
            .filter(
              (item): item is StoredMessage =>
                Boolean(item) &&
                (item.role === 'user' || item.role === 'bot') &&
                typeof item.content === 'string' &&
                typeof item.timestamp === 'string'
            )
            .map((item) => ({
              id: typeof item.id === 'string' ? item.id : `${item.role}-${item.timestamp}`,
              role: item.role,
              content: item.content,
              timestamp: new Date(item.timestamp),
              suggestedMeals: Array.isArray(item.suggestedMeals)
                ? item.suggestedMeals.map(normalizeSuggestedMeal).filter((meal): meal is Meal => Boolean(meal))
                : undefined,
              assignmentState:
                item.assignmentState === 'assigned' || item.assignmentState === 'dismissed'
                  ? item.assignmentState
                  : 'pending',
              selectedSuggestedMealIndex:
                typeof item.selectedSuggestedMealIndex === 'number' ? item.selectedSuggestedMealIndex : 0,
            }))
        );
      }
    } catch {
      setMessages([]);
    }
  }, [chatStorageKey]);

  useEffect(() => {
    if (!draftStorageKey) return;
    const storedDraft = localStorage.getItem(draftStorageKey);
    if (storedDraft !== null) {
      setInput(storedDraft);
    }
  }, [draftStorageKey]);

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
    if (!chatStorageKey) return;
    localStorage.setItem(
      chatStorageKey,
      JSON.stringify(
        messages.map((message) => ({
          role: message.role,
          id: message.id,
          content: message.content,
          timestamp: message.timestamp.toISOString(),
          suggestedMeals: message.suggestedMeals,
          assignmentState: message.assignmentState,
          selectedSuggestedMealIndex: message.selectedSuggestedMealIndex,
        }))
      )
    );
  }, [messages, chatStorageKey]);

  useEffect(() => {
    if (!draftStorageKey) return;
    localStorage.setItem(draftStorageKey, input);
  }, [input, draftStorageKey]);

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
    const nextItems = items.slice(0, HISTORY_LIMIT);
    setHistory(nextItems);
    if (!historyStorageKey) return;
    localStorage.setItem(historyStorageKey, JSON.stringify(nextItems));
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
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
      const suggestedMeals = Array.isArray(payload?.suggestedMeals)
        ? payload.suggestedMeals
            .map(normalizeSuggestedMeal)
            .filter((meal): meal is Meal => Boolean(meal))
        : [];

      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        content: botReply,
        timestamp: new Date(),
        suggestedMeals: suggestedMeals.length ? suggestedMeals : undefined,
        assignmentState: suggestedMeals.length ? 'pending' : undefined,
        selectedSuggestedMealIndex: 0,
      };

      setMessages((prev) => [...prev, botMessage]);

      if (response.ok && payload?.reply) {
        const newHistoryItem: ChatHistoryItem = {
          id: `${Date.now()}`,
          query: trimmed,
          response: String(payload.reply),
          timestamp: new Date().toISOString(),
        };
        persistHistory([newHistoryItem, ...history]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-error-${Date.now()}`,
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
    setInput('');
    if (chatStorageKey) {
      localStorage.removeItem(chatStorageKey);
    }
    if (draftStorageKey) {
      localStorage.removeItem(draftStorageKey);
    }
  };

  const updateMessageAssignmentState = (messageId: string, assignmentState: 'pending' | 'assigned' | 'dismissed') => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? { ...message, assignmentState }
          : message
      )
    );
  };

  const updateSelectedSuggestedMeal = (messageId: string, selectedSuggestedMealIndex: number) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? { ...message, selectedSuggestedMealIndex, assignmentState: 'pending' }
          : message
      )
    );
  };

  const handleAssignMeal = async (messageId: string, meal: Meal) => {
    try {
      setAssigningMealId(meal.id);
      await onAssignMeal(meal);
      updateMessageAssignmentState(messageId, 'assigned');
    } finally {
      setAssigningMealId(null);
    }
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
        <div ref={historyMenuRef} className="relative flex items-center gap-2">
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
          {showHistoryMenu && (
            <div className="absolute right-0 top-[56px] z-20 w-[min(92vw,420px)] bg-white border border-emerald-100 rounded-2xl shadow-xl p-4">
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
                          { id: `history-user-${item.id}`, role: 'user', content: item.query, timestamp: new Date(item.timestamp) },
                          { id: `history-bot-${item.id}`, role: 'bot', content: item.response, timestamp: new Date(item.timestamp) },
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
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-emerald-50/30">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
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
                  {msg.role === 'bot' && msg.suggestedMeals && msg.suggestedMeals.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {msg.assignmentState !== 'dismissed' && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                          {msg.suggestedMeals.length > 1 && (
                            <div className="mb-3 flex items-center gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pick one</span>
                              {msg.suggestedMeals.map((_, index) => (
                                <button
                                  key={`${msg.id}-pick-${index}`}
                                  type="button"
                                  onClick={() => updateSelectedSuggestedMeal(msg.id, index)}
                                  className={`h-8 min-w-8 rounded-full px-3 text-sm font-bold transition-colors ${
                                    (msg.selectedSuggestedMealIndex ?? 0) === index
                                      ? 'bg-emerald-600 text-white'
                                      : 'border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                >
                                  {index + 1}
                                </button>
                              ))}
                            </div>
                          )}
                          <p className="text-sm font-medium text-emerald-900">
                            Assign {msg.suggestedMeals[msg.selectedSuggestedMealIndex ?? 0].mealName} to {msg.suggestedMeals[msg.selectedSuggestedMealIndex ?? 0].mealType.toLowerCase()} in Meal Planner?
                          </p>
                          {msg.assignmentState === 'assigned' ? (
                            <p className="mt-2 text-xs font-semibold text-emerald-700">
                              Added to your meal planner.
                            </p>
                          ) : (
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleAssignMeal(msg.id, msg.suggestedMeals![msg.selectedSuggestedMealIndex ?? 0])}
                                disabled={assigningMealId === msg.suggestedMeals[msg.selectedSuggestedMealIndex ?? 0].id}
                                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {assigningMealId === msg.suggestedMeals[msg.selectedSuggestedMealIndex ?? 0].id ? 'Assigning...' : 'Yes'}
                              </button>
                              <button
                                type="button"
                                onClick={() => updateMessageAssignmentState(msg.id, 'dismissed')}
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                              >
                                No
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
