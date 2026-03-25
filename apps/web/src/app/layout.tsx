import './globals.css';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';

import Header from '@/components/Header';
import { AuthProvider } from '@/features/auth-context';
import type { User } from '@/types/auth';

export const metadata = {
  title: 'Tickets to Future',
  description: 'Fun ticket selling tech demo',
};

type RootLayoutProps = {
  children: ReactNode;
};

async function getInitialUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const authToken = cookieStore.get('auth_token')?.value;

  if (!authToken) {
    return null;
  }

  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
      headers: {
        Cookie: `auth_token=${authToken}`,
      },
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      return data as User;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function RootLayout({
                                     children,
                                   }: RootLayoutProps): Promise<React.JSX.Element> {
  const initialUser = await getInitialUser();

  return (
    <html lang="en">
    <body>
      <AuthProvider initialUser={initialUser}>
        <Header />
        {children}
      </AuthProvider>
    </body>
    </html>
  );
}
