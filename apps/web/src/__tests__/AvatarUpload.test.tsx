import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AvatarUpload from '../app/admin/ticket-types/components/AvatarUpload';
import { vi } from 'vitest';
import { AuthProvider } from '@/features/auth-context';

describe('AvatarUpload', () => {
  const onFileSelectMock = vi.fn();
  const onErrorMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'mocked-url');
  });

  function renderWithProviders(ui: React.ReactElement) {
    return render(
      <AuthProvider>
        {ui}
      </AuthProvider>
    );
  }

  test('renders "No avatar" when no imageUrl is provided', () => {
    renderWithProviders(<AvatarUpload onFileSelect={onFileSelectMock} />);
    expect(screen.getByText(/no avatar/i)).toBeInTheDocument();
  });

  test('renders image preview when imageUrl is provided', () => {
    renderWithProviders(<AvatarUpload imageUrl="http://example.com/avatar.jpg" onFileSelect={onFileSelectMock} />);
    const img = screen.getByAltText(/avatar preview/i);
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'http://example.com/avatar.jpg');
  });

  test('calls onFileSelect and updates preview on file selection', () => {
    renderWithProviders(<AvatarUpload onFileSelect={onFileSelectMock} />);
    const file = new File(['dummy content'], 'avatar.png', { type: 'image/png' });
    const input = screen.getByLabelText(/choose avatar/i);
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelectMock).toHaveBeenCalledWith(file);
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(file);
    const img = screen.getByAltText(/avatar preview/i);
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'mocked-url');
  });

  test('calls onFileSelect with null when file selection is cleared', () => {
    renderWithProviders(<AvatarUpload onFileSelect={onFileSelectMock} />);
    const input = screen.getByLabelText(/choose avatar/i);
    fireEvent.change(input, { target: { files: [] } });
    expect(onFileSelectMock).toHaveBeenCalledWith(null);
  });

  test('rejects file with invalid MIME type and shows error', () => {
    renderWithProviders(<AvatarUpload onFileSelect={onFileSelectMock} onError={onErrorMock} />);
    const file = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/choose avatar/i);
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(onFileSelectMock).not.toHaveBeenCalled();
    expect(onErrorMock).toHaveBeenCalledWith('Invalid file type. Allowed types: JPEG, PNG, GIF, WebP');
    expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
  });

  test('rejects file exceeding 5 MB size limit and shows error', () => {
    renderWithProviders(<AvatarUpload onFileSelect={onFileSelectMock} onError={onErrorMock} />);
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/choose avatar/i);
    fireEvent.change(input, { target: { files: [largeFile] } });
    
    expect(onFileSelectMock).not.toHaveBeenCalled();
    expect(onErrorMock).toHaveBeenCalledWith('File too large. Maximum size is 5 MB');
    expect(screen.getByText(/File too large/i)).toBeInTheDocument();
  });

  test('accepts valid image file and clears previous error', () => {
    renderWithProviders(<AvatarUpload onFileSelect={onFileSelectMock} onError={onErrorMock} />);
    
    // First, trigger an error
    const pdfFile = new File(['dummy'], 'doc.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/choose avatar/i);
    fireEvent.change(input, { target: { files: [pdfFile] } });
    expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
    
    // Then select a valid file
    const validFile = new File(['dummy'], 'avatar.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [validFile] } });
    
    expect(onFileSelectMock).toHaveBeenCalledWith(validFile);
    expect(onErrorMock).toHaveBeenCalledWith('');
    expect(screen.queryByText(/Invalid file type/i)).not.toBeInTheDocument();
  });
});
