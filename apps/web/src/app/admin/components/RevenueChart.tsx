'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';

type RevenueChartProps = {
  data: Array<{
    date: string;
    revenue: number;
  }>;
  isLoading: boolean;
};

type ChartDataPoint = {
  date: string;
  revenue: number;
  formattedDate: string;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateStr: string) => {
  return format(new Date(dateStr), 'dd.MM.', { locale: enUS });
};

import React from 'react';

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: ChartDataPoint;
    value: number;
  }>;
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const originalDateStr = payload[0].payload?.date;
    const date = originalDateStr ? new Date(originalDateStr) : null;
    const isValidDate = date && !isNaN(date.getTime());

    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
        <p className="text-gray-300 text-sm">
          {isValidDate
            ? format(date, 'dd. MM. yyyy', { locale: enUS })
            : 'Invalid date'
          }
        </p>
        <p className="text-white font-semibold">
          Revenue: {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export default function RevenueChart({ data, isLoading }: RevenueChartProps) {

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Revenue over time
        </h3>
        <div className="h-64 bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Revenue over time
        </h3>
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-400">No data to display</p>
        </div>
      </div>
    );
  }

  // Prepare data for chart
  const chartData = data.map((item) => ({
    ...item,
    formattedDate: formatDate(item.date),
  }));

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Revenue over time
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="formattedDate"
              stroke="#9CA3AF"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#9CA3AF"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCurrency}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#10B981"
              strokeWidth={2}
              dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2, fill: '#1F2937' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}