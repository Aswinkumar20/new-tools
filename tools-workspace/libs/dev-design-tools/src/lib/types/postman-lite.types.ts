export interface PostmanRequestResult {
  success: boolean;
  status: number | null;
  statusText: string;
  headers: Record<string, string>;
  body: string | null;
  error: string | null;
  timestamp: number;
  duration: number;
}

export interface PostmanSavedRequest {
  id: string;
  name: string;
  url: string;
  method: string;
  headers: Array<{ key: string; value: string }>;
  body: string;
  timestamp: number;
}

export interface PostmanHistoryEntry {
  timestamp: number;
  url: string;
  method: string;
  status: number | null;
  success: boolean;
}

export interface PostmanHeaderPair {
  key: string;
  value: string;
}

export interface PostmanRequestInput {
  url: string;
  method: string;
  headers: ReadonlyArray<PostmanHeaderPair>;
  body: string;
}
