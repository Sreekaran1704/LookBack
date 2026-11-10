import { describe, expect, test } from '@jest/globals';
import { BACKUP_VERSION, buildManifest, mergeEntries, parseManifest, planPhotos, type BackupEntry } from '../src/lib/backup';

function entry(id: string, localDate: string, updatedAt: string, extra: Partial<BackupEntry> = {}): BackupEntry {
  return { id, localDate, text: id, photoPath: null, createdAt: updatedAt, updatedAt, objectType: null, tapePattern: null, sticker: null, stickerColor: null, tapeColor: null, ...extra };
}

describe('manifest', () => {
  test('round-trips entries, oldest day first', () => {
    const manifest = buildManifest([entry('b', '2025-03-02', 't2'), entry('a', '2025-01-01', 't1')], 'now');
    const parsed = parseManifest(JSON.stringify(manifest));
    expect(parsed.version).toBe(BACKUP_VERSION);
    expect(parsed.entries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(parsed.entries[0]).toEqual(entry('a', '2025-01-01', 't1'));
  });
  test('rejects other files and newer versions', () => {
    expect(() => parseManifest('not json')).toThrow();
    expect(() => parseManifest('{"hello":1}')).toThrow('not a LookBack backup');
    expect(() => parseManifest(JSON.stringify({ version: BACKUP_VERSION + 1, entries: [] }))).toThrow('newer version');
  });
  test('skips rows it cannot store instead of failing', () => {
    const json = JSON.stringify({ version: 1, entries: [entry('ok', '2025-01-01', 't'), { id: 'bad', localDate: '2025-13-40' }, null] });
    expect(parseManifest(json).entries.map((e) => e.id)).toEqual(['ok']);
  });
});

describe('mergeEntries', () => {
  test('first backup: everything goes up, nothing changes on the phone', () => {
    const plan = mergeEntries([entry('a', '2025-01-01', 't1')], []);
    expect(plan.writeLocal).toEqual([]);
    expect(plan.removeLocal).toEqual([]);
    expect(plan.remoteChanged).toBe(true);
  });
  test('restore to a new phone: everything comes down, backup untouched', () => {
    const remote = [entry('a', '2025-01-01', 't1'), entry('b', '2025-01-02', 't1')];
    const plan = mergeEntries([], remote);
    expect(plan.writeLocal.map((e) => e.id)).toEqual(['a', 'b']);
    expect(plan.remoteChanged).toBe(false);
  });
  test('already in sync: nothing to do', () => {
    const both = [entry('a', '2025-01-01', 't1')];
    expect(mergeEntries(both, both)).toMatchObject({ writeLocal: [], removeLocal: [], remoteChanged: false });
  });
  test('same entry edited on both sides: the later edit wins', () => {
    const plan = mergeEntries([entry('a', '2025-01-01', '2025-01-01T10:00:00Z')], [entry('a', '2025-01-01', '2025-01-02T10:00:00Z', { text: 'newer' })]);
    expect(plan.writeLocal.map((e) => e.text)).toEqual(['newer']);
    expect(plan.remoteChanged).toBe(false);
    const reverse = mergeEntries([entry('a', '2025-01-01', '2025-01-03T10:00:00Z', { text: 'phone' })], [entry('a', '2025-01-01', '2025-01-02T10:00:00Z')]);
    expect(reverse.writeLocal).toEqual([]);
    expect(reverse.remoteChanged).toBe(true);
  });
  test('same day written on two phones: one entry per day, the later one', () => {
    const plan = mergeEntries([entry('phone', '2025-01-01', '2025-01-01T10:00:00Z')], [entry('other', '2025-01-01', '2025-01-01T12:00:00Z')]);
    expect(plan.merged.map((e) => e.id)).toEqual(['other']);
    expect(plan.writeLocal.map((e) => e.id)).toEqual(['other']);
    expect(plan.removeLocal).toEqual(['phone']);
    expect(plan.remoteChanged).toBe(false);
  });
  test('each side has days the other lacks', () => {
    const plan = mergeEntries([entry('a', '2025-01-01', 't')], [entry('b', '2025-01-02', 't')]);
    expect(plan.merged.map((e) => e.id)).toEqual(['a', 'b']);
    expect(plan.writeLocal.map((e) => e.id)).toEqual(['b']);
    expect(plan.remoteChanged).toBe(true);
  });
});

test('planPhotos moves only the files a side is missing', () => {
  const merged = [
    entry('a', '2025-01-01', 't', { photoPath: 'photos/a.jpg' }),
    entry('b', '2025-01-02', 't', { photoPath: 'photos/b.jpg' }),
    entry('c', '2025-01-03', 't', { photoPath: 'photos/c.jpg' }),
    entry('d', '2025-01-04', 't'),
  ];
  const plan = planPhotos(merged, new Set(['a.jpg', 'c.jpg']), new Set(['b.jpg', 'c.jpg']));
  expect(plan).toEqual({ download: ['photos/b.jpg'], upload: ['photos/a.jpg'] });
});
