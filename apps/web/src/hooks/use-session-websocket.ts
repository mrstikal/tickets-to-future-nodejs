'use client';

import { useEffect, useRef } from 'react';
import { config } from '@/lib/config';
import { getOrCreateSessionId } from '@/lib/session';
import type { WebsocketEvent } from '@/types/tickets';

type UseSessionWebsocketProps = {
  onEvent: (event: WebsocketEvent) => void;
};

export function useSessionWebsocket({ onEvent }: UseSessionWebsocketProps): void {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const sessionId = getOrCreateSessionId();

  // Update ref when callback changes, without triggering effect
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let isMounted = true;
    const wsUrl = `${config.wsBaseUrl}/ws/v1`;
    console.log('[WS] Connecting to:', wsUrl);
    
    const ws = new WebSocket(wsUrl);

    const handleOpen = () => {
      if (!isMounted) return;
      console.log('[WS] Connected, subscribing to channels');
      ws.send(JSON.stringify({
        type: 'subscribe',
        channels: [`session.${sessionId}`],
      }));
    };

    const handleMessage = (event: MessageEvent) => {
      if (!isMounted) return;
      const data = JSON.parse(event.data);
      if (data.type === 'hold.updated' && data.sessionId === sessionId) {
        onEventRef.current(data);
      }
    };

    const handleClose = () => {
      if (!isMounted) return;
      console.log('[WS] Session WS closed');
    };

    const handleError = (error: Event) => {
      // In dev StrictMode se první mount ihned cleanupne; jeho WS error nebereme jako reálný problém.
      if (!isMounted) return;
      console.error('[WS] Session WS error occurred:', {
        error,
        url: wsUrl,
        readyState: ws.readyState,
      });
    };

    ws.addEventListener('open', handleOpen);
    ws.addEventListener('message', handleMessage);
    ws.addEventListener('close', handleClose);
    ws.addEventListener('error', handleError);

    wsRef.current = ws;

    return () => {
      isMounted = false;
      ws.removeEventListener('open', handleOpen);
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('close', handleClose);
      ws.removeEventListener('error', handleError);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [sessionId]);
}