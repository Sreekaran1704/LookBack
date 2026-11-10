import { ImageFormat, Skia, TileMode } from '@shopify/react-native-skia';
import { writePhotoBytes } from '../data/photoStore';
import { mulberry32 } from '../lib/seeded';

/**
 * DEV ONLY. Paints a small illustrated "photo" (sky, sun, hills) with Skia offscreen and saves it as a
 * JPEG in app storage, so seeded photo entries have something to show. Returns the relative path.
 */
const SIZE = 480;
const JPEG_QUALITY = 82;

const SKIES: [string, string, string][] = [
  ['#FF9A8B', '#FFD3A5', '#5B3A6E'],
  ['#5EC8E5', '#C9F0FF', '#2E6B4F'],
  ['#2B1B4F', '#F08A5D', '#1E2A3A'],
  ['#A1C4FD', '#FDE2E4', '#4F7C5A'],
  ['#FFB75E', '#FFF1C1', '#7A4B2A'],
];

export function generateSeedPhoto(name: string, seed: number): string | null {
  const surface = Skia.Surface.Make(SIZE, SIZE);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const rnd = mulberry32(seed);
  const [top, bottom, land] = SKIES[seed % SKIES.length] ?? SKIES[0]!;

  const sky = Skia.Paint();
  sky.setShader(
    Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: SIZE }, [Skia.Color(top), Skia.Color(bottom)], null, TileMode.Clamp),
  );
  canvas.drawRect(Skia.XYWHRect(0, 0, SIZE, SIZE), sky);

  const sun = Skia.Paint();
  sun.setColor(Skia.Color('#FFF6D8'));
  sun.setAlphaf(0.9);
  canvas.drawCircle(SIZE * (0.25 + rnd() * 0.5), SIZE * (0.3 + rnd() * 0.2), SIZE * (0.08 + rnd() * 0.06), sun);

  // Two layers of rolling hills.
  for (let layer = 0; layer < 2; layer++) {
    const path = Skia.PathBuilder.Make();
    const base = SIZE * (0.62 + layer * 0.12);
    path.moveTo(0, SIZE);
    path.lineTo(0, base);
    const bumps = 3 + Math.floor(rnd() * 3);
    for (let i = 1; i <= bumps; i++) {
      const x = (SIZE / bumps) * i;
      path.quadTo(x - SIZE / bumps / 2, base - SIZE * (0.06 + rnd() * 0.12), x, base);
    }
    path.lineTo(SIZE, SIZE);
    path.close();
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(land));
    paint.setAlphaf(layer === 0 ? 0.6 : 1);
    canvas.drawPath(path.detach(), paint);
  }

  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, JPEG_QUALITY);
  return writePhotoBytes(name, bytes);
}
