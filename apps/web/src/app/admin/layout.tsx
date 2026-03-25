'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth-context';

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Admin Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container-app">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/admin" className="text-white font-bold text-xl">
                Tickets to Future Admin
              </Link>
            <nav className="hidden md:flex space-x-6">
              <Link
                href="/admin"
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/ticket-types"
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Ticket Types
              </Link>
              <Link
                href="/admin/ticket-events"
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Ticket Events
              </Link>
              <Link
                href="/admin/orders"
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Orders
              </Link>
            </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300 text-sm">
                {user?.email}
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-app py-8">
        {children}
      </main>
    </div>
  );
}