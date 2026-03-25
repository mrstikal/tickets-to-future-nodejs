'use client';

import { useState, FormEvent, useEffect } from 'react';
import Modal from './Modal';
import { useAuth } from '@/features/auth-context';

type AuthMode = 'signin' | 'signup';

interface AuthModalsProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}

export default function AuthModals({ isOpen, onClose, initialMode = 'signin' }: AuthModalsProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login, signUp, isLoading: authLoading, isAuthenticated } = useAuth();

  // Reset mode when modal opens or initialMode changes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      // Also reset form fields
      setEmail('');
      setPassword('');
      setName('');
      setError(null);
    }
  }, [isOpen, initialMode]);

  // Close modal when authentication succeeds
  useEffect(() => {
    if (isAuthenticated && isOpen) {
      onClose();
    }
  }, [isAuthenticated, isOpen, onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        await login({ email, password });
      } else {
        await signUp({ email, password, name });
      }
      // Reset form
      setEmail('');
      setPassword('');
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
  };

  const isLoading = isSubmitting || authLoading;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </h2>
          <p className="text-gray-400">
            {mode === 'signin'
              ? 'Sign in to your account to get 10% discount on all tickets.'
              : 'Create a new account to get 10% discount on all tickets.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                required={mode === 'signup'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Your full name"
                disabled={isLoading}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>

          <div className="text-sm text-gray-400 italic">
            {mode === 'signup' 
              ? 'This is a demo application. Use any valid email (e.g. user@example.com), any password (min. 6 characters) and any name.' 
              : 'This is a demo application. Use the email and password you registered with.'}
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-md text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold rounded-md transition-colors"
          >
            {isLoading
              ? 'Processing...'
              : mode === 'signin'
                ? 'Sign In'
                : 'Sign Up'}
          </button>
        </form>

        <div className="text-center text-gray-400">
          <button
            type="button"
            onClick={switchMode}
            className="text-blue-400 hover:text-blue-300 underline"
            disabled={isLoading}
          >
            {mode === 'signin'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </Modal>
  );
}