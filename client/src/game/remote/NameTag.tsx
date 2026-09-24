import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

/** O'yinchi ismi — canvas'da chizilgan sprite (tashqi shrift/texture kerak emas) */
export function NameTag({ name, color }: { name: string; color: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(40, 28, 20, 0.65)';
    ctx.beginPath();
    ctx.roundRect(4, 8, 248, 48, 24);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(32, 32, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff5e6';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 52, 33, 190);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [name, color]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={[0, 2.4, 0]} scale={[3, 0.75, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}
