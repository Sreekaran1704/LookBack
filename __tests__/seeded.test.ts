import { describe, expect, test } from '@jest/globals';
import { hashString, lookForEntry, mulberry32, raggedOffsets, seededRng } from '../src/lib/seeded';
import { STYLE_PALETTES, mixHex, paletteByName, yearPalette, yearPaletteIndex, withAlpha } from '../src/theme/yearColors';

const textEntry = (id: string, text = 'A short note') => ({ id, text, photoPath: null });
const photoEntry = (id: string) => ({ id, text: '', photoPath: 'photos/a.jpg' });

describe('seeded randomness', () => {
  test('hash and rng are deterministic', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  test('rng values stay in range', () => {
    const rng = seededRng('range');
    for (let i = 0; i < 200; i++) {
      const v = rng.range(-4, 4);
      expect(v).toBeGreaterThanOrEqual(-4);
      expect(v).toBeLessThan(4);
    }
  });

  test('ragged offsets are stable and bounded', () => {
    expect(raggedOffsets(7, 5, 10)).toEqual(raggedOffsets(7, 5, 10));
    expect(raggedOffsets(7, 20, 10).every((v) => v >= 0 && v < 10)).toBe(true);
  });
});

describe('lookForEntry', () => {
  test('same id gives the same look every time', () => {
    expect(lookForEntry(textEntry('id-1'))).toEqual(lookForEntry(textEntry('id-1')));
  });

  test('different ids vary', () => {
    const looks = Array.from({ length: 40 }, (_, i) => lookForEntry(textEntry(`id-${i}`)));
    expect(new Set(looks.map((l) => l.tilt.toFixed(3))).size).toBeGreaterThan(30);
    expect(new Set(looks.map((l) => l.objectType))).toEqual(new Set(['ticket', 'tornNote']));
  });

  test('tilt and offsets stay within limits', () => {
    for (let i = 0; i < 100; i++) {
      const look = lookForEntry(textEntry(`t-${i}`), 4, 10);
      expect(Math.abs(look.tilt)).toBeLessThanOrEqual(4);
      expect(Math.abs(look.offsetX)).toBeLessThanOrEqual(10);
    }
  });

  test('photos become photo objects, text never does', () => {
    for (let i = 0; i < 50; i++) {
      expect(['polaroid', 'tapedPhoto']).toContain(lookForEntry(photoEntry(`p-${i}`)).objectType);
      expect(['ticket', 'tornNote']).toContain(lookForEntry(textEntry(`n-${i}`)).objectType);
    }
  });

  test('long text is always a torn note', () => {
    const long = 'x'.repeat(200);
    for (let i = 0; i < 30; i++) expect(lookForEntry(textEntry(`l-${i}`, long)).objectType).toBe('tornNote');
  });

  test('stored style fields override the seed when they fit', () => {
    const look = lookForEntry({ ...textEntry('o-1'), objectType: 'ticket', tapePattern: 'floral', sticker: 'moon' });
    expect(look.objectType).toBe('ticket');
    expect(look.tapePattern).toBe('floral');
    expect(look.sticker).toBe('moon');
    expect(lookForEntry({ ...textEntry('o-2'), sticker: 'none' }).sticker).toBeNull();
  });

  test('incompatible or unknown overrides fall back to the seed', () => {
    const seeded = lookForEntry(textEntry('o-3'));
    const look = lookForEntry({ ...textEntry('o-3'), objectType: 'polaroid', tapePattern: 'plaid', sticker: 'dragon' });
    expect(look).toEqual(seeded);
  });

  test('an override does not change the rest of the look', () => {
    const seeded = lookForEntry(textEntry('o-4'));
    const look = lookForEntry({ ...textEntry('o-4'), tapePattern: 'dots' });
    expect({ ...look, tapePattern: seeded.tapePattern, fastener: seeded.fastener }).toEqual(seeded);
  });

  test('a chosen tape (pattern or color) is always what holds the object', () => {
    for (let i = 0; i < 40; i++) {
      expect(lookForEntry({ ...textEntry(`t-${i}`), tapePattern: 'zigzag' }).fastener).toBe('tape');
      expect(lookForEntry({ ...textEntry(`c-${i}`), tapeColor: 'sky' }).fastener).toBe('tape');
    }
  });
});

describe('year colors', () => {
  test('brief mapping: 2025 coral, 2024 teal, 2023 amber, 2022 violet, 2021 lime', () => {
    expect([2025, 2024, 2023, 2022, 2021].map((y) => yearPalette(y).name)).toEqual([
      'coral',
      'teal',
      'amber',
      'violet',
      'lime',
    ]);
  });

  test('palette repeats for other years', () => {
    expect(yearPalette(2026).name).toBe('lime');
    expect(yearPalette(2020).name).toBe('coral');
    expect(yearPaletteIndex(1900)).toBeGreaterThanOrEqual(0);
  });

  test('withAlpha', () => {
    expect(withAlpha('#FF0000', 0.5)).toBe('#FF000080');
    expect(withAlpha('#FF0000', 1)).toBe('#FF0000ff');
  });
});

describe('style colors', () => {
  test('mixHex blends between two colors', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
  test('every style color can be found by name, unknown names fall back to null', () => {
    for (const p of STYLE_PALETTES) expect(paletteByName(p.name)).toBe(p);
    expect(new Set(STYLE_PALETTES.map((p) => p.name)).size).toBe(STYLE_PALETTES.length);
    expect(paletteByName('plaid')).toBeNull();
    expect(paletteByName(null)).toBeNull();
  });
});
