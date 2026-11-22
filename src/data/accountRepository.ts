import * as Crypto from 'expo-crypto';
import { createChangeEmitter } from './changes';
import { DRIVE_SCOPE, chooseGoogleIdentity, googleConfigured, signOutOfGoogle } from './backup/googleAuth';
import { GoogleOneTapSignIn } from 'react-native-nitro-google-signin';
import { settingsRepository } from './settingsRepository';
import { socialClient } from './social/client';
import { forgetAlerts } from './social/alerts';
import { startPostman, stopPostman } from './social/postman';

/**
 * Your Google account, connected once for everything: it backs your diary up to your own Drive, and it's who you are
 * when you give someone a page (so their phone can find yours). Nothing of your diary goes anywhere but your Drive.
 */
export interface AccountStatus {
  /** False when this build has no Google client set up. */
  available: boolean;
  /** The connected Google account's email, or null. */
  email: string | null;
  /** Your id to other phones (null until connected). */
  id: string | null;
  /** Whether phones can find you to give you pages (signed in to the introductions service). */
  findable: boolean;
}

const changes = createChangeEmitter();
socialClient?.auth.onAuthStateChange(() => changes.emit());

export const accountRepository = {
  subscribe(listener: () => void): () => void {
    const a = changes.subscribe(listener);
    const b = settingsRepository.subscribe(listener);
    return () => {
      a();
      b();
    };
  },

  async getStatus(): Promise<AccountStatus> {
    const backup = await settingsRepository.getBackup();
    const session = socialClient ? (await socialClient.auth.getSession()).data.session : null;
    return { available: googleConfigured, email: backup.account ?? session?.user.email ?? null, findable: !!session, id: session?.user.id ?? null };
  },

  /** One Google sign-in: picks the account, connects Drive backup, and makes you findable. Null if they backed out. */
  async connect(): Promise<string | null> {
    const nonce = Crypto.randomUUID();
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    const identity = await chooseGoogleIdentity(digest);
    if (!identity) return null;
    const email = identity.user.email ?? identity.user.id;
    const drive = await GoogleOneTapSignIn.requestScopes([DRIVE_SCOPE]);
    if (!drive.accessToken) return null;
    await settingsRepository.setBackup({ account: email, lastBackupAt: null });
    if (socialClient && identity.idToken) {
      const { error } = await socialClient.auth.signInWithIdToken({ provider: 'google', token: identity.idToken, nonce });
      if (error) throw error;
      await startPostman().catch(() => undefined);
    }
    const profile = await settingsRepository.getProfile();
    if (!profile.name && identity.user.givenName) await settingsRepository.setProfile({ name: identity.user.givenName.slice(0, 24) });
    changes.emit();
    return email;
  },

  /** Disconnects Google: no more backups, and phones can't find you. Your diary and kept pages stay on this phone. */
  async disconnect(): Promise<void> {
    await forgetAlerts();
    await stopPostman().catch(() => undefined);
    await socialClient?.auth.signOut().catch(() => undefined);
    await signOutOfGoogle();
    await settingsRepository.setBackup({ account: null, lastBackupAt: null });
    changes.emit();
  },

  /**
   * Deletes your sharing account on LookBack's server (your sign-in, push address and nearby name), then disconnects.
   * Your diary, your Drive folder and the pages you were given stay. Connecting again makes a new account, so people
   * who had you need to add you again.
   */
  async deleteAccount(): Promise<void> {
    if (socialClient && (await socialClient.auth.getSession()).data.session) {
      await stopPostman().catch(() => undefined);
      const { error } = await socialClient.rpc('delete_my_account');
      if (error) throw error;
    }
    await this.disconnect();
  },
};
