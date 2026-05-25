import 'server-only';

import {
  hasXapi,
  realtimeWebSearch,
  searchTweets,
  XapiConfigError,
  XapiHttpError,
  type XapiTweet,
  type XapiWebSearchResult,
} from './client';

export type MarketSignalsInput = {
  businessName: string;
  businessType: string;
  vibe: string;
  locale: 'en' | 'ar';
  country?: string;
};

export type MarketSignal = {
  source: 'web' | 'x';
  query: string;
  text: string;
  author?: string;
  createdAt?: string;
  engagement?: number;
  url?: string;
};

export type MarketSignalsResult = {
  status: 'ok' | 'disabled' | 'unavailable';
  signals: MarketSignal[];
  message?: string;
};

const MAX_QUERIES = 3;
const MAX_SIGNALS = 8;
const MAX_TEXT_LENGTH = 260;

export async function getMarketSignals(input: MarketSignalsInput): Promise<MarketSignalsResult> {
  if (!hasXapi()) {
    return { status: 'disabled', signals: [], message: 'XAPI is not configured.' };
  }

  const queries = buildQueries(input).slice(0, MAX_QUERIES);
  const settled = await Promise.allSettled(
    queries.map(async (query) => {
      const [web, tweets] = await Promise.allSettled([
        realtimeWebSearch({
          q: query,
          hl: input.locale === 'ar' ? 'ar' : 'en',
          gl: 'qa',
          location: 'Qatar',
          num: 4,
        }),
        searchTweets({ rawQuery: query, product: 'Latest' }),
      ]);

      return [
        ...(web.status === 'fulfilled'
          ? normalizeWebResults(
              web.value.organic ?? web.value.news ?? web.value.results ?? [],
              query,
            )
          : []),
        ...(tweets.status === 'fulfilled'
          ? normalizeTweets(
              tweets.value.tweets ?? tweets.value.data ?? tweets.value.results ?? [],
              query,
            )
          : []),
      ];
    }),
  );

  const signals = settled
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0))
    .slice(0, MAX_SIGNALS);

  const failed = settled.find((result) => result.status === 'rejected');
  if (!signals.length && failed?.status === 'rejected') {
    return {
      status: 'unavailable',
      signals: [],
      message: formatXapiFailure(failed.reason),
    };
  }

  return { status: 'ok', signals };
}

function buildQueries(input: MarketSignalsInput): string[] {
  const terms = [
    input.businessName,
    input.businessType.replace(/[_-]+/gu, ' '),
    ...input.vibe
      .split(/[,.،؛\n]/u)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2),
  ];
  const market =
    input.country ?? (input.locale === 'ar' ? 'Qatar OR Doha OR قطر OR الدوحة' : 'Qatar OR Doha');

  return Array.from(
    new Set(terms.filter(Boolean).map((term) => `(${term}) (${market}) -is:retweet`)),
  );
}

function normalizeTweets(tweets: XapiTweet[], query: string): MarketSignal[] {
  const signals: MarketSignal[] = [];
  for (const tweet of tweets) {
    const text = clamp(tweet.full_text ?? tweet.text ?? '');
    if (!text) continue;

    signals.push({
      source: 'x',
      query,
      text,
      author:
        tweet.user?.screen_name ??
        tweet.user?.userName ??
        tweet.author?.screen_name ??
        tweet.author?.userName,
      createdAt: tweet.created_at,
      engagement:
        (tweet.favorite_count ?? 0) +
        (tweet.retweet_count ?? 0) +
        (tweet.reply_count ?? 0) +
        (tweet.quote_count ?? 0),
    });
  }

  return signals;
}

function normalizeWebResults(results: XapiWebSearchResult[], query: string): MarketSignal[] {
  const signals: MarketSignal[] = [];
  for (const result of results) {
    const text = clamp([result.title, result.snippet].filter(Boolean).join(' - '));
    if (!text) continue;

    signals.push({
      source: 'web',
      query,
      text,
      createdAt: result.date,
      url: result.link,
    });
  }

  return signals;
}

function clamp(text: string): string {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  if (normalized.length <= MAX_TEXT_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_TEXT_LENGTH - 1).trim()}...`;
}

function formatXapiFailure(reason: unknown): string {
  if (reason instanceof XapiConfigError) return reason.message;
  if (reason instanceof XapiHttpError) return `XAPI returned ${reason.status}.`;
  return 'XAPI market signals are temporarily unavailable.';
}
