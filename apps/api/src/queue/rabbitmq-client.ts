import amqp, { Channel, ChannelModel } from 'amqplib';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import type { RabbitmqRuntime } from '../types/runtime';
import { startOrderConsumer } from './order-consumer';
import { startHoldExpiredConsumer } from './hold-consumer';

const EVENTS_EXCHANGE = 'tickets.events';

const DLX_EXCHANGE = 'tickets.dlx';

const ORDER_CONFIRMED_QUEUE = 'order.confirmed.queue';
const ORDER_CONFIRMED_DLQ = 'order.confirmed.dlq';

const HOLD_EXPIRED_QUEUE = 'hold.expired.queue';
const HOLD_EXPIRED_DLQ = 'hold.expired.dlq';

export function createRabbitmqRuntime(): RabbitmqRuntime | null {
  if (!env.rabbitmqUrl) {
    logger.info('RabbitMQ URL is not configured');
    return null;
  }

  let connection: ChannelModel | null = null;
  let channel: Channel | null = null;
  let connectionState = 'disconnected';
  let consumerTags: string[] = [];

  return {
    name: 'rabbitmq',
    async connect() {
      const nextConnection = await amqp.connect(env.rabbitmqUrl);
      const nextChannel = await nextConnection.createChannel();

      await nextChannel.assertExchange(EVENTS_EXCHANGE, 'topic', {
        durable: true,
      });

      // Setup DLX
      await nextChannel.assertExchange(DLX_EXCHANGE, 'fanout', {
        durable: true,
      });

      // DLQs
      await nextChannel.assertQueue(ORDER_CONFIRMED_DLQ, { durable: true });
      await nextChannel.assertQueue(HOLD_EXPIRED_DLQ, { durable: true });

      // Main queues with DL policy
      await nextChannel.assertQueue(ORDER_CONFIRMED_QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': DLX_EXCHANGE,
          'x-dead-letter-routing-key': ORDER_CONFIRMED_DLQ,
          'x-message-ttl': 300000, // 5 min TTL for retry
        },
      });

      await nextChannel.assertQueue(HOLD_EXPIRED_QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': DLX_EXCHANGE,
          'x-dead-letter-routing-key': HOLD_EXPIRED_DLQ,
          'x-message-ttl': 300000,
        },
      });

      // Bindings
      await nextChannel.bindQueue(ORDER_CONFIRMED_QUEUE, EVENTS_EXCHANGE, 'order.confirmed');
      await nextChannel.bindQueue(HOLD_EXPIRED_QUEUE, EVENTS_EXCHANGE, 'hold.expired');

      connection = nextConnection;
      channel = nextChannel;
      connectionState = 'ok';

      connection.on('error', (error) => {
        connectionState = 'error';
        logger.error('RabbitMQ connection error', error);
      });

      connection.on('close', () => {
        connectionState = 'disconnected';
        logger.info('RabbitMQ connection closed');
      });

      channel.on('error', (error) => {
        connectionState = 'error';
        logger.error('RabbitMQ channel error', error);
      });

      channel.on('close', () => {
        if (connectionState !== 'error') {
          connectionState = 'disconnected';
        }
        logger.info('RabbitMQ channel closed');
      });
    },
    async checkHealth() {
      if (!connection || !channel) {
        return 'disconnected';
      }

      return connectionState;
    },
    getChannel() {
      return channel;
    },
    async startConsumers() {
      if (!channel) {
        throw new Error('RabbitMQ channel not connected');
      }
      logger.info('Starting RabbitMQ consumers');
      const orderTag = await startOrderConsumer(channel);
      const holdTag = await startHoldExpiredConsumer(channel);
      consumerTags = [orderTag, holdTag];
    },
    async stopConsumers() {
      logger.info('Stopping RabbitMQ consumers');
      for (const tag of consumerTags) {
        await channel?.cancel(tag);
      }
      consumerTags = [];
    },
    async close() {
      await this.stopConsumers();
      if (channel) {
        await channel.close();
        channel = null;
      }

      if (connection) {
        await connection.close();
        connection = null;
      }

      connectionState = 'disconnected';
    },
  };
}