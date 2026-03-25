const { WebSocket } = require('ws');

async function createWsListener(config, channels) {
  const socket = new WebSocket(config.wsUrl);
  const events = [];

  await new Promise((resolve, reject) => {
    const onOpen = () => {
      socket.send(
        JSON.stringify({
          type: 'subscribe',
          channels,
        })
      );
      cleanup();
      resolve();
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      socket.off('open', onOpen);
      socket.off('error', onError);
    };

    socket.on('open', onOpen);
    socket.on('error', onError);
  });

  socket.on('message', (raw) => {
    try {
      const event = JSON.parse(raw.toString());
      events.push(event);
    } catch {
      // ignore non-json message
    }
  });

  const waitFor = (predicate, timeoutMs) => {
    const existing = events.find(predicate);
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for websocket event after ${timeoutMs}ms`));
      }, timeoutMs);

      const onMessage = (raw) => {
        try {
          const event = JSON.parse(raw.toString());
          if (predicate(event)) {
            clearTimeout(timer);
            socket.off('message', onMessage);
            resolve(event);
          }
        } catch {
          // ignore parse failure
        }
      };

      socket.on('message', onMessage);
    });
  };

  const close = () => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  };

  return {
    events,
    waitFor,
    close,
  };
}

module.exports = {
  createWsListener,
};

