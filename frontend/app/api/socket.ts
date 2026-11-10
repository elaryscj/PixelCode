// app/api/socket.ts
// WebSocket (STOMP) endpoints of game-backend:
//   WebSocketConfig:      endpoint "/ws", app prefix "/app", broker "/topic"
//   WebSocketController:  @MessageMapping("/hello"), @MessageMapping("/ready")
import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import { useEffect, useState } from "react";

// ---- Destinations ----
export const WS = {
  send: {
    move: "/app/game/move",
  },
  topic: {
    room: (code: string) => `/topic/room/${code}`,
    game: (code: string) => `/topic/room/${code}/game`,
  },
} as const;

/** Lobby events from /topic/room/{code} */
export type RoomEvent = {
  type: "PLAYER_JOINED" | "PLAYER_READY" | "PLAYER_LEFT" | "GAME_STARTED" | "MATCH_CANCELLED" | "ROOM_CLOSED";
};

// ---- URL ----
// Dev: Vite proxies /ws -> ws://localhost:8080/ws (see vite.config.ts).
// Prod: set VITE_WS_URL, e.g. "wss://api.example.com/ws".
function getWsUrl() {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined;
  if (fromEnv) return fromEnv;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

// ---- Singleton STOMP client (browser only) ----
let client: Client | null = null;

export function getClient(): Client {
  if (typeof window === "undefined") {
    throw new Error("STOMP client is browser-only (don't call it during SSR)");
  }
  if (!client) {
    client = new Client({
      brokerURL: getWsUrl(),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: import.meta.env.DEV ? (m) => console.debug("[stomp]", m) : () => {},
    });
  }
  if (!client.active) client.activate();
  return client;
}

export function disconnect() {
  void client?.deactivate();
  client = null;
}

/** Wait until the STOMP session is established */
function whenConnected(c: Client): Promise<void> {
  if (c.connected) return Promise.resolve();
  return new Promise((resolve) => {
    const prev = c.onConnect;
    c.onConnect = (frame) => {
      prev?.(frame);
      resolve();
    };
  });
}

function parse<T>(msg: IMessage): T {
  try {
    return JSON.parse(msg.body) as T;
  } catch {
    return msg.body as unknown as T;
  }
}

/**
 * Subscribe to a topic. Re-subscribes automatically after reconnect.
 * Returns an unsubscribe function.
 */
export function subscribe<T>(destination: string, handler: (data: T) => void): () => void {
  const c = getClient();
  let sub: StompSubscription | null = null;
  let closed = false;

  const doSubscribe = () => {
    if (closed) return;
    sub = c.subscribe(destination, (msg) => handler(parse<T>(msg)));
  };

  if (c.connected) doSubscribe();

  // stompjs drops subscriptions on reconnect — restore them
  const prev = c.onConnect;
  c.onConnect = (frame) => {
    prev?.(frame);
    doSubscribe();
  };

  return () => {
    closed = true;
    try {
      sub?.unsubscribe();
    } catch {
      /* already disconnected */
    }
  };
}

/** SEND a JSON body to an /app/... destination */
export async function send(destination: string, body?: unknown) {
  const c = getClient();
  await whenConnected(c);
  c.publish({
    destination,
    body: body === undefined ? "" : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

// ---- Endpoint functions ----

/** Position + heartbeat (also proves to the server that this player is present) */
export function sendMove(token: string, roomCode: string, x: number, y: number) {
  return send(WS.send.move, { token, roomCode, x, y });
}

export function onRoomEvent(code: string, handler: (e: RoomEvent) => void) {
  return subscribe<RoomEvent>(WS.topic.room(code), handler);
}

export function onGameEvent(code: string, handler: (e: any) => void) {
  return subscribe<any>(WS.topic.game(code), handler);
}

/** Live lobby updates: returns the last event so the page can refresh immediately. */
export function useRoomSocket(code: string | undefined) {
  const [lastEvent, setLastEvent] = useState<RoomEvent | null>(null);
  useEffect(() => {
    if (!code) return;
    return onRoomEvent(code, (e) => setLastEvent({ ...e }));
  }, [code]);
  return { lastEvent };
}
