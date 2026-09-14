/** Base64-encode sensitive UTF-8 strings before sending to tool-api. */
export function encodeSensitivePayload(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}
