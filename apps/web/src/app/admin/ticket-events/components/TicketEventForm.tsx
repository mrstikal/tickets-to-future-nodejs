'use client';

import { useState, FormEvent, useEffect } from 'react';
import AvatarUpload from '@/components/AvatarUpload';
import type { TicketEvent } from '@/types/admin';
import { uploadImageAsset } from '@/services/admin-api-client';

type TicketEventFormProps = {
  initialData?: TicketEvent;
  onSave: (data: {
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
  }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  ticketTypeOptions: Array<{ id: string; title: string }>;
};

export default function TicketEventForm({
  initialData,
  onSave,
  onCancel,
  isSaving,
  ticketTypeOptions,
}: TicketEventFormProps) {
  const [ticketTypeId, setTicketTypeId] = useState(initialData?.ticketTypeId || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [eventAt, setEventAt] = useState(() => {
    if (initialData?.eventAt) {
      const date = new Date(initialData.eventAt);
      // Convert to local datetime string in format YYYY-MM-DDTHH:mm
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    return '';
  });
  const [price, setPrice] = useState(initialData?.price || 0);
  const [currency, setCurrency] = useState(initialData?.currency || 'CZK');
  const [totalQuantity, setTotalQuantity] = useState(initialData?.totalQuantity || 0);
  const [soldQuantity, setSoldQuantity] = useState(initialData?.soldQuantity || 0);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [imageAssetId, setImageAssetId] = useState<string | null>(initialData?.imageAssetId || null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTicketTypeId(initialData?.ticketTypeId || '');
    setSlug(initialData?.slug || '');
    setTitle(initialData?.title || '');
    setDescription(initialData?.description || '');
    if (initialData?.eventAt) {
      const date = new Date(initialData.eventAt);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      setEventAt(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      setEventAt('');
    }
    setPrice(initialData?.price || 0);
    setCurrency(initialData?.currency || 'CZK');
    setTotalQuantity(initialData?.totalQuantity || 0);
    setSoldQuantity(initialData?.soldQuantity || 0);
    setIsActive(initialData?.isActive ?? true);
    setImageAssetId(initialData?.imageAssetId || null);
    setUploadedImageUrl(null);
    setImageFile(null);
    setError(null);
  }, [initialData]);

  async function handleFileSelect(file: File | null) {
    if (file) {
      setImageFile(file);
      try {
        setError(null);
        const uploadResult = await uploadImageAsset(file);
        setImageAssetId(uploadResult.id);
        setUploadedImageUrl(uploadResult.imageUrl);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to upload image');
      }
    } else {
      setImageFile(null);
      setImageAssetId(null);
      setUploadedImageUrl(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!ticketTypeId) {
      setError('Ticket type is required');
      return;
    }

    if (!slug.trim()) {
      setError('Slug is required');
      return;
    }

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!eventAt) {
      setError('Event date/time is required');
      return;
    }

    if (price < 0) {
      setError('Price must be non-negative');
      return;
    }

    if (totalQuantity < 0) {
      setError('Total quantity must be non-negative');
      return;
    }

    if (soldQuantity < 0) {
      setError('Sold quantity must be non-negative');
      return;
    }

    if (soldQuantity > totalQuantity) {
      setError('Sold quantity cannot exceed total quantity');
      return;
    }

    setError(null);

    try {
      // Convert datetime-local string to ISO string
      const eventAtIso = new Date(eventAt).toISOString();

      await onSave({
        ticketTypeId,
        slug: slug.trim(),
        title: title.trim(),
        description: description.trim(),
        eventAt: eventAtIso,
        price,
        currency,
        totalQuantity,
        soldQuantity,
        isActive,
        imageAssetId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-900 border border-red-700 rounded p-2 text-red-300">
          {error}
        </div>
      )}

      <AvatarUpload
        imageUrl={uploadedImageUrl ? uploadedImageUrl : initialData?.imageUrl}
        onFileSelect={handleFileSelect}
      />

      <div>
        <label htmlFor="ticketTypeId" className="block text-sm font-medium text-white">
          Ticket Type *
        </label>
        <select
          id="ticketTypeId"
          value={ticketTypeId}
          onChange={(e) => setTicketTypeId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-green-500 focus:ring-green-500"
          required
        >
          <option value="">Select a ticket type</option>
          {ticketTypeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-white">
          Slug *
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-green-500 focus:ring-green-500"
          required
        />
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-white">
          Title *
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-green-500 focus:ring-green-500"
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-white">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-green-500 focus:ring-green-500"
        />
      </div>

      <div>
        <label htmlFor="eventAt" className="block text-sm font-medium text-white">
          Event Date/Time *
        </label>
        <input
          id="eventAt"
          type="datetime-local"
          value={eventAt}
          onChange={(e) => setEventAt(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-green-500 focus:ring-green-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-white">
            Price *
          </label>
          <input
            id="price"
            type="number"
            min={0}
            step={1}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-green-500 focus:ring-green-500"
            required
          />
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-white">
            Currency
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-green-500 focus:ring-green-500"
          >
            <option value="CZK">CZK</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="totalQuantity" className="block text-sm font-medium text-white">
            Total Quantity *
          </label>
          <input
            id="totalQuantity"
            type="number"
            min={0}
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-green-500 focus:ring-green-500"
            required
          />
        </div>

        <div>
          <label htmlFor="soldQuantity" className="block text-sm font-medium text-white">
            Sold Quantity
          </label>
          <input
            id="soldQuantity"
            type="number"
            min={0}
            value={soldQuantity}
            onChange={(e) => setSoldQuantity(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-green-500 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          id="isActive"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-green-600 focus:ring-green-500"
        />
        <label htmlFor="isActive" className="text-sm text-white">
          Is Active
        </label>
      </div>

      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded bg-gray-600 px-4 py-2 font-bold text-white hover:bg-gray-700"
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-700 disabled:opacity-50"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}