'use client';

import { useState } from 'react';
import { useAuth } from '@/features/auth-context';
import AuthModals from './AuthModals';

export default function PromoBanner(): React.JSX.Element | null {
  const { isAuthenticated } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  if (isAuthenticated) {
    return null;
  }

  const openAuthModal = () => {
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  return (
    <>
      <div className="mb-8 p-5 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-700/50 rounded-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold text-white mb-1">
              Sign up or log in to get 10% discount on all tickets!
            </h3>
            <p className="text-blue-200">
              Create an account or sign in to unlock exclusive savings on every purchase.
            </p>
          </div>
          <button
            onClick={openAuthModal}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            Sign Up for Discount
          </button>
        </div>
      </div>

      <AuthModals
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        initialMode="signup"
      />
    </>
  );
}