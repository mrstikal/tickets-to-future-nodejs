import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthModals from '../components/AuthModals';
import { vi } from 'vitest';
import { AuthProvider } from '@/features/auth-context';

// Mock the Modal component (simple passthrough)
vi.mock('../components/Modal', () => ({
  default: ({ children, isOpen, onClose }: { children: React.ReactNode; isOpen: boolean; onClose: () => void }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal">
        <button onClick={onClose} data-testid="modal-close">Close</button>
        {children}
      </div>
    );
  },
}));

// Mock useAuth
const mockLogin = vi.fn();
const mockSignUp = vi.fn();
const mockUseAuth = vi.fn();
let isAuthenticated = false;

vi.mock('@/features/auth-context', async () => {
  const actual = await vi.importActual('@/features/auth-context');
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

describe('AuthModals', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated = false;
    mockUseAuth.mockImplementation(() => ({
      login: mockLogin,
      signUp: mockSignUp,
      isLoading: false,
      isAuthenticated,
    }));
  });

  function renderAuthModals(props = {}) {
    return render(
      <AuthProvider>
        <AuthModals isOpen={true} onClose={onClose} {...props} />
      </AuthProvider>
    );
  }

  test('renders Sign In mode by default', () => {
    renderAuthModals();
    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account to get 10% discount on all tickets.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByText("Don't have an account? Sign up")).toBeInTheDocument();
  });

  test('renders Sign Up mode when initialMode="signup"', () => {
    renderAuthModals({ initialMode: 'signup' });
    expect(screen.getByRole('heading', { name: 'Sign Up' })).toBeInTheDocument();
    expect(screen.getByText('Create a new account to get 10% discount on all tickets.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
    expect(screen.getByText('Already have an account? Sign in')).toBeInTheDocument();
  });

  test('switches between Sign In and Sign Up modes', () => {
    renderAuthModals();
    // Initially Sign In
    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    // Click switch link
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    // Now should be Sign Up
    expect(screen.getByRole('heading', { name: 'Sign Up' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    // Switch back
    fireEvent.click(screen.getByText('Already have an account? Sign in'));
    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
  });

  test('form fields have required attributes', () => {
    renderAuthModals();
    expect(screen.getByLabelText('Email')).toBeRequired();
    expect(screen.getByLabelText('Password')).toBeRequired();
  });

  test('Name field is required in Sign Up mode', () => {
    renderAuthModals({ initialMode: 'signup' });
    expect(screen.getByLabelText('Name')).toBeRequired();
  });

  test('calls login with correct credentials on Sign In submit', async () => {
    mockLogin.mockImplementation(async () => {
      isAuthenticated = true;
    });
    renderAuthModals();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  test('calls signUp with correct credentials on Sign Up submit', async () => {
    mockSignUp.mockImplementation(async () => {
      isAuthenticated = true;
    });
    renderAuthModals({ initialMode: 'signup' });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'securepass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securepass',
      });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  test('shows error message when login fails', async () => {
    const errorMessage = 'Invalid credentials';
    mockLogin.mockRejectedValue(new Error(errorMessage));
    renderAuthModals();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('shows error message when signUp fails', async () => {
    const errorMessage = 'Email already exists';
    mockSignUp.mockRejectedValue(new Error(errorMessage));
    renderAuthModals({ initialMode: 'signup' });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('shows loading state when submitting', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    renderAuthModals();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
  });

  test('shows loading state when auth context isLoading is true', () => {
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      signUp: mockSignUp,
      isLoading: true,
    });
    renderAuthModals();
    expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
  });

  test('resets form fields when modal opens', () => {
    const { rerender } = render(
      <AuthProvider>
        <AuthModals isOpen={false} onClose={onClose} />
      </AuthProvider>
    );
    // Modal closed, nothing to check
    rerender(
      <AuthProvider>
        <AuthModals isOpen={true} onClose={onClose} initialMode="signup" />
      </AuthProvider>
    );
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  test('displays demo info text', () => {
    renderAuthModals();
    expect(screen.getByText(/This is a demo application/)).toBeInTheDocument();
  });
});
