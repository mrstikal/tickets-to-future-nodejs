const amqp = require('amqplib');

const EXCHANGE = 'tickets.events';

async function createRabbitListener(config, routingKey = 'order.confirmed') {
  const connection = await amqp.connect(config.rabbitmqUrl);
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  const queueResult = await channel.assertQueue('', {
    exclusive: true,
    autoDelete: true,
  });

  await channel.bindQueue(queueResult.queue, EXCHANGE, routingKey);

  const events = [];

  await channel.consume(
    queueResult.queue,
    (message) => {
      if (!message) {
        return;
      }

      try {
        const parsed = JSON.parse(message.content.toString());
        events.push(parsed);
      } catch {
        // ignore invalid payload
      } finally {
        channel.ack(message);
      }
    },
    { noAck: false }
  );

  const waitFor = (predicate, timeoutMs) => {
    const existing = events.find(predicate);
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const found = events.find(predicate);
        if (found) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve(found);
        }
      }, 100);

      const timer = setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`Timed out waiting for RabbitMQ event after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  };

  const close = async () => {
    await channel.close();
    await connection.close();
  };

  return {
    events,
    waitFor,
    close,
  };
}

module.exports = {
  createRabbitListener,
};

