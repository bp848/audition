"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { GoogleGenAI } from '@google/genai';
import { Send, Zap, Search, MapPin, Loader2 } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ReactMarkdown from 'react-markdown';

type ChatMode = 'fast' | 'search' | 'maps';

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('fast');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Create a new chat session if none exists
    const initChat = async () => {
      const chatRef = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: 'New Chat',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setChatId(chatRef.id);
    };

    if (!chatId) {
      initChat();
    } else {
      const q = query(
        collection(db, `chats/${chatId}/messages`),
        orderBy('createdAt', 'asc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
      return () => unsubscribe();
    }
  }, [user, chatId]);

  const handleSend = async () => {
    if (!input.trim() || !user || !chatId) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    try {
      // Save user message
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        userId: user.uid,
        chatId: chatId,
        role: 'user',
        content: userMessage,
        createdAt: serverTimestamp(),
      });

      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      let responseText = '';

      if (mode === 'fast') {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: userMessage,
        });
        responseText = response.text || '';
      } else if (mode === 'search') {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: userMessage,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        responseText = response.text || '';
        
        // Extract grounding chunks
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks && chunks.length > 0) {
          responseText += '\n\n**Sources:**\n';
          chunks.forEach((chunk: any) => {
            if (chunk.web?.uri) {
              responseText += `- [${chunk.web.title}](${chunk.web.uri})\n`;
            }
          });
        }
      } else if (mode === 'maps') {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: userMessage,
          config: {
            tools: [{ googleMaps: {} }],
          },
        });
        responseText = response.text || '';

        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks && chunks.length > 0) {
          responseText += '\n\n**Locations:**\n';
          chunks.forEach((chunk: any) => {
            if (chunk.maps?.uri) {
              responseText += `- [${chunk.maps.title || 'Map Link'}](${chunk.maps.uri})\n`;
            }
          });
        }
      }

      // Save model message
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        userId: user.uid,
        chatId: chatId,
        role: 'model',
        content: responseText,
        createdAt: serverTimestamp(),
      });

    } catch (error) {
      console.error("Error generating content:", error);
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        userId: user.uid,
        chatId: chatId,
        role: 'model',
        content: 'Sorry, an error occurred while processing your request.',
        createdAt: serverTimestamp(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#8E9299]">Please sign in to use the chat.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">AI Assistant</h1>
        <div className="flex bg-[#232529] rounded-lg p-1">
          <button
            onClick={() => setMode('fast')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'fast' ? 'bg-[#00FF9D] text-[#0d0e12]' : 'text-[#8E9299] hover:text-white'
            }`}
          >
            <Zap size={16} /> Fast
          </button>
          <button
            onClick={() => setMode('search')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'search' ? 'bg-[#3B82F6] text-white' : 'text-[#8E9299] hover:text-white'
            }`}
          >
            <Search size={16} /> Search
          </button>
          <button
            onClick={() => setMode('maps')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'maps' ? 'bg-[#F59E0B] text-white' : 'text-[#8E9299] hover:text-white'
            }`}
          >
            <MapPin size={16} /> Maps
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#0d0e12] border border-[#232529] rounded-xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                msg.role === 'user' 
                  ? 'bg-[#232529] text-white' 
                  : 'bg-[#151619] border border-[#232529] text-[#E4E3E0]'
              }`}>
                <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-[#0d0e12] prose-pre:border prose-pre:border-[#232529]">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#151619] border border-[#232529] rounded-2xl px-5 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#8E9299]" />
                <span className="text-sm text-[#8E9299]">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-[#232529] bg-[#151619]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={
                mode === 'fast' ? "Ask anything (Fast response)..." :
                mode === 'search' ? "Search the web..." :
                "Find places on the map..."
              }
              className="flex-1 bg-[#0d0e12] border border-[#232529] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00FF9D] transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-[#00FF9D] text-[#0d0e12] p-3 rounded-lg hover:bg-[#00cc7d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
