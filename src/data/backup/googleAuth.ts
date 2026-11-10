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
  if (!googleConfigured) throw new Error('Google Drive backup is not set up in this build.');
  if (configured) return;
  GoogleOneTapSignIn.configure({ webClientId: WEB_CLIENT_ID, scopes: [DRIVE_SCOPE] });
  configured = true;
}

/** Restores the previous Google session without showing anything. Returns the account's email, or null. */
export async function restoreGoogleAccount(): Promise<string | null> {
  if (!googleConfigured) return null;
  try {
    ensureConfigured();
    const response = await GoogleOneTapSignIn.signIn();
    return isSuccessResponse(response) ? (response.data.user.email ?? response.data.user.id) : null;
  } catch {
    return null;
  }
}

/** Lets the person pick the Google account to back up to. Returns its email, or null if they backed out. */
export async function chooseGoogleAccount(): Promise<string | null> {
  ensureConfigured();
  await GoogleOneTapSignIn.checkPlayServices(true);
  // Always show the account chooser: this is "the Drive of their choice", not whichever account signs in silently.
  let response = await GoogleOneTapSignIn.presentExplicitSignIn();
  if (isNoSavedCredentialFoundResponse(response)) response = await GoogleOneTapSignIn.createAccount();
  return isSuccessResponse(response) ? (response.data.user.email ?? response.data.user.id) : null;
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
