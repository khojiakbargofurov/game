import { io, type Socket } from 'socket.io-client';
import { NET, type ClientToServerEvents, type ServerToClientEvents } from '@game/shared';

/** Server manzili: VITE_SERVER_URL yoki dev'da shu host'ning 3001-porti */
const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ?? `${location.protocol}//${location.hostname}:${NET.DEFAULT_PORT}`;

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const socket: GameSocket = io(SERVER_URL, {
  // Server o'chiq bo'lsa ham yakka rejim ishlayveradi — qayta ulanish fonda
  reconnectionDelayMax: 5000,
});
