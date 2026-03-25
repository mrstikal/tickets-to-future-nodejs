import type { Channel, ConsumeMessage } from 'amqplib';
import { logger } from '../lib/logger';
import type { OrderConfirmedMessage } from '../types/rabbitmq-messages';
import { delCachePattern } from '../lib/redis-cache';

const ORDER_CONFIRMED_QUEUE = 'order.confirmed.queue';

export async function startOrderConsumer(channel: Channel): Promise<string> {
  logger.info('Starting order.confirmed consumer');

  const onMessage = (msg: ConsumeMessage | null): void => {
    if (!msg) {
      return;
    }

    try {
      const body = JSON.parse(msg.content.toString()) as OrderConfirmedMessage;

      if (body.eventType !== 'order.confirmed') {
        throw new Error(`Unexpected event type: ${body.eventType}`);
      }

      // Audit log
      logger.info(`AUDIT: Order confirmed - ID: ${body.orderId}, Number: ${body.orderNumber}, Email: ${body.email}, Total: ${body.totalPrice} ${body.currency}`);

      // Simulate email notification
      logger.info(`EMAIL: Confirmation sent to ${body.email} for order ${body.orderNumber}`);

      // Analytics (sim)
      const key = `analytics:orders:confirmed:${body.currency || 'CZK'}`;
      logger.info(`Analytics counter incremented: ${ key}`);

      // Invalidate admin stats cache
      delCachePattern('admin:stats:*').then(() => {
        logger.info('Admin stats cache invalidated after order confirmation');
      }).catch((err) => {
        logger.error('Failed to invalidate admin stats cache', { error: err });
      });

      channel.ack(msg);
    } catch (error) {
      logger.error('Order confirmed handler failed', { error });
      channel.nack(msg, false, false); // Send to DLQ
    }
  };

  const { consumerTag } = await channel.consume(ORDER_CONFIRMED_QUEUE, onMessage);
  return consumerTag;
}
