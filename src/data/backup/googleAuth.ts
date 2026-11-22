import {
  GoogleOneTapSignIn,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
} from 'react-native-nitro-google-signin';

/**
 * Only files and folders this app created are visible to it ("See, edit, create and delete only
 * the specific Google Drive files you use with this app"). It cannot read the rest of the Drive.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** OAuth "Web application" client id from Google Cloud Console. Not a secret. Empty = backup is not set up in this build. */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const googleConfigured = WEB_CLIENT_ID.length > 0;

let configured = false;
function ensureConfigured(): void {
  if (!googleConfigured) throw new Error('Google sign-in is not set up in this build.');
  if (configured) return;
  GoogleOneTapSignIn.configure({ webClientId: WEB_CLIENT_ID });
  configured = true;
}

/**
 * The Google account the app is still signed in to, or null. Shows nothing: it only reads the
 * session the sign-in library keeps on the phone (`getTokens()` refreshes from that).
 *
 * Not `signIn()`: on Android that is the Credential Manager sheet, so the daily quiet backup used
 * to pop up "choose an account" and it looked as if Drive had to be connected again.
 */
export function restoreGoogleAccount(): string | null {
  if (!googleConfigured) return null;
  try {
    ensureConfigured();
    const user = GoogleOneTapSignIn.getCurrentUser()?.user;
    return user ? (user.email ?? user.id) : null;
  } catch {
    return null;
  }
}

/** Lets the person pick the Google account to back up to. Returns its email, or null if they backed out. */
export async function chooseGoogleIdentity(nonceDigest?: string) {
  ensureConfigured();
  // Each interactive attempt gets its own nonce; backup-only sign-in uses the SDK default.
  GoogleOneTapSignIn.configure({ webClientId: WEB_CLIENT_ID, nonce: nonceDigest ?? null });
  await GoogleOneTapSignIn.checkPlayServices(true);
  // Always show the account chooser: this is "the Drive of their choice", not whichever account signs in silently.
  let response = await GoogleOneTapSignIn.presentExplicitSignIn();
  if (isNoSavedCredentialFoundResponse(response)) response = await GoogleOneTapSignIn.createAccount();
  return isSuccessResponse(response) ? response.data : null;
}

export async function chooseGoogleAccount(): Promise<string | null> {
  const identity = await chooseGoogleIdentity();
  if (!identity) return null;
  const result = await GoogleOneTapSignIn.requestScopes([DRIVE_SCOPE]);
  return result.accessToken ? (identity.user.email ?? identity.user.id) : null;
}

export async function signOutOfGoogle(): Promise<void> {
  if (!googleConfigured) return;
  ensureConfigured();
  await GoogleOneTapSignIn.signOut();
}

export async function getAccessToken(): Promise<string> {
  ensureConfigured();
  return (await GoogleOneTapSignIn.getTokens()).accessToken;
}

/** After a 401: drop the stale token and fetch a fresh one. */
export async function refreshAccessToken(stale: string): Promise<string> {
  ensureConfigured();
  await GoogleOneTapSignIn.clearCachedAccessToken(stale);
  return (await GoogleOneTapSignIn.getTokens()).accessToken;
}
