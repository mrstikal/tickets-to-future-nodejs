'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { getOrCreateSessionId } from '@/lib/session';
import { useCountdown } from '@/hooks/use-countdown';
import { useTicketWebsocket } from '@/hooks/use-ticket-websocket';
import { cancelHold, createHold } from '@/services/tickets-service';
import { useAuth } from '@/features/auth-context';
import { calculateDiscountedPrice } from '@/lib/discount';
import type { Hold, Ticket, WebsocketEvent } from '@/types/tickets';

type TicketDetailClientProps = {
  initialTicket: Ticket;
};

export function TicketDetailClient({
  initialTicket,
}: TicketDetailClientProps): React.JSX.Element {
  const [ticket, setTicket] = useState<Ticket>(initialTicket);
  const [hold, setHold] = useState<Hold | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isAuthenticated, discount } = useAuth();

  const ticketRef = useRef(ticket);
  const holdRef = useRef(hold);

  // Keep refs in sync
  useEffect(() => {
    ticketRef.current = ticket;
  }, [ticket]);

  useEffect(() => {
    holdRef.current = hold;
  }, [hold]);

  const remainingSeconds = useCountdown(hold?.expiresAt);

  const handleWebsocketEvent = useCallback(
    (event: WebsocketEvent) => {
      if (
        event.type === 'ticket.availability.updated' &&
        event.ticketId === ticketRef.current.id
      ) {
        setTicket((current: Ticket) => ({
          ...current,
          availableQuantity: event.availableQuantity,
          soldQuantity: event.soldQuantity,
          activeHolds: event.activeHolds,
        }));
      }

      if (
        event.type === 'ticket.hold.expired' &&
        event.ticketId === ticketRef.current.id &&
        holdRef.current &&
        event.holdId === holdRef.current.id
      ) {
        setHold(null);
      }
    },
    []
  );

  useTicketWebsocket({
    ticketId: ticket.id,
    onEvent: handleWebsocketEvent,
  });

  const formattedCountdown = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }, [remainingSeconds]);

  const handleReserve = async (): Promise<void> => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const sessionId = getOrCreateSessionId();
      const nextHold = await createHold({
        ticketId: ticket.id,
        sessionId,
      });

      setHold(nextHold);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to reserve ticket.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (): Promise<void> => {
    if (!hold) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await cancelHold(hold.id);
      setHold(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to cancel hold.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const discountedPrice = calculateDiscountedPrice(ticket.price);
  const hasDiscount = isAuthenticated && discount > 0;

  return (
    <div className="surface p-7">
      <p className="kicker">Ticket detail</p>

      <h1 className="mb-3 text-4xl font-black text-white">{ticket.title}</h1>

      <p className="text-muted mb-5 text-[17px] leading-8">
        {ticket.description}
      </p>

      <div className="surface-muted mb-6 grid gap-3 p-4">
        <div>
          <strong>Price:</strong>
          {hasDiscount ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">
                -{discount}%
              </span>
              <span className="text-lg line-through text-gray-400">
                {ticket.price} {ticket.currency}
              </span>
              <span className="text-xl font-bold text-emerald-400">
                {discountedPrice} {ticket.currency}
              </span>
            </div>
          ) : (
            <span className="text-lg"> {ticket.price} {ticket.currency}</span>
          )}
        </div>
        <div>
          <strong>Available:</strong> {ticket.availableQuantity}
        </div>
        <div>
          <strong>Sold:</strong> {ticket.soldQuantity}
        </div>
        <div>
          <strong>Active holds:</strong> {ticket.activeHolds}
        </div>
      </div>

      {hold ? (
        <div className="mb-5 rounded-2xl border border-green-400/35 bg-green-500/10 p-4">
          <div className="mb-2 font-bold">Ticket reserved</div>
          <div className="mb-2">
            Your reservation expires in <strong>{formattedCountdown}</strong>
          </div>
          <div className="text-subtle break-all text-xs">Hold ID: {hold.id}</div>

          <Link
            href={`/cart?holdId=${hold.id}`}
            className="btn-primary mt-4 inline-block"
          >
            Continue to cart
          </Link>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-red-400/35 bg-red-500/10 p-3 text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={
            isSubmitting || ticket.availableQuantity <= 0 || hold?.status === 'active'
          }
          onClick={handleReserve}
          className="btn-primary"
        >
          {isSubmitting ? 'Working...' : 'Reserve ticket'}
        </button>

        <button
          type="button"
          disabled={isSubmitting || !hold}
          onClick={handleCancel}
          className="btn-secondary"
        >
          Cancel hold
        </button>
      </div>
    </div>
  );
}