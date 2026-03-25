'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { getHolds } from '@/services/tickets-service';
import { useSessionWebsocket } from '@/hooks/use-session-websocket';
import { getOrCreateSessionId } from '@/lib/session';
import type { WebsocketEvent } from '@/types/tickets';
import { ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/features/auth-context';
import AuthModals from './AuthModals';

export default function Header(): React.JSX.Element {
  const [count, setCount] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');

  const sessionIdRef = useRef<string | null>(null);
  const { user, isAuthenticated, discount, logout } = useAuth();

  const fetchHolds = useCallback(async (id: string) => {
    try {
      const holds = await getHolds(id);
      setCount(holds.length);
    } catch (error) {
      console.error('Failed to fetch holds:', error);
      setCount(0);
    }
  }, []);

  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);
    sessionIdRef.current = id;
    fetchHolds(id);
  }, [fetchHolds]);

  // Keep ref in sync
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const handleHoldUpdate = useCallback((event: WebsocketEvent) => {
    if (event.type === 'hold.updated' && sessionIdRef.current) {
      fetchHolds(sessionIdRef.current);
    }
  }, [fetchHolds]);

  useSessionWebsocket({
    onEvent: handleHoldUpdate,
  });

  const openAuthModal = (mode: 'signin' | 'signup') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 bg-slate-900 p-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-white">
          Tickets to Future
        </Link>

        <div className="flex items-center gap-4">
          {!isAuthenticated ? (
            <div className="flex gap-3">
              <button
                onClick={() => openAuthModal('signin')}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-white">
                  {user?.name || user?.email}
                </span>
                {discount > 0 && (
                  <span className="px-2 py-1 bg-green-700 text-white text-xs font-bold rounded-full">
                    -{discount}%
                  </span>
                )}
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              >
                Logout
              </button>
            </div>
          )}

          <div className="relative">
            <Link href="/cart" className="text-white">
              <ShoppingCartIcon className="w-6 h-6" />
            </Link>
            {count > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {count}
              </span>
            )}
          </div>
        </div>
      </header>

      <AuthModals
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
      />
    </>
  );
}