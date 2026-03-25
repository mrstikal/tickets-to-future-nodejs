import type { Channel } from 'amqplib';
import { logger } from '../lib/logger';
import type { HoldExpiredMessage } from '../types/rabbitmq-messages';

const HOLD_EXPIRED_QUEUE = 'hold.expired.queue';

export async function startHoldExpiredConsumer(channel: Channel): Promise<string> {
  logger.info('Starting hold.expired consumer');
  const { consumerTag } = await channel.consume(HOLD_EXPIRED_QUEUE, async (msg) => {
    if (!msg) {
      return;
    }

    try {
      const body: HoldExpiredMessage = JSON.parse(msg.content.toString());

      if (body.eventType !== 'hold.expired') {
        throw new Error(`Unexpected event type: ${body.eventType}`);
      }

      // Audit log
      logger.info(`AUDIT: Hold expired - ID: ${body.holdId}, Ticket ID: ${body.ticketId}, Session: ${body.sessionId}`);

      // Analytics counter (sim)
      const key = `analytics:holds:expired`;
      logger.info(`Analytics counter incremented: ${key}`);

      channel.ack(msg);
    } catch (error) {
      logger.error('Hold expired handler failed', { error });
      channel.nack(msg, false, false); // Send to DLQ
    }
  });
  return consumerTag;
}
