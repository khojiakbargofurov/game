/**
 * O'yindagi tashqi resurslar mualliflari (menyu → "Mualliflar" va README).
 * Sketchfab modellari odatda CC-BY: muallif nomi va havolasi ko'rsatilishi shart —
 * `author` / `url` / `license` bo'sh bo'lganlarini model sahifasidan to'ldiring.
 */
export interface Credit {
  /** O'yinda nima uchun ishlatilgan */
  what: string;
  /** Asl nomi */
  title: string;
  author: string;
  license: string;
  url?: string;
}

export const CREDITS: Credit[] = [
  {
    what: 'Gran Pri trassasi: yo\'l plitkalari, tribunalar, pit binolari, chodirlar, daraxtlar',
    title: 'Racing Kit',
    author: 'Kenney',
    license: 'CC0 1.0',
    url: 'https://kenney.nl/assets/racing-kit',
  },
  { what: 'Superkar', title: 'CAR Model', author: 'Ignition Labs', license: '', url: '' },
  { what: 'Rally', title: 'Evo Rally Car', author: '', license: '', url: '' },
  {
    what: 'Sport, Kupe, Sedan, Kompakt, Xetchbek, Universal, Miniven, Jip, Offroad, Pikap',
    title: 'Generic Passenger Car Pack',
    author: '',
    license: '',
    url: '',
  },
];
