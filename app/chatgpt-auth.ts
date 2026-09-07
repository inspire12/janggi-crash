import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get('oai-authenticated-user-id');
  const email = requestHeaders.get('oai-authenticated-user-email');
  if (!userId || !email) return null;
  const encodedName = requestHeaders.get('oai-authenticated-user-full-name');
  const fullName =
    encodedName &&
    requestHeaders.get('oai-authenticated-user-full-name-encoding') ===
      'percent-encoded-utf-8'
      ? safeDecode(encodedName)
      : null;
  return { userId, email, fullName, displayName: fullName ?? email.split('@')[0] };
}

export async function requireChatGPTUser(returnTo: string) {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(`/signin-with-chatgpt?return_to=${encodeURIComponent(safePath(returnTo))}`);
}

export function chatGPTSignInPath(returnTo: string) {
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(safePath(returnTo))}`;
}

export function chatGPTSignOutPath(returnTo = '/') {
  return `/signout-with-chatgpt?return_to=${encodeURIComponent(safePath(returnTo))}`;
}

function safePath(value: string) {
  return value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
