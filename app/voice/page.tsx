"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Activity, Loader2 } from 'lucide-react';

export default function VoicePage() {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  const [transcript, setTranscript] = useState<string[]>([]);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startSession = async () => {
    if (!user) return;
    try {
      setStatus('Connecting...');
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: async () => {
            setStatus('Connected. Listening...');
            setIsRecording(true);
            
            // Setup Audio Capture
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
            
            source.connect(processorRef.current);
            processorRef.current.connect(audioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const binaryString = atob(base64Audio);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // Decode PCM16 to Float32
              const pcm16 = new Int16Array(bytes.buffer);
              const float32 = new Float32Array(pcm16.length);
              for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768.0;
              }
              
              const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
              audioBuffer.getChannelData(0).set(float32);
              
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current.destination);
              source.start();
            }
            
            // Handle transcription
            if (message.serverContent?.modelTurn?.parts[0]?.text) {
              setTranscript(prev => [...prev, `AI: ${message.serverContent?.modelTurn?.parts[0]?.text}`]);
            }
          },
          onclose: () => {
            setStatus('Disconnected');
            setIsRecording(false);
            stopAudio();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setStatus('Error occurred');
            setIsRecording(false);
            stopAudio();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are a helpful voice assistant.",
        },
      });
      
      sessionRef.current = await sessionPromise;
    } catch (error) {
      console.error("Failed to start session:", error);
      setStatus('Failed to connect');
      setIsRecording(false);
    }
  };

  const stopAudio = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    stopAudio();
    setIsRecording(false);
    setStatus('Disconnected');
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#8E9299]">Please sign in to use Voice AI.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto h-screen flex flex-col">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-3">
          <Activity className="text-[#00FF9D]" />
          Conversational Voice AI
        </h1>
        <p className="text-[#8E9299]">Powered by Gemini 2.5 Native Audio (Live API)</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className={`relative w-48 h-48 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${
          isRecording ? 'bg-[#00FF9D]/20 shadow-[0_0_50px_rgba(0,255,157,0.3)]' : 'bg-[#232529] hover:bg-[#2a2d33]'
        }`}
        onClick={isRecording ? stopSession : startSession}
        >
          {isRecording && (
            <div className="absolute inset-0 rounded-full border-2 border-[#00FF9D] animate-ping opacity-20" />
          )}
          <div className={`w-32 h-32 rounded-full flex items-center justify-center ${
            isRecording ? 'bg-[#00FF9D] text-[#0d0e12]' : 'bg-[#151619] text-[#8E9299]'
          }`}>
            {isRecording ? <Mic size={48} /> : <MicOff size={48} />}
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-xl font-medium text-white mb-2">{status}</p>
          <p className="text-sm text-[#8E9299]">
            {isRecording ? 'Tap to stop conversation' : 'Tap to start conversation'}
          </p>
        </div>
      </div>

      {transcript.length > 0 && (
        <div className="mt-12 bg-[#0d0e12] border border-[#232529] rounded-xl p-6 h-64 overflow-y-auto">
          <h3 className="text-sm font-medium text-[#8E9299] mb-4 uppercase tracking-wider">Live Transcript</h3>
          <div className="space-y-2">
            {transcript.map((text, i) => (
              <p key={i} className="text-sm text-white">{text}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
