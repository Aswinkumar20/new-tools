/**
 * Shared AES-GCM + PBKDF2 helpers used by security-tools encryption features.
 * Wire format: base64(salt[16] || iv[12] || ciphertext) — keep in sync across tools.
 */
export const ST_AES_GCM_SALT_BYTES = 16;
export const ST_AES_GCM_IV_BYTES = 12;
export const ST_AES_GCM_PBKDF2_ITERATIONS = 100_000;

export async function stEncryptAesGcm(plainText: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(ST_AES_GCM_SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(ST_AES_GCM_IV_BYTES));

  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, [
    'deriveKey'
  ]);

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ST_AES_GCM_PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    enc.encode(plainText)
  );

  const combined = new Uint8Array(salt.length + iv.length + cipherBuffer.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(cipherBuffer), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function stDecryptAesGcm(cipherBase64: string, password: string): Promise<string> {
  const data = Uint8Array.from(atob(cipherBase64), (c) => c.charCodeAt(0));
  const salt = data.slice(0, ST_AES_GCM_SALT_BYTES);
  const iv = data.slice(ST_AES_GCM_SALT_BYTES, ST_AES_GCM_SALT_BYTES + ST_AES_GCM_IV_BYTES);
  const cipherBytes = data.slice(ST_AES_GCM_SALT_BYTES + ST_AES_GCM_IV_BYTES);

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, [
    'deriveKey'
  ]);

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ST_AES_GCM_PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const plainBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    cipherBytes
  );

  return new TextDecoder().decode(plainBuffer);
}
