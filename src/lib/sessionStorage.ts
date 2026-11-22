/** Keep each encrypted keychain item below the small-item limits on older iOS releases. */
export function chunkedSessionStorage(
  store: {
    getItemAsync(key: string): Promise<string | null>;
    setItemAsync(key: string, value: string): Promise<void>;
    deleteItemAsync(key: string): Promise<void>;
  },
  nonce: () => string,
) {
  type Manifest = { generation: string; count: number };
  const manifest = async (key: string): Promise<Manifest | null> => {
    const raw = await store.getItemAsync(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Manifest;
    if (
      !/^[a-zA-Z0-9-]+$/.test(value.generation) ||
      !Number.isInteger(value.count) ||
      value.count < 1 ||
      value.count > 100
    )
      throw new Error('Invalid saved session. Please sign in again.');
    return value;
  };
  const removeChunks = async (key: string, meta: Manifest | null) => {
    if (meta)
      await Promise.all(
        Array.from({ length: meta.count }, (_, i) => store.deleteItemAsync(`${key}.${meta.generation}.${i}`)),
      );
  };
  return {
    async getItem(key: string) {
      const meta = await manifest(key);
      if (!meta) return null;
      const chunks = await Promise.all(
        Array.from({ length: meta.count }, (_, i) => store.getItemAsync(`${key}.${meta.generation}.${i}`)),
      );
      return chunks.some((c) => c === null) ? null : (JSON.parse(chunks.join('')) as string);
    },
    async setItem(key: string, value: string) {
      // Encoding as ASCII also bounds UTF-8 byte length, including non-Latin display names.
      const encoded = JSON.stringify(value).replace(
        /[\u007f-\uffff]/g,
        (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
      );
      const chunks = encoded.match(/.{1,1500}/g) ?? [''];
      if (chunks.length > 100) throw new Error('This account session is too large to store.');
      const old = await manifest(key);
      const next = { generation: nonce(), count: chunks.length };
      try {
        for (let i = 0; i < chunks.length; i++) await store.setItemAsync(`${key}.${next.generation}.${i}`, chunks[i]!);
        await store.setItemAsync(key, JSON.stringify(next));
      } catch (error) {
        await removeChunks(key, next).catch(() => undefined);
        throw error;
      }
      await removeChunks(key, old).catch(() => undefined);
    },
    async removeItem(key: string) {
      const meta = await manifest(key);
      await store.deleteItemAsync(key);
      await removeChunks(key, meta);
    },
  };
}
