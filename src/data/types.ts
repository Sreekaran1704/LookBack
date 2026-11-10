import type { LocalDate } from '../lib/dates';

export interface Entry {
  id: string;
  /** Local calendar day, 'YYYY-MM-DD'. */
  localDate: LocalDate;
  text: string;
  /**
   * Photo path RELATIVE to the app's document directory (e.g. 'photos/abc.jpg').
   * Resolve with resolvePhotoUri() before rendering. Stored in the photo_uri column.
   */
  photoPath: string | null;
  /** ISO 8601 instants, used for ordering and future sync. */
  createdAt: string;
  updatedAt: string;
  /** Optional scrapbook style. null = derived from the id seed (see lib/seeded.ts). */
  objectType: string | null;
  tapePattern: string | null;
  /** A sticker kind, 'none' for no sticker, or null for the seeded default. */
  sticker: string | null;
  /** Style palette names (see theme/yearColors STYLE_PALETTES). null = the entry's year color. */
  stickerColor: string | null;
  tapeColor: string | null;
}

export interface EntryStyle {
  objectType: string | null;
  tapePattern: string | null;
  sticker: string | null;
  stickerColor: string | null;
  tapeColor: string | null;
}

export type PhotoChange =
  | { kind: 'keep' }
  | { kind: 'remove' }
  /** sourceUri is a temporary picker/camera URI; it will be copied into app storage. */
  | { kind: 'set'; sourceUri: string };

export interface SaveEntryInput {
  /** Id to use when this creates a new entry (so a live preview matches what gets saved). Ignored on update. */
  id?: string;
  localDate: LocalDate;
  text: string;
  photo: PhotoChange;
  /** Fields left out keep their current value. */
  style?: Partial<EntryStyle>;
}

export interface BackupInfo {
  /** Email of the Google account the backup goes to, or null when not connected. */
  account: string | null;
  /** ISO instant of the last successful backup. */
  lastBackupAt: string | null;
}

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}
