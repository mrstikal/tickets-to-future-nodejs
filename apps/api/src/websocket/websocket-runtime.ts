import type { WebsocketBroadcaster } from '../types/runtime';

let websocketRuntime: WebsocketBroadcaster | null = null;
let isWebsocketRuntimeSet = false;

export function setWebsocketRuntime(runtime: WebsocketBroadcaster): void {
  if (isWebsocketRuntimeSet) {
    throw new Error('Websocket runtime has already been set and cannot be modified');
  }
  
  websocketRuntime = runtime;
  isWebsocketRuntimeSet = true;
}

export function getWebsocketRuntime(): WebsocketBroadcaster | null {
  return websocketRuntime;
}
