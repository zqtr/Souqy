import 'server-only';

import { env } from '@/lib/env';

export class XapiConfigError extends Error {
  constructor() {
    super('XAPI is not configured. Set XAPI_KEY in the server environment.');
    this.name = 'XapiConfigError';
  }
}

export class XapiHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'XapiHttpError';
    this.status = status;
  }
}

export type XapiTweet = {
  id?: string;
  rest_id?: string;
  text?: string;
  full_text?: string;
  user?: {
    name?: string;
    screen_name?: string;
    userName?: string;
  };
  author?: {
    name?: string;
    screen_name?: string;
    userName?: string;
  };
  created_at?: string;
  favorite_count?: number;
  retweet_count?: number;
  reply_count?: number;
  quote_count?: number;
  view_count?: number | string;
};

export type XapiTweetSearchResponse = {
  tweets?: XapiTweet[];
  data?: XapiTweet[];
  results?: XapiTweet[];
  next_cursor?: string;
  cursor?: string;
  has_more?: boolean;
  [key: string]: unknown;
};

export type XapiWebSearchResult = {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
  source?: string;
  position?: number;
};

export type XapiWebSearchResponse = {
  organic?: XapiWebSearchResult[];
  news?: XapiWebSearchResult[];
  results?: XapiWebSearchResult[];
  [key: string]: unknown;
};

export type SearchTweetsInput = {
  rawQuery: string;
  product?: 'Top' | 'Latest' | 'Media';
  cursor?: string;
};

export type RealtimeWebSearchInput = {
  q: string;
  timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year';
  gl?: string;
  hl?: string;
  num?: number;
  page?: number;
  location?: string;
};

export type XapiActionResponse<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
};

const ALLOWED_ACTIONS = new Set(['web.search.realtime', 'twitter.search']);

export function hasXapi(): boolean {
  return Boolean(env.XAPI_KEY);
}

export async function executeXapiAction<T>(
  actionId: string,
  input: Record<string, unknown>,
): Promise<T> {
  if (!ALLOWED_ACTIONS.has(actionId)) {
    throw new XapiHttpError(400, 'XAPI action is not allowed in Souqna.');
  }
  const apiKey = env.XAPI_KEY;
  if (!apiKey) throw new XapiConfigError();

  const baseUrl = env.XAPI_ACTION_HOST.replace(/\/+$/u, '');

  const response = await fetch(`${baseUrl}/v1/actions/execute`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'XAPI-Key': apiKey,
    },
    body: JSON.stringify({ action_id: actionId, input }),
  });

  const text = await response.text();
  const body = (text ? safeJson(text) : null) as XapiActionResponse<T> | null;
  if (!response.ok) {
    const message =
      body && typeof body.error === 'string'
        ? body.error
        : `XAPI request failed with status ${response.status}.`;
    throw new XapiHttpError(response.status, message);
  }

  if (body && body.success === false) {
    throw new XapiHttpError(response.status, body.error ?? 'XAPI action failed.');
  }

  return (body?.data ?? body) as T;
}

export async function searchTweets(input: SearchTweetsInput): Promise<XapiTweetSearchResponse> {
  return executeXapiAction<XapiTweetSearchResponse>('twitter.search', {
    raw_query: input.rawQuery,
    sort_by: input.product ?? 'Latest',
    cursor: input.cursor ?? '',
  });
}

export async function realtimeWebSearch(
  input: RealtimeWebSearchInput,
): Promise<XapiWebSearchResponse> {
  return executeXapiAction<XapiWebSearchResponse>('web.search.realtime', {
    q: input.q,
    timeRange: input.timeRange ?? 'week',
    gl: input.gl ?? 'qa',
    hl: input.hl ?? 'en',
    num: input.num ?? 5,
    page: input.page ?? 1,
    location: input.location ?? 'Qatar',
  });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
