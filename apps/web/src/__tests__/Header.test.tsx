import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Header from '../components/Header';
import { vi } from 'vitest';
import { AuthProvider } from '@/features/auth-context';

// Mock dependencies
vi.mock('@/services/tickets-service', () => ({
  getHolds: (sessionId: string) => mockGetHolds(sessionId),
}));

vi.mock('@/hooks/use-session-websocket', () => ({
  useSessionWebsocket: (props: { onEvent: (event: unknown) => void }) => mockUseSessionWebsocket(props),
}));

vi.mock('@/lib/session', () => ({
  getOrCreateSessionId: () => mockGetOrCreateSessionId(),
}));

vi.mock('../components/AuthModals', () => ({
  default: ({ isOpen, onClose, initialMode }: { isOpen: boolean; onClose: () => void; initialMode: 'signin' | 'signup' }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="auth-modal" data-mode={initialMode}>
        <button onClick={onClose} data-testid="close-auth-modal">Close</button>
        <div>Auth Modal Content</div>
      </div>
    );
  },
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  },
}));

const mockGetHolds = vi.fn();
const mockGetOrCreateSessionId = vi.fn();
const mockUseSessionWebsocket = vi.fn();
const mockLogout = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('@/features/auth-context', async () => {
  const actual = await vi.importActual('@/features/auth-context');
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrCreateSessionId.mockReturnValue('test-session-id');
    mockGetHolds.mockResolvedValue([]);
    mockUseSessionWebsocket.mockImplementation(() => {});
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      discount: 0,
      logout: mockLogout,
    });
  });

  function renderHeader() {
    return render(
      <AuthProvider>
        <Header />
      </AuthProvider>
    );
  }

  test('renders logo and cart icon', () => {
    renderHeader();
    expect(screen.getByText('Tickets to Future')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '' })).toHaveAttribute('href', '/cart');
  });

  test('shows Sign In and Sign Up buttons when user is not authenticated', () => {
    // AuthProvider initially has no user (not authenticated)
    renderHeader();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });

  test('shows user name and Logout button when authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'john@example.com', name: 'John Doe', role: 'user', isActive: true, createdAt: '', updatedAt: '' },
      isAuthenticated: true,
      discount: 10,
      logout: vi.fn(),
    });

    renderHeader();
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign Up' })).not.toBeInTheDocument();
  });

  test('shows user email when name is not provided', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'john@example.com', role: 'user', isActive: true, createdAt: '', updatedAt: '' },
      isAuthenticated: true,
      discount: 10,
      logout: vi.fn(),
    });

    renderHeader();
    await waitFor(() => {
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });
  });

  test('shows discount badge when discount > 0', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'john@example.com', name: 'John', role: 'user', isActive: true, createdAt: '', updatedAt: '' },
      isAuthenticated: true,
      discount: 10,
      logout: vi.fn(),
    });

    renderHeader();
    await waitFor(() => {
      expect(screen.getByText('-10%')).toBeInTheDocument();
    });
  });

  test('does not show discount badge when discount = 0', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'john@example.com', name: 'John', role: 'user', isActive: true, createdAt: '', updatedAt: '' },
      isAuthenticated: true,
      discount: 0,
      logout: vi.fn(),
    });

    renderHeader();
    await waitFor(() => {
      expect(screen.queryByText('-10%')).not.toBeInTheDocument();
    });
  });

  test('opens Sign In modal when Sign In button is clicked', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
    expect(screen.getByTestId('auth-modal')).toHaveAttribute('data-mode', 'signin');
  });

  test('opens Sign Up modal when Sign Up button is clicked', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
    expect(screen.getByTestId('auth-modal')).toHaveAttribute('data-mode', 'signup');
  });

  test('calls logout when Logout button is clicked', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'john@example.com', name: 'John', role: 'user', isActive: true, createdAt: '', updatedAt: '' },
      isAuthenticated: true,
      discount: 10,
      logout: mockLogout,
    });

    renderHeader();
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    });
    expect(mockLogout).toHaveBeenCalled();
  });

  test('shows cart badge with hold count', async () => {
    mockGetHolds.mockResolvedValue([{ id: '1' }, { id: '2' }]);
    renderHeader();
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  test('does not show cart badge when count is 0', async () => {
    mockGetHolds.mockResolvedValue([]);
    renderHeader();
    await waitFor(() => {
      // The badge is only rendered when count > 0
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  test('calls getOrCreateSessionId on mount', () => {
    renderHeader();
    expect(mockGetOrCreateSessionId).toHaveBeenCalled();
  });

  test('calls getHolds with session id on mount', async () => {
    mockGetOrCreateSessionId.mockReturnValue('my-session');
    renderHeader();
    await waitFor(() => {
      expect(mockGetHolds).toHaveBeenCalledWith('my-session');
    });
  });

  test('sets up websocket subscription', () => {
    renderHeader();
    expect(mockUseSessionWebsocket).toHaveBeenCalled();
  });
});