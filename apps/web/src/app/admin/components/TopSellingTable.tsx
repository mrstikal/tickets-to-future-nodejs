'use client';

import Image from 'next/image';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import type { AdminTopSellingItem } from '@/types/admin';

type TopSellingTableProps = {
  items: AdminTopSellingItem[];
  isLoading: boolean;
  error: string | null;
  title: string;
};

export default function TopSellingTable({
  items,
  isLoading,
  error,
  title,
}: TopSellingTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className="bg-red-900 border border-red-700 rounded-lg p-4">
          <p className="text-red-300">Error loading data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-700 rounded animate-pulse"></div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">No data to display</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 font-medium py-3 px-2">#</th>
                <th className="text-left text-gray-400 font-medium py-3 px-2">Ticket</th>
                <th className="text-left text-gray-400 font-medium py-3 px-2">Sell-through</th>
                <th className="text-left text-gray-400 font-medium py-3 px-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const sellThroughPercent = Math.round(item.sellThroughPercent);
                const isLowSelling = sellThroughPercent < 10;

                return (
                  <tr
                    key={item.ticketId}
                    className="border-b border-gray-700 hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-2">
                      <span className="text-gray-400 font-medium">
                        {index + 1}.
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center space-x-3">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-700 shrink-0">
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-medium truncate">
                            {item.title}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {format(new Date(item.eventAt), 'dd.MM.yyyy', {
                              locale: enUS,
                            })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-sm font-medium ${
                            isLowSelling ? 'text-red-400' : 'text-white'
                          }`}
                        >
                          {formatNumber(item.soldQuantity)}/{formatNumber(item.totalQuantity)}
                        </span>
                        <div className="flex-1 min-w-20">
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                isLowSelling ? 'bg-red-500' : 'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.min(sellThroughPercent, 100)}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-400 mt-1 block">
                            {sellThroughPercent}%
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-white font-medium">
                        {formatCurrency(item.revenue)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}