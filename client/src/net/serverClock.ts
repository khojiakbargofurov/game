/**
 * Server soati bilan farqni baholash (server_ms - client_ms).
 * Har bir snapshot namunasi = t_server - Date.now() = farq - kechikish.
 * Eng kam kechikishli namuna eng aniq, shuning uchun kattaroq namunaga darhol o'tamiz,
 * kichikroqlariga esa sekin moslashamiz (soat siljishi uchun).
 */
let offset = 0;
let initialized = false;

export function observeServerTime(serverT: number) {
  const sample = serverT - Date.now();
  if (!initialized || sample > offset) {
    offset = sample;
    initialized = true;
  } else {
    offset += (sample - offset) * 0.02;
  }
}

export const serverNow = () => Date.now() + offset;

export function resetServerClock() {
  initialized = false;
}
