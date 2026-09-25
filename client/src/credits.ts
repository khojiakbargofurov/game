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
    what: 'Sport, Kupe, Sedan',
    title: 'Generic Passenger Car Pack',
    author: '',
    license: '',
    url: '',
  },
  {
    what: 'F1',
    title: 'McLaren F1',
    author: 'Alex.Ka.',
    license: 'CC BY-NC 4.0',
    url: 'https://sketchfab.com/3d-models/mclaren-f1-d96ebc208df54311964cad24f83e1656',
  },
  {
    what: 'F1 LM',
    title: '1996 McLaren F1 LM - Patrol',
    author: 'Ddiaz Design',
    license: 'CC BY-NC-SA 4.0',
    url: 'https://sketchfab.com/3d-models/1996-mclaren-f1-lm-patrol-fd1ec456a4b04d3c84a1cb065f52d8c1',
  },
  {
    what: '488 Pista',
    title: 'Ferrari 488 Pista Widebody',
    author: 'Dev365TH',
    license: 'CC BY 4.0',
    url: 'https://sketchfab.com/3d-models/ferrari-488-pista-widebody-16c28f5b3ed24991ac3d1208f4a8bc1f',
  },
  {
    what: 'SF90 XX',
    title: '2023 Ferrari SF90 XX Stradale',
    author: 'Ddiaz Design',
    license: 'CC BY 4.0',
    url: 'https://sketchfab.com/3d-models/2023-ferrari-sf90-xx-stradale-2c80c667232544649328cf3589921bcd',
  },
  {
    what: 'Bolide',
    title: '2020 Bugatti Bolide Concept',
    author: 'Ddiaz Design',
    license: 'CC BY-NC-SA 4.0',
    url: 'https://sketchfab.com/3d-models/2020-bugatti-bolide-concept-658684653b154ffba72d5f9511312ca8',
  },
  {
    what: 'Tourbillon',
    title: '2026 Bugatti Tourbillon',
    author: 'Ddiaz Design',
    license: 'CC BY-NC-SA 4.0',
    url: 'https://sketchfab.com/3d-models/2026-bugatti-tourbillon-4f63f5a74611477989cefd9861b9784a',
  },
];
