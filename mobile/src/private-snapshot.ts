import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

type FileKey = { id: string; key: string };
type SnapshotType = 'cart' | 'checkout';

export function privateSnapshot(type: SnapshotType, name: string) {
  const file = (id: string) => new File(Paths.document, `${type}-${id}.dat`);
  const readKey = async () => {
    const record = await SecureStore.getItemAsync(name);
    return record ? JSON.parse(record) as FileKey : null;
  };
  const discardFile = (id: string) => {
    try { file(id).delete(); } catch { /* A file without its key has no recoverable data. */ }
  };
  return {
    async read<T>(): Promise<T | null> {
      const record = await readKey();
      if (!record) return null;
      const secret = await AESEncryptionKey.import(record.key, 'hex');
      const plaintext = await aesDecryptAsync(AESSealedData.fromCombined(await file(record.id).bytes()), secret);
      return JSON.parse(decodeURIComponent(new TextDecoder().decode(plaintext))) as T;
    },
    async write(id: string, value: object) {
      const previous = await readKey();
      const secret = await AESEncryptionKey.generate();
      const payload = Uint8Array.from(encodeURIComponent(JSON.stringify(value)), (character) => character.charCodeAt(0));
      const encrypted = await (await aesEncryptAsync(payload, secret)).combined();
      const staged = file(id);
      staged.create();
      try {
        staged.write(encrypted);
        await SecureStore.setItemAsync(name, JSON.stringify({ id, key: await secret.encoded('hex') }), {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      } catch (error) {
        discardFile(id);
        throw error;
      }
      if (previous && previous.id !== id) discardFile(previous.id);
    },
    async remove(id: string) {
      if ((await readKey())?.id !== id) return;
      await SecureStore.deleteItemAsync(name);
      discardFile(id);
    },
  };
}
