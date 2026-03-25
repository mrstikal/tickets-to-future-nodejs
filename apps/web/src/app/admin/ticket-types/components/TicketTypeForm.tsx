'use client';

import { useState, FormEvent, useEffect } from 'react';
import AvatarUpload from '@/components/AvatarUpload';
import type { TicketType } from '@/types/admin';
import { uploadImageAsset } from '@/services/admin-api-client';

type TicketTypeFormProps = {
  initialData?: TicketType;
  onSave: (data: {
    title: string;
    description: string;
    isActive: boolean;
    imageAssetId: string;
    totalQuantity: number;
    soldQuantity: number;
  }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
};

export default function  TicketTypeForm({
  initialData,
  onSave,
  onCancel,
  isSaving,
}: TicketTypeFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [imageAssetId, setImageAssetId] = useState(initialData?.imageAssetId || '');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  // Restored imageFile state variable with ESLint disable comment for unused variable
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [totalQuantity, setTotalQuantity] = useState(initialData?.totalQuantity || 0);
  const [soldQuantity, setSoldQuantity] = useState(initialData?.soldQuantity || 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(initialData?.title || '');
    setDescription(initialData?.description || '');
    setIsActive(initialData?.isActive ?? true);
    setImageAssetId(initialData?.imageAssetId || '');
    setUploadedImageUrl(null);
    setTotalQuantity(initialData?.totalQuantity || 0);
    setSoldQuantity(initialData?.soldQuantity || 0);
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
      setImageAssetId('');
      setUploadedImageUrl(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    function isValidUUID(uuid: string) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(uuid);
    }

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!imageAssetId) {
      setError('Avatar image is required');
      return;
    }

    if (!isValidUUID(imageAssetId)) {
      setError('Avatar image ID is invalid');
      return;
    }

    setError(null);

    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        isActive,
        imageAssetId,
        totalQuantity,
        soldQuantity,
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

      <AvatarUpload imageUrl={uploadedImageUrl ? uploadedImageUrl : initialData?.imageUrl} onFileSelect={handleFileSelect} />

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-white">
          Title
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

      <div>
        <label htmlFor="totalQuantity" className="block text-sm font-medium text-white">
          Total Quantity
        </label>
        <input
          id="totalQuantity"
          type="number"
          min={0}
          value={totalQuantity}
          onChange={(e) => setTotalQuantity(Number(e.target.value))}
          className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-green-500 focus:ring-green-500"
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