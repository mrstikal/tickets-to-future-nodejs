'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import Select from 'react-select';
import type { CSSObjectWithLabel, StylesConfig } from 'react-select';
import {
  getTicketEventsList,
  createTicketEvent,
  updateTicketEvent,
  deleteTicketEvent,
  forceDeleteTicketEvent,
  checkTicketEventHasHoldsOrOrders,
  getAdminTicketTypes,
} from '@/services/admin-api-client';
import type { TicketEvent, PaginatedTicketEventsResponse, AdminTicketTypesResponse } from '@/types/admin';
import Modal from '@/components/Modal';
import TicketEventForm from './components/TicketEventForm';

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

export default function AdminTicketEventsPage() {
  const [ticketEvents, setTicketEvents] = useState<TicketEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTicketEvent, setEditingTicketEvent] = useState<TicketEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [deleteModalHasHoldsOrOrders, setDeleteModalHasHoldsOrOrders] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [ticketTypeOptions, setTicketTypeOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string>('');

  async function loadTicketEvents(pageToLoad: number, ticketTypeId?: string) {
    setIsLoading(true);
    setError(null);
    try {
      const data: PaginatedTicketEventsResponse = await getTicketEventsList(pageToLoad, 20, ticketTypeId);
      setTicketEvents(data.items);
      setPage(data.meta.page);
      setTotalPages(Math.max(1, Math.ceil(data.meta.total / data.meta.limit)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ticket events');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTicketTypeOptions() {
    try {
      const data: AdminTicketTypesResponse = await getAdminTicketTypes();
      setTicketTypeOptions(data.items);
    } catch (e) {
      console.error('Failed to load ticket types for filter', e);
    }
  }

  useEffect(() => {
    loadTicketEvents(page, selectedTicketTypeId || undefined);
    loadTicketTypeOptions();
  }, [page, selectedTicketTypeId]);

  function openCreateModal() {
    setEditingTicketEvent(null);
    setModalOpen(true);
  }

  function openEditModal(ticketEvent: TicketEvent) {
    setEditingTicketEvent(ticketEvent);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTicketEvent(null);
  }

  async function handleSave(data: {
    ticketTypeId: string;
    slug: string;
    title: string;
    description: string;
    eventAt: string;
    price: number;
    currency: string;
    totalQuantity: number;
    soldQuantity: number;
    isActive: boolean;
    imageAssetId: string | null;
  }) {
    setIsSaving(true);
    try {
      if (editingTicketEvent) {
        await updateTicketEvent(editingTicketEvent.id, data);
      } else {
        await createTicketEvent(data);
      }
      closeModal();
      await loadTicketEvents(page, selectedTicketTypeId || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save ticket event');
    } finally {
      setIsSaving(false);
    }
  }

  async function openDeleteModal(id: string) {
    try {
      const result = await checkTicketEventHasHoldsOrOrders(id);
      setDeleteModalHasHoldsOrOrders(result.hasHoldsOrOrders);
      setDeleteModalId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check ticket event holds/orders');
    }
  }

  function closeDeleteModal() {
    setDeleteModalId(null);
    setDeleteModalHasHoldsOrOrders(false);
  }

  async function handleDelete(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (!deleteModalId) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      if (deleteModalHasHoldsOrOrders) {
        await forceDeleteTicketEvent(deleteModalId);
      } else {
        await deleteTicketEvent(deleteModalId);
      }
      closeDeleteModal();
      await loadTicketEvents(page, selectedTicketTypeId || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete ticket event');
    } finally {
      setIsDeleting(false);
    }
  }

  function goToPage(input: string) {
    const pageNum = Number(input);
    if (!Number.isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum);
    }
  }

  function handleFilterChange(ticketTypeId: string) {
    setSelectedTicketTypeId(ticketTypeId);
    setPage(1); // reset to first page when filter changes
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

  const selectOptions: SelectOption[] = [
    { value: '', label: 'All ticket types' },
    ...ticketTypeOptions.map((option) => ({
      value: option.id,
      label: option.title,
    })),
  ];

  return (
    <div className="text-white">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ticket Events</h1>
        <button onClick={openCreateModal} className="rounded bg-green-600 px-4 py-2 font-bold hover:bg-green-700">
          Add Ticket Event
        </button>
      </div>

      {error && <div className="mb-4 rounded border border-red-700 bg-red-900 p-2 text-red-300">{error}</div>}

      <div className="mb-4">
        <label htmlFor="ticket-type-filter-input" className="mr-2 text-sm font-medium">
          Filter by Ticket Type:
        </label>
        <Select
          instanceId="ticket-type-filter"
          inputId="ticket-type-filter-input"
          value={selectOptions.find((option) => option.value === selectedTicketTypeId) || null}
          onChange={(option) => handleFilterChange(option?.value ?? '')}
          options={selectOptions}
          isClearable
          placeholder="All ticket types"
          styles={customSelectStyles}
          className="text-black"
        />
      </div>

      <table className="w-full overflow-hidden rounded border border-gray-700">
        <thead className="bg-gray-800 text-left">
          <tr>
            <th className="p-2">Avatar</th>
            <th className="p-2">ID</th>
            <th className="p-2">Slug</th>
            <th className="p-2">Title</th>
            <th className="p-2">Event Date</th>
            <th className="p-2">Price</th>
            <th className="p-2">Is Active</th>
            <th className="p-2">Edit</th>
            <th className="p-2">Delete</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={9} className="p-4 text-center">
                Loading...
              </td>
            </tr>
          ) : ticketEvents.length === 0 ? (
            <tr>
              <td colSpan={9} className="p-4 text-center">
                No ticket events found.
              </td>
            </tr>
          ) : (
            ticketEvents.map((te) => (
              <tr key={te.id} className="border-t border-gray-700">
                <td className="p-2">
                  {te.imageUrl ? (
                    <Image src={te.imageUrl} alt={te.title} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-600 text-gray-400">
                      No Avatar
                    </div>
                  )}
                </td>
                <td className="p-2">{shortId(te.id)}</td>
                <td className="p-2">{te.slug}</td>
                <td className="p-2">{te.title}</td>
                <td className="p-2">{formatDateTime(te.eventAt)}</td>
                <td className="p-2">{te.price} {te.currency}</td>
                <td className="p-2">
                  {te.isActive ? (
                    <span className="inline-block rounded bg-green-600 px-2 py-1 text-xs font-semibold">Active</span>
                  ) : (
                    <span className="inline-block rounded bg-red-600 px-2 py-1 text-xs font-semibold">Inactive</span>
                  )}
                </td>
                <td className="p-2">
                  <button
                    onClick={() => openEditModal(te)}
                    className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-700"
                  >
                    Edit
                  </button>
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => openDeleteModal(te.id)}
                    className="rounded bg-red-600 px-3 py-1 text-sm hover:bg-red-700"
                  >
                    Delete
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

      <Modal isOpen={modalOpen} onClose={closeModal}>
        <h2 className="mb-4 text-xl font-bold">{editingTicketEvent ? 'Edit Ticket Event' : 'Create Ticket Event'}</h2>
        <TicketEventForm
          initialData={editingTicketEvent ?? undefined}
          onSave={handleSave}
          onCancel={closeModal}
          isSaving={isSaving}
          ticketTypeOptions={ticketTypeOptions}
        />
      </Modal>

      <Modal isOpen={deleteModalId !== null} onClose={closeDeleteModal}>
        <h2 className="mb-4 text-xl font-bold text-red-600">Warning</h2>
        <p className="mb-4">
          {deleteModalHasHoldsOrOrders
            ? 'Are you sure you want to delete this ticket event? Existing holds and orders will also be deleted.'
            : 'Are you sure you want to delete this ticket event?'}
        </p>
        <div className="flex justify-end space-x-2">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded bg-red-700 px-4 py-2 font-bold hover:bg-red-800"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={closeDeleteModal}
            disabled={isDeleting}
            className="rounded bg-gray-600 px-4 py-2 hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}