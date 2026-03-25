'use client';

import type { AdminStatsOverview } from '@/types/admin';

type DashboardStatsProps = {
  stats: AdminStatsOverview | null;
  isLoading: boolean;
  error: string | null;
};

export default function DashboardStats({
  stats,
  isLoading,
  error,
}: DashboardStatsProps) {
  if (error) {
    return (
      <div className="bg-red-900 border border-red-700 rounded-lg p-4">
        <p className="text-red-300">Error loading statistics: {error}</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'CZK',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Revenue */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">Total Revenue</p>
            {isLoading ? (
              <div className="h-8 bg-gray-700 rounded animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-bold text-white mt-1">
                {stats ? formatCurrency(stats.totalRevenue) : formatCurrency(0)}
              </p>
            )}
          </div>
          <div className="h-12 w-12 bg-green-600 rounded-lg flex items-center justify-center">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Order Count */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">Order Count</p>
            {isLoading ? (
              <div className="h-8 bg-gray-700 rounded animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-bold text-white mt-1">
                {stats ? formatNumber(stats.orderCount) : '0'}
              </p>
            )}
          </div>
          <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Average Order Value */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">Average Order Value</p>
            {isLoading ? (
              <div className="h-8 bg-gray-700 rounded animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-bold text-white mt-1">
                {stats ? formatCurrency(stats.avgOrderValue) : formatCurrency(0)}
              </p>
            )}
          </div>
          <div className="h-12 w-12 bg-purple-600 rounded-lg flex items-center justify-center">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Tickets Sold */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">Tickets Sold</p>
            {isLoading ? (
              <div className="h-8 bg-gray-700 rounded animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-bold text-white mt-1">
                {stats ? formatNumber(stats.ticketsSold) : '0'}
              </p>
            )}
          </div>
          <div className="h-12 w-12 bg-orange-600 rounded-lg flex items-center justify-center">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}