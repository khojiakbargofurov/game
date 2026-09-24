import { create } from 'zustand';
import { DEFAULT_CAR, isCarId, type CarId } from '@game/shared';

const KEY = 'adventure-racer:car';

function load(): CarId {
  try {
    const v = localStorage.getItem(KEY);
    return isCarId(v) ? v : DEFAULT_CAR;
  } catch {
    return DEFAULT_CAR;
  }
}

/** Menyuda tanlangan mashina (brauzerda saqlanadi) */
export const useCarChoice = create<{ car: CarId; setCar: (car: CarId) => void }>((set) => ({
  car: load(),
  setCar: (car) => {
    try {
      localStorage.setItem(KEY, car);
    } catch {
      // xotira yopiq bo'lsa ham tanlov shu seansda ishlaydi
    }
    set({ car });
  },
}));
