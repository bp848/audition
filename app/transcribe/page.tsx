"use client";

import React, { useState, useRef } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, Square, Play, Loader2, MessageSquare, Volume2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function TranscribePage() {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [ttsText, setTtsText] = useState('');
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64data,
                  mimeType: 'audio/webm',
                }
              },
              {
                text: 'Please transcribe this audio accurately.'
              }
            ]
          }
        });

        const text = response.text || '';
        setTranscript(text);

        // Save transcription
        if (text) {
          await addDoc(collection(db, 'transcriptions'), {
            userId: user.uid,
            text,
            createdAt: serverTimestamp(),
          });
        }
      };
    } catch (error) {
      console.error("Error transcribing audio:", error);
      alert("Failed to transcribe audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  const generateSpeech = async () => {
    if (!ttsText.trim() || !user) return;
    setIsGeneratingSpeech(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: ttsText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioUrl = `data:audio/wav;base64,${base64Audio}`;
        const audio = new Audio(audioUrl);
        audio.play();
      }
    } catch (error) {
      console.error("Error generating speech:", error);
      alert("Failed to generate speech.");
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#8E9299]">Please sign in to use Transcription & TTS.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <MessageSquare className="text-[#3B82F6]" />
          Transcribe & Generate Speech
        </h1>
        <p className="text-[#8E9299]">Convert speech to text and text to speech using Gemini Flash</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Transcription Section */}
        <div className="bg-[#0d0e12] border border-[#232529] rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Mic className="text-[#00FF9D]" /> Audio Transcription
          </h2>
          <p className="text-sm text-[#8E9299] mb-6">Record your voice to transcribe it into text.</p>
          
          <div className="flex justify-center mb-8">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                isRecording 
                  ? 'bg-red-500/20 text-red-500 animate-pulse border-2 border-red-500' 
                  : 'bg-[#151619] text-[#00FF9D] hover:bg-[#232529] border border-[#232529]'
              } disabled:opacity-50`}
            >
              {isRecording ? <Square size={32} fill="currentColor" /> : <Mic size={36} />}
            </button>
          </div>

          <div className="bg-[#151619] border border-[#232529] rounded-lg p-4 min-h-[150px]">
            {isProcessing ? (
              <div className="flex items-center justify-center h-full text-[#8E9299]">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Transcribing...
              </div>
            ) : transcript ? (
              <p className="text-white whitespace-pre-wrap">{transcript}</p>
            ) : (
              <p className="text-[#8E9299] text-center italic mt-12">Transcription will appear here</p>
            )}
          </div>
        </div>

        {/* Text-to-Speech Section */}
        <div className="bg-[#0d0e12] border border-[#232529] rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Volume2 className="text-[#818cf8]" /> Text to Speech
          </h2>
          <p className="text-sm text-[#8E9299] mb-6">Type text to generate lifelike speech.</p>
          
          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            className="w-full bg-[#151619] border border-[#232529] rounded-lg p-4 text-white focus:outline-none focus:border-[#818cf8] resize-none h-[200px] mb-4"
          />
          
          <button
            onClick={generateSpeech}
            disabled={isGeneratingSpeech || !ttsText.trim()}
            className="w-full bg-[#818cf8] text-white py-3 rounded-lg font-medium hover:bg-[#6366f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGeneratingSpeech ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Generating Speech...</>
            ) : (
              <><Play className="w-5 h-5" fill="currentColor" /> Generate & Play</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
