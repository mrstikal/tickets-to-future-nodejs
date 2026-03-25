import type { IncomingMessage, ServerResponse } from 'node:http';
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sendJson } from '../lib/send-json';
import { createImageAssetsRepository } from '../repositories/image-assets-repository';
import { getDependenciesRuntime } from '../lib/dependencies-runtime';
import type { DependenciesRuntime } from '../types/runtime';
import busboy from 'busboy';
import path from 'path';

export async function uploadImageAssetHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.setHeader('Allow', 'POST');
    response.end('Method Not Allowed');
    return;
  }

  const contentType = request.headers['content-type'];
  if (!contentType || !contentType.startsWith('multipart/form-data')) {
    sendJson(response, 400, { error: { message: 'Content-Type must be multipart/form-data' } });
    return;
  }

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  const bb = busboy({ headers: request.headers, limits: { fileSize: MAX_FILE_SIZE_BYTES } });
  let fileSaved = false;
  let savedFileName = '';
  let savedFilePath = '';
  let savedFileExt = '';
  let savedFileId = '';
  let invalidMimeType = false;
  let fileTooLarge = false;

  const storageDir = path.resolve('apps/web/public/storage/characters');
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  const deleteFileIfExists = (filePath: string) => {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup errors
    }
  };

  bb.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
    const { filename, mimeType } = info;
    
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      invalidMimeType = true;
      file.resume(); // Drain the stream without saving
      return;
    }

    savedFileExt = path.extname(filename);
    savedFileId = randomUUID();
    savedFileName = savedFileId + savedFileExt;
    savedFilePath = path.join(storageDir, savedFileName);

    const writeStream = createWriteStream(savedFilePath);
    file.pipe(writeStream);

    file.on('end', () => {
      fileSaved = true;
    });

    file.on('error', () => {
      deleteFileIfExists(savedFilePath);
    });

    // Check if file was truncated due to size limit
    (file as NodeJS.ReadableStream & { on(event: 'limit', listener: () => void): void }).on('limit', () => {
      fileTooLarge = true;
      deleteFileIfExists(savedFilePath);
    });
  });

  bb.on('error', (error: Error) => {
    sendJson(response, 500, { error: { message: 'File upload error: ' + error.message } });
  });

  bb.on('finish', async () => {
    // Check validation errors before processing
    if (invalidMimeType) {
      sendJson(response, 400, { error: { message: 'Invalid file type. Allowed types: JPEG, PNG, GIF, WebP' } });
      return;
    }

    if (fileTooLarge) {
      sendJson(response, 413, { error: { message: 'File too large. Maximum size is 5 MB' } });
      return;
    }

    if (!fileSaved) {
      sendJson(response, 400, { error: { message: 'No file uploaded' } });
      return;
    }

    try {
      const runtime: DependenciesRuntime = getDependenciesRuntime();
      if (!runtime.postgres) {
        sendJson(response, 500, { error: { message: 'Postgres not available' } });
        return;
      }
      const repository = createImageAssetsRepository(runtime.postgres);
      if (!repository) {
        sendJson(response, 500, { error: { message: 'Image assets repository not available' } });
        return;
      }

      const imageUrl = `/storage/characters/${savedFileName}`;
      const localImagePath = imageUrl;
      const externalId = savedFileId;

      const created = await repository.create({
        id: savedFileId,
        externalId,
        name: savedFileName,
        imageUrl: imageUrl,
        localImagePath: localImagePath,
        source: 'admin-upload',
      });

      sendJson(response, 201, {
        id: created.id,
        image_url: created.image_url,
        local_image_path: created.local_image_path,
      });
    } catch (error) {
      // Clean up file on database error
      deleteFileIfExists(savedFilePath);
      sendJson(response, 500, { error: { message: (error as Error).message || 'Failed to save image asset' } });
    }
  });

  request.pipe(bb);
}