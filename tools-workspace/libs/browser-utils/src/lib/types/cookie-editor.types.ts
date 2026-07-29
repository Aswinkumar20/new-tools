export type CookieSameSite = 'Strict' | 'Lax' | 'None';

export interface CookieEntry {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: CookieSameSite;
}

export interface CookieFormValues {
  name: string;
  value: string;
  domain: string;
  path: string;
  daysToExpire: number | null;
  secure: boolean;
  sameSite: CookieSameSite;
}
