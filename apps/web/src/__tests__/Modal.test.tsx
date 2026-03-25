import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../components/Modal';
import { vi } from 'vitest';

describe('Modal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('does not render when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={onClose}>
        <div>Content</div>
      </Modal>
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders children when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div data-testid="modal-content">Content</div>
      </Modal>
    );
    expect(screen.getByTestId('modal-content')).toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Content</div>
      </Modal>
    );
    const closeButton = screen.getByLabelText(/close modal/i);
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when Escape key is pressed', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Content</div>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when clicking on overlay', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div data-testid="modal-content">Content</div>
      </Modal>
    );
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not call onClose when clicking inside modal content', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div data-testid="modal-content">Content</div>
      </Modal>
    );
    const content = screen.getByTestId('modal-content');
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });
});
