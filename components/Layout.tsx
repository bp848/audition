"use client";

import React from 'react';
import { useAuth, AuthProvider } from '@/lib/AuthProvider';
import { Activity, MessageSquare, Image as ImageIcon, Mic, Zap, LogOut, LogIn } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function Sidebar() {
  const { user, signIn, logOut } = useAuth();
  const pathname = usePathname();

  const navItems = [
    { name: 'Audio Analysis', href: '/', icon: Activity },
    { name: 'Fast Chat & Search', href: '/chat', icon: Zap },
    { name: 'Voice AI', href: '/voice', icon: Mic },
    { name: 'Image Gen', href: '/image', icon: ImageIcon },
    { name: 'Transcribe', href: '/transcribe', icon: MessageSquare },
  ];

  return (
    <div className="w-64 bg-[#0d0e12] border-r border-[#232529] flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="text-[#00FF9D]" />
          AI Studio
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#232529] text-white'
                  : 'text-[#8E9299] hover:bg-[#151619] hover:text-white'
              }`}
            >
              <item.icon size={18} className={isActive ? 'text-[#00FF9D]' : ''} />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#232529]">
        {user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#232529]" />
              )}
              <div className="truncate">
                <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
                <p className="text-xs text-[#8E9299] truncate">{user.email}</p>
              </div>
            </div>
            <button onClick={logOut} className="p-2 text-[#8E9299] hover:text-white transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#00FF9D] text-[#0d0e12] rounded-lg font-medium hover:bg-[#00cc7d] transition-colors"
          >
            <LogIn size={16} />
            Sign In
          </button>
        )}
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-[#151619] text-white font-sans">
        <Sidebar />
        <main className="flex-1 ml-64 overflow-y-auto">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
