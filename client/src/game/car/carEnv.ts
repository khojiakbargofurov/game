import { PMREMGenerator, type MeshStandardMaterial, type Texture, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Mashinalar uchun atrof-muhit aksi (environment map). Busiz metall (xrom, oltin) va hatto oddiy lakli kuzov
 * ham faqat quyosh nurini aks ettirib, soyada qop-qora chiqardi. Faqat mashina materiallariga beriladi —
 * relyef, yo'l va jihozlarning low-poly ko'rinishi o'zgarmaydi.
 * Tekstura renderer'ga bog'liq: Canvas qayta yaratilsa (antialias o'zgarsa) — qaytadan yasaladi.
 */

let env: Texture | null = null;
let owner: WebGLRenderer | null = null;
const materials = new Set<MeshStandardMaterial>();

/** Materialni ro'yxatga olish: aks tayyor bo'lsa darhol, bo'lmasa tayyor bo'lganda beriladi */
export function withCarEnv<T extends MeshStandardMaterial>(material: T, intensity: number): T {
  material.envMapIntensity = intensity;
  materials.add(material);
  if (env) {
    material.envMap = env;
    material.needsUpdate = true;
  }
  return material;
}

/** Scene ichidan chaqiriladi (renderer kerak) */
export function initCarEnv(gl: WebGLRenderer) {
  if (owner === gl && env) return;
  env?.dispose();
  const pmrem = new PMREMGenerator(gl);
  env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  owner = gl;
  for (const m of materials) {
    m.envMap = env;
    m.needsUpdate = true;
  }
}
