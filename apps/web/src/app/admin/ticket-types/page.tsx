'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import {
  getTicketTypesList,
  createTicketType,
  updateTicketType,
  deleteTicketType,
  forceDeleteTicketType,
  checkTicketTypeHasEvents,
} from '@/services/admin-api-client';
import type { TicketType, PaginatedTicketTypesResponse } from '@/types/admin';
import Modal from '@/components/Modal';
import TicketTypeForm from './components/TicketTypeForm';

function shortId(id: string) {
  return id.slice(0, 8);
}

export default function AdminTicketTypesPage() {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTicketType, setEditingTicketType] = useState<TicketType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [deleteModalHasEvents, setDeleteModalHasEvents] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function loadTicketTypes(pageToLoad: number) {
    setIsLoading(true);
    setError(null);
    try {
      const data: PaginatedTicketTypesResponse = await getTicketTypesList(pageToLoad, 20);
      setTicketTypes(data.items);
      setPage(data.meta.page);
      setTotalPages(Math.max(1, Math.ceil(data.meta.total / data.meta.limit)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ticket types');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTicketTypes(page);
  }, [page]);

  function openCreateModal() {
    setEditingTicketType(null);
    setModalOpen(true);
  }

  function openEditModal(ticketType: TicketType) {
    setEditingTicketType(ticketType);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTicketType(null);
  }

  async function handleSave(data: {
    title: string;
    description: string;
    isActive: boolean;
    imageAssetId: string;
    totalQuantity: number;
    soldQuantity: number;
  }) {
    setIsSaving(true);
    try {
      if (editingTicketType) {
        await updateTicketType(editingTicketType.id, data);
      } else {
        await createTicketType(data);
      }
      closeModal();
      await loadTicketTypes(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save ticket type');
    } finally {
      setIsSaving(false);
    }
  }

  async function openDeleteModal(id: string) {
    try {
      const result = await checkTicketTypeHasEvents(id);
      setDeleteModalHasEvents(result.hasEvents);
      setDeleteModalId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check ticket type events');
    }
  }

  function closeDeleteModal() {
    setDeleteModalId(null);
    setDeleteModalHasEvents(false);
  }

  async function handleDelete(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (!deleteModalId) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      if (deleteModalHasEvents) {
        await forceDeleteTicketType(deleteModalId);
      } else {
        await deleteTicketType(deleteModalId);
      }
      closeDeleteModal();
      await loadTicketTypes(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete ticket type');
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

  return (
    <div className="text-white">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ticket Types</h1>
        <button onClick={openCreateModal} className="rounded bg-green-600 px-4 py-2 font-bold hover:bg-green-700">
          Add Ticket Type
        </button>
      </div>

      {error && <div className="mb-4 rounded border border-red-700 bg-red-900 p-2 text-red-300">{error}</div>}

      <table className="w-full overflow-hidden rounded border border-gray-700">
        <thead className="bg-gray-800 text-left">
          <tr>
            <th className="p-2">Avatar</th>
            <th className="p-2">ID</th>
            <th className="p-2">Title</th>
            <th className="p-2">Is Active</th>
            <th className="p-2">Edit</th>
            <th className="p-2">Delete</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={6} className="p-4 text-center">
                Loading...
              </td>
            </tr>
          ) : ticketTypes.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-4 text-center">
                No ticket types found.
              </td>
            </tr>
          ) : (
            ticketTypes.map((tt) => (
              <tr key={tt.id} className="border-t border-gray-700">
                <td className="p-2">
                  {tt.imageUrl ? (
                    <Image src={tt.imageUrl} alt={tt.title} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-600 text-gray-400">
                      No Avatar
                    </div>
                  )}
                </td>
                <td className="p-2">{shortId(tt.id)}</td>
                <td className="p-2">{tt.title}</td>
                <td className="p-2">
                  {tt.isActive ? (
                    <span className="inline-block rounded bg-green-600 px-2 py-1 text-xs font-semibold">Active</span>
                  ) : (
                    <span className="inline-block rounded bg-red-600 px-2 py-1 text-xs font-semibold">Inactive</span>
                  )}
                </td>
                <td className="p-2">
                  <button
                    onClick={() => openEditModal(tt)}
                    className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-700"
                  >
                    Edit
                  </button>
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => openDeleteModal(tt.id)}
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
        <h2 className="mb-4 text-xl font-bold">{editingTicketType ? 'Edit Ticket Type' : 'Create Ticket Type'}</h2>
        <TicketTypeForm
          initialData={editingTicketType ?? undefined}
          onSave={handleSave}
          onCancel={closeModal}
          isSaving={isSaving}
        />
      </Modal>

      <Modal isOpen={deleteModalId !== null} onClose={closeDeleteModal}>
        <h2 className="mb-4 text-xl font-bold text-red-600">Warning</h2>
        <p className="mb-4">
          {deleteModalHasEvents
            ? 'Are you sure you want to delete this ticket type? Existing ticket events will also be deleted.'
            : 'Are you sure you want to delete this ticket type?'}
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
