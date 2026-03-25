'use client';

import { useState, useEffect, ChangeEvent } from 'react';

type AvatarUploadProps = {
  imageUrl?: string;
  onFileSelect: (file: File | null) => void;
};

export default function AvatarUpload({ imageUrl, onFileSelect }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | undefined>(imageUrl);

  useEffect(() => {
    setPreview(imageUrl);
  }, [imageUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files && event.target.files[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      onFileSelect(file);
    } else {
      setPreview(imageUrl);
      onFileSelect(null);
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
    </div>
  );
}