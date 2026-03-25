'use client';

import { useEffect, useState } from 'react';
import Select from 'react-select';
import type { CSSObjectWithLabel, StylesConfig } from 'react-select';
import { getOrdersList, getOrderDetail } from '@/services/admin-api-client';
import type { AdminOrder, AdminOrderDetail, PaginatedOrdersResponse, OrderFilters, OrderStatus } from '@/types/admin';
import Modal from '@/components/Modal';
import OrderDetail from './components/OrderDetail';

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatDateTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeColor(status: OrderStatus): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-600';
    case 'created':
      return 'bg-yellow-600';
    case 'failed':
      return 'bg-red-600';
    case 'expired':
      return 'bg-gray-600';
    case 'cancelled':
      return 'bg-orange-600';
    default:
      return 'bg-gray-600';
  }
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [, setFilters] = useState<OrderFilters>({});
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [emailFilter, setEmailFilter] = useState<string>('');

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<AdminOrderDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  async function loadOrders(pageToLoad: number, filters?: OrderFilters) {
    setIsLoading(true);
    setError(null);
    try {
      const data: PaginatedOrdersResponse = await getOrdersList(pageToLoad, 20, filters);
      setOrders(data.items);
      setPage(data.meta.page);
      setTotalPages(Math.max(1, Math.ceil(data.meta.total / data.meta.limit)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const appliedFilters: OrderFilters = {};
    if (statusFilter) appliedFilters.status = statusFilter as OrderStatus;
    if (startDateFilter) appliedFilters.startDate = startDateFilter;
    if (endDateFilter) appliedFilters.endDate = endDateFilter;
    if (emailFilter) appliedFilters.email = emailFilter;
    setFilters(appliedFilters);
    loadOrders(page, appliedFilters);
  }, [page, statusFilter, startDateFilter, endDateFilter, emailFilter]);

  async function openDetailModal(orderId: string) {
    setIsLoadingDetail(true);
    setError(null);
    try {
      const detail = await getOrderDetail(orderId);
      setSelectedOrderDetail(detail);
      setDetailModalOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load order detail');
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function closeDetailModal() {
    setDetailModalOpen(false);
    setSelectedOrderDetail(null);
  }

  function handleOrderUpdated(updatedOrder: AdminOrderDetail) {
    // Update the order in the list
    setOrders(prev => prev.map(order => order.id === updatedOrder.id ? updatedOrder : order));
    // Also update the detail if it's open
    if (selectedOrderDetail && selectedOrderDetail.id === updatedOrder.id) {
      setSelectedOrderDetail(updatedOrder);
    }
  }

  function goToPage(input: string) {
    const pageNum = Number(input);
    if (!Number.isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum);
    }
  }


  type SelectOption = {
    value: string;
    label: string;
  };

  const customSelectStyles: StylesConfig<SelectOption, false> = {
    control: (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...provided,
      backgroundColor: '#374151',
      borderColor: '#4B5563',
      color: 'white',
      '&:hover': {
        borderColor: '#6B7280',
      },
    }),
    menu: (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...provided,
      backgroundColor: '#374151',
    }),
    option: (provided: CSSObjectWithLabel, state: { isSelected: boolean }): CSSObjectWithLabel => ({
      ...provided,
      backgroundColor: state.isSelected ? '#4B5563' : '#374151',
      color: 'white',
      '&:hover': {
        backgroundColor: '#4B5563',
      },
    }),
    singleValue: (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...provided,
      color: 'white',
    }),
    input: (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...provided,
      color: 'white',
    }),
  };

  const statusOptions: SelectOption[] = [
    { value: '', label: 'All statuses' },
    { value: 'created', label: 'Created' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'failed', label: 'Failed' },
    { value: 'expired', label: 'Expired' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="text-white">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
      </div>

      {error && <div className="mb-4 rounded border border-red-700 bg-red-900 p-2 text-red-300">{error}</div>}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <label htmlFor="status-filter" className="mb-1 block text-sm font-medium">
            Status
          </label>
          <Select
            instanceId="status-filter"
            inputId="status-filter"
            value={statusOptions.find((option) => option.value === statusFilter) || null}
            onChange={(option) => setStatusFilter(option?.value ?? '')}
            options={statusOptions}
            isClearable
            placeholder="All statuses"
            styles={customSelectStyles}
            className="text-black"
          />
        </div>
        <div>
          <label htmlFor="start-date" className="mb-1 block text-sm font-medium">
            Start Date
          </label>
          <input
            id="start-date"
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="end-date" className="mb-1 block text-sm font-medium">
            End Date
          </label>
          <input
            id="end-date"
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="email-filter" className="mb-1 block text-sm font-medium">
            Email Search
          </label>
          <input
            id="email-filter"
            type="text"
            placeholder="Enter email"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2"
          />
        </div>
      </div>

      <table className="w-full overflow-hidden rounded border border-gray-700">
        <thead className="bg-gray-800 text-left">
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Order Number</th>
            <th className="p-2">Status</th>
            <th className="p-2">Email</th>
            <th className="p-2">Name</th>
            <th className="p-2">Total Price</th>
            <th className="p-2">Currency</th>
            <th className="p-2">Created At</th>
            <th className="p-2">Detail</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={9} className="p-4 text-center">
                Loading...
              </td>
            </tr>
          ) : orders.length === 0 ? (
            <tr>
              <td colSpan={9} className="p-4 text-center">
                No orders found.
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="border-t border-gray-700">
                <td className="p-2">{shortId(order.id)}</td>
                <td className="p-2">{order.orderNumber}</td>
                <td className="p-2">
                  <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getStatusBadgeColor(order.status)}`}>
                    {order.status}
                  </span>
                </td>
                <td className="p-2">{order.email}</td>
                <td className="p-2">{order.name}</td>
                <td className="p-2">{order.totalPrice}</td>
                <td className="p-2">{order.currency}</td>
                <td className="p-2">{formatDateTime(order.createdAt)}</td>
                <td className="p-2">
                  <button
                    onClick={() => openDetailModal(order.id)}
                    disabled={isLoadingDetail}
                    className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Detail
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between space-x-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="rounded bg-gray-700 px-3 py-1 hover:bg-gray-600 disabled:opacity-50"
        >
          Previous
        </button>

        {page > 1 && (
          <button onClick={() => setPage(page - 1)} className="rounded bg-gray-700 px-3 py-1 hover:bg-gray-600">
            {page - 1}
          </button>
        )}

        <span className="rounded bg-green-600 px-3 py-1 font-bold">{page}</span>

        {page < totalPages && (
          <button onClick={() => setPage(page + 1)} className="rounded bg-gray-700 px-3 py-1 hover:bg-gray-600">
            {page + 1}
          </button>
        )}

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="rounded bg-gray-700 px-3 py-1 hover:bg-gray-600 disabled:opacity-50"
        >
          Next
        </button>

        <div className="flex items-center space-x-2">
          <label htmlFor="gotoPage" className="text-sm">
            Go to page
          </label>
          <input
            id="gotoPage"
            type="number"
            min={1}
            max={totalPages}
            onChange={(e) => goToPage(e.target.value)}
            className="w-16 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-black"
          />
        </div>
      </div>

      <Modal isOpen={detailModalOpen} onClose={closeDetailModal}>
        {selectedOrderDetail ? (
          <OrderDetail
            order={selectedOrderDetail}
            onClose={closeDetailModal}
            onOrderUpdated={handleOrderUpdated}
          />
        ) : (
          <div className="p-4 text-center">Loading order detail...</div>
        )}
      </Modal>
    </div>
  );
}