// ==============================================================================
// ClientPulse AI — Shared Encryption Module for Sensitive Secrets (PAT)
// File: supabase/functions/_shared/crypto.ts
//
// Uses standard Web Crypto API (AES-GCM 256-bit).
// Key is retrieved from environment variable: PAT_ENCRYPTION_KEY (32 bytes in base64).
// Format stored in database: "<base64_iv>:<base64_ciphertext>"
// ==============================================================================

function base64ToBytes(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Loads the 256-bit AES-GCM CryptoKey from Deno.env.get('PAT_ENCRYPTION_KEY').
 * Fails fast with a clear error if the key is missing or not 32 bytes (256 bits).
 */
async function getEncryptionKey(usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const keyBase64 = Deno.env.get('PAT_ENCRYPTION_KEY')?.trim();
  if (!keyBase64) {
    throw new Error(
      'PAT_ENCRYPTION_KEY is not configured in Supabase environment secrets. ' +
      'Please generate a 32-byte key (e.g. openssl rand -base64 32) and set it via Supabase CLI or Dashboard.'
    );
  }

  let rawKey: Uint8Array;
  try {
    rawKey = base64ToBytes(keyBase64);
  } catch {
    throw new Error('PAT_ENCRYPTION_KEY is not valid base64.');
  }

  if (rawKey.length !== 32) {
    throw new Error(`PAT_ENCRYPTION_KEY must be exactly 32 bytes (256 bits). Got ${rawKey.length} bytes.`);
  }

  return await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    [usage]
  );
}

/**
 * Encrypts a plaintext string (e.g., GitHub Personal Access Token).
 * Returns "<base64_iv>:<base64_ciphertext>".
 */
export async function encryptPat(plainText: string): Promise<string> {
  if (!plainText) {
    throw new Error('Cannot encrypt empty token.');
  }

  const key = await getEncryptionKey('encrypt');
  // 12-byte (96-bit) IV is the recommended standard for AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plainText);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedText
  );

  const ivB64 = bytesToBase64(iv);
  const cipherB64 = bytesToBase64(new Uint8Array(cipherBuffer));

  return `${ivB64}:${cipherB64}`;
}

/**
 * Decrypts a stored "<base64_iv>:<base64_ciphertext>" string.
 * Returns the decrypted plaintext token.
 */
export async function decryptPat(encryptedStr: string): Promise<string> {
  if (!encryptedStr || !encryptedStr.includes(':')) {
    throw new Error('Invalid encrypted PAT format. Expected "<iv>:<ciphertext>".');
  }

  const [ivB64, cipherB64] = encryptedStr.split(':');
  if (!ivB64 || !cipherB64) {
    throw new Error('Malformed encrypted PAT components.');
  }

  const key = await getEncryptionKey('decrypt');
  const iv = base64ToBytes(ivB64);
  const ciphertext = base64ToBytes(cipherB64);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
}
