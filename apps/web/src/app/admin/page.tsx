'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth-context';
import { subDays } from 'date-fns';
import DashboardFiltersComponent from './components/DashboardFilters';
import DashboardStats from './components/DashboardStats';
import RevenueChart from './components/RevenueChart';
import TopSellingTable from './components/TopSellingTable';
import LeastSellingTable from './components/LeastSellingTable';
import {
  getAdminStatsOverview,
  getAdminTopSelling,
  getAdminLeastSelling,
} from '@/services/admin-api-client';
import type {
  AdminStatsOverview,
  AdminTopSellingItem,
  DashboardFilters,
} from '@/types/admin';

export default function AdminPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Filters state
  const [filters, setFilters] = useState<DashboardFilters>({
    startDate: subDays(new Date(), 30), // Default to last 30 days
    endDate: new Date(),
  });

  // Data states
  const [stats, setStats] = useState<AdminStatsOverview | null>(null);
  const [topSelling, setTopSelling] = useState<AdminTopSellingItem[]>([]);
  const [leastSelling, setLeastSelling] = useState<AdminTopSellingItem[]>([]);

  // Loading states
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingTopSelling, setIsLoadingTopSelling] = useState(false);
  const [isLoadingLeastSelling, setIsLoadingLeastSelling] = useState(false);

  // Error states
  const [statsError, setStatsError] = useState<string | null>(null);
  const [topSellingError, setTopSellingError] = useState<string | null>(null);
  const [leastSellingError, setLeastSellingError] = useState<string | null>(null);

  // Load data when authenticated and filters change
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const loadDashboardData = async () => {
        // Load stats
        setIsLoadingStats(true);
        setStatsError(null);
        try {
          const statsData = await getAdminStatsOverview(filters);
          setStats(statsData);
        } catch (error) {
          console.error('Failed to load stats:', error);
          setStatsError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          setIsLoadingStats(false);
        }

        // Load top selling
        setIsLoadingTopSelling(true);
        setTopSellingError(null);
        try {
          const topSellingData = await getAdminTopSelling(filters);
          setTopSelling(topSellingData.items);
        } catch (error) {
          console.error('Failed to load top selling:', error);
          setTopSellingError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          setIsLoadingTopSelling(false);
        }

        // Load least selling
        setIsLoadingLeastSelling(true);
        setLeastSellingError(null);
        try {
          const leastSellingData = await getAdminLeastSelling(filters);
          setLeastSelling(leastSellingData.items);
        } catch (error) {
          console.error('Failed to load least selling:', error);
          setLeastSellingError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          setIsLoadingLeastSelling(false);
        }
      };

      loadDashboardData();
    }
  }, [isAuthenticated, authLoading, filters]);

  const handleFiltersChange = (newFilters: DashboardFilters) => {
    setFilters(newFilters);
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Monitor your ticket sales performance</p>
      </div>

      {/* Filters */}
      <DashboardFiltersComponent
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Stats Cards */}
      <DashboardStats
        stats={stats}
        isLoading={isLoadingStats}
        error={statsError}
      />

      {/* Revenue Chart */}
      <RevenueChart
        data={stats?.revenueByDay || []}
        isLoading={isLoadingStats}
      />

      {/* Tables */}
      <div className="block">
        <TopSellingTable
          items={topSelling}
          isLoading={isLoadingTopSelling}
          error={topSellingError}
          title="Top Selling Tickets"
        />
        <LeastSellingTable
          items={leastSelling}
          isLoading={isLoadingLeastSelling}
          error={leastSellingError}
          title="Least Selling Tickets"
        />
      </div>
    </div>
  );
}