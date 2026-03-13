"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { GoogleGenAI } from '@google/genai';
import { Image as ImageIcon, Loader2, Download, Key } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];

export default function ImageGeneratorPage() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (typeof window !== 'undefined' && window.aistudio) {
        const hasSelectedKey = await window.aistudio.hasSelectedApiKey();
        setHasKey(hasSelectedKey);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (typeof window !== 'undefined' && window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'images'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setImages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const handleGenerate = async () => {
    if (!prompt.trim() || !user) return;

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: "1K"
          }
        }
      });

      let imageUrl = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        await addDoc(collection(db, 'images'), {
          userId: user.uid,
          prompt,
          aspectRatio,
          imageUrl,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Error generating image:", error);
      if (error instanceof Error && error.message.includes("Requested entity was not found")) {
        setHasKey(false);
        alert("Your API key may be invalid or missing. Please select a valid paid Google Cloud project API key.");
      } else {
        alert("Failed to generate image. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#8E9299]">Please sign in to use the Image Generator.</p>
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center space-y-6">
        <div className="w-16 h-16 bg-[#232529] rounded-full flex items-center justify-center">
          <Key className="w-8 h-8 text-[#F59E0B]" />
        </div>
        <h2 className="text-2xl font-bold">API Key Required</h2>
        <p className="text-[#8E9299]">
          High-quality image generation requires a paid Google Cloud project API key.
          Please select your key to continue.
        </p>
        <button
          onClick={handleSelectKey}
          className="bg-[#F59E0B] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#d97706] transition-colors"
        >
          Select API Key
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <ImageIcon className="text-[#818cf8]" />
          Image Generator
        </h1>
        <p className="text-[#8E9299]">Create stunning visuals with gemini-3-pro-image-preview</p>
      </div>

      <div className="bg-[#0d0e12] border border-[#232529] rounded-xl p-6 mb-12">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-[#8E9299] mb-2">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A futuristic city with flying cars at sunset..."
              className="w-full bg-[#151619] border border-[#232529] rounded-lg p-4 text-white focus:outline-none focus:border-[#818cf8] resize-none h-32"
            />
          </div>
          <div className="w-full md:w-64 flex flex-col justify-between">
            <div>
              <label className="block text-sm font-medium text-[#8E9299] mb-2">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full bg-[#151619] border border-[#232529] rounded-lg p-3 text-white focus:outline-none focus:border-[#818cf8]"
              >
                {ASPECT_RATIOS.map(ratio => (
                  <option key={ratio} value={ratio}>{ratio}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full bg-[#818cf8] text-white py-3 rounded-lg font-medium hover:bg-[#6366f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
            >
              {isGenerating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
              ) : (
                <><ImageIcon className="w-5 h-5" /> Generate Image</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-6">Your Gallery</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((img) => (
            <div key={img.id} className="bg-[#0d0e12] border border-[#232529] rounded-xl overflow-hidden group">
              <div className="relative aspect-square bg-[#151619]">
                <img src={img.imageUrl} alt={img.prompt} className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <a href={img.imageUrl} download={`image-${img.id}.png`} className="bg-white/10 p-3 rounded-full hover:bg-white/20 backdrop-blur-sm transition-colors">
                    <Download className="text-white w-6 h-6" />
                  </a>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-[#8E9299] line-clamp-2 mb-2">{img.prompt}</p>
                <div className="flex items-center justify-between text-xs mono-text text-[#52525b]">
                  <span>{img.aspectRatio}</span>
                  <span>{new Date(img.createdAt?.toDate()).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
