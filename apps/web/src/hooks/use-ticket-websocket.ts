'use client';

import { useEffect, useRef } from 'react';
import { config } from '@/lib/config';
import type { WebsocketEvent } from '@/types/tickets';

type UseTicketWebsocketParams = {
  ticketId: string;
  onEvent: (event: WebsocketEvent) => void;
};

export function useTicketWebsocket({
                                     ticketId,
                                     onEvent,
                                   }: UseTicketWebsocketParams): void {
  const onEventRef = useRef(onEvent);

  // Update ref when callback changes, without triggering effect
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let isMounted = true;
    const wsUrl = `${config.wsBaseUrl}/ws/v1`;
    console.log('[WS Ticket] Connecting to:', wsUrl);
    
    const socket = new WebSocket(wsUrl);

    const handleOpen = () => {
      if (!isMounted) return;
      console.log('[WS Ticket] Connected, subscribing to channels');
      socket.send(
        JSON.stringify({
          type: 'subscribe',
          channels: ['tickets', `ticket:${ticketId}`],
        })
      );
    };

    const handleMessage = (event: MessageEvent) => {
      if (!isMounted) return;
      try {
        const parsed = JSON.parse(event.data) as WebsocketEvent;
        onEventRef.current(parsed);
      } catch {
        // ignore invalid payload
      }
    };

    const handleError = (error: Event) => {
      // In dev StrictMode se první mount ihned cleanupne; jeho WS error nebereme jako reálný problém.
      if (!isMounted) return;
      console.error('[WS Ticket] WebSocket error:', {
        error,
        url: wsUrl,
        readyState: socket.readyState,
      });
    };

    const handleClose = () => {
      if (!isMounted) return;
      console.log('[WS Ticket] WebSocket closed');
    };

    socket.addEventListener('open', handleOpen);
    socket.addEventListener('message', handleMessage);
    socket.addEventListener('error', handleError);
    socket.addEventListener('close', handleClose);

    return () => {
      isMounted = false;
      socket.removeEventListener('open', handleOpen);
      socket.removeEventListener('message', handleMessage);
      socket.removeEventListener('error', handleError);
      socket.removeEventListener('close', handleClose);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, [ticketId]);
}