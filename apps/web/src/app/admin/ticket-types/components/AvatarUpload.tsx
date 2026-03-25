'use client';

import { useState, useEffect, ChangeEvent } from 'react';

type AvatarUploadProps = {
  imageUrl?: string;
  onFileSelect: (file: File | null) => void;
  onError?: (message: string) => void;
};

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export default function AvatarUpload({ imageUrl, onFileSelect, onError }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | undefined>(imageUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(imageUrl);
  }, [imageUrl]);

  function validateFile(file: File): boolean {
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      const errorMsg = 'Invalid file type. Allowed types: JPEG, PNG, GIF, WebP';
      setError(errorMsg);
      if (onError) onError(errorMsg);
      return false;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const errorMsg = 'File too large. Maximum size is 5 MB';
      setError(errorMsg);
      if (onError) onError(errorMsg);
      return false;
    }

    setError(null);
    if (onError) onError('');
    return true;
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files && event.target.files[0];
    if (file) {
      if (!validateFile(file)) {
        // Clear the input to allow re-selection
        event.target.value = '';
        return;
      }
      
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      onFileSelect(file);
    } else {
      setPreview(imageUrl);
      onFileSelect(null);
      setError(null);
      if (onError) onError('');
    }
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element -- Use plain <img> for blob URLs from file input */
            <img src={preview} alt="Avatar preview" className="object-cover w-full h-full" />
          ) : (
            <div className="text-gray-400">No avatar</div>
          )}
      </div>
      <label
        htmlFor="avatar-upload"
        className="cursor-pointer inline-block rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
      >
        Choose Avatar
      </label>
      <input
        id="avatar-upload"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      {error && (
        <div className="text-red-500 text-sm text-center max-w-xs">
          {error}
        </div>
      )}
    </div>
  );
}
