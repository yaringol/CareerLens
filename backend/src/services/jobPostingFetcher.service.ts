import axios from 'axios';
import { UnprocessableError, ValidationError } from '../errors';
import { htmlToText } from '../utils/htmlToText';
import { assertSafePublicUrl } from '../utils/urlSafety';

const MIN_EXTRACTED_CHARS = 40;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; CareerLens/1.0; +https://github.com/yaringol/CareerLens)';

export interface FetchedJobPosting {
  title?: string;
  description: string;
  source: 'comeet' | 'json-ld' | 'html';
  sourceUrl: string;
}

interface ComeetDetail {
  name?: string;
  value?: string;
  order?: number;
}

interface ComeetPosition {
  name?: string;
  details?: ComeetDetail[];
}

function extractRegex(html: string, pattern: RegExp): string | undefined {
  const match = html.match(pattern);
  return match?.[1]?.trim();
}

function parseComeetPath(url: URL): { companyUid: string; positionUid: string } | null {
  const parts = url.pathname.split('/').filter(Boolean);
  const jobsIdx = parts.indexOf('jobs');
  if (jobsIdx < 0 || parts.length < jobsIdx + 5) return null;
  return {
    companyUid: parts[jobsIdx + 2],
    positionUid: parts[jobsIdx + 4],
  };
}

function isComeetHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'www.comeet.com' || host === 'comeet.com' || host === 'www.comeet.co' || host === 'comeet.co';
}

async function fetchHtml(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    timeout: FETCH_TIMEOUT_MS,
    maxRedirects: 5,
    responseType: 'text',
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    validateStatus: (status) => status >= 200 && status < 400,
  });
  return response.data;
}

function buildComeetDescription(position: ComeetPosition): string {
  const chunks: string[] = [];
  if (position.name) chunks.push(position.name);

  const details = [...(position.details ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
  for (const detail of details) {
    if (!detail.value) continue;
    const label = detail.name ? `${detail.name}: ` : '';
    chunks.push(`${label}${htmlToText(detail.value)}`);
  }

  return chunks.join('\n\n').trim();
}

async function fetchFromComeet(url: URL): Promise<FetchedJobPosting> {
  const ids = parseComeetPath(url);
  if (!ids) {
    throw new UnprocessableError('Could not read position id from Comeet link');
  }

  const pageHtml = await fetchHtml(url.toString());
  const token =
    extractRegex(pageHtml, /"token"\s*:\s*"([A-Fa-f0-9]+)"/) ??
    extractRegex(pageHtml, /token"\s*:\s*"([A-Fa-f0-9]+)"/);
  const companyUid =
    extractRegex(pageHtml, /"company_uid"\s*:\s*"([^"]+)"/) ?? ids.companyUid;

  if (!token) {
    throw new UnprocessableError('Could not read Comeet careers token from the job page');
  }

  const apiBase = url.hostname.includes('comeet.co') ? 'https://www.comeet.co' : 'https://www.comeet.com';
  const apiUrl = `${apiBase}/careers-api/2.0/company/${companyUid}/positions/${ids.positionUid}`;
  const { data } = await axios.get<ComeetPosition>(apiUrl, {
    timeout: FETCH_TIMEOUT_MS,
    params: { token, details: true },
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const description = buildComeetDescription(data);
  if (description.length < MIN_EXTRACTED_CHARS) {
    throw new UnprocessableError('Comeet job page did not contain enough description text');
  }

  return {
    title: data.name,
    description,
    source: 'comeet',
    sourceUrl: url.toString(),
  };
}

function extractJsonLdJobPosting(html: string): FetchedJobPosting | null {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1]) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const type = (node as { '@type'?: string })['@type'];
        if (type !== 'JobPosting') continue;
        const title = (node as { title?: string }).title;
        const description = (node as { description?: string }).description;
        if (!description || description.trim().length < MIN_EXTRACTED_CHARS) continue;
        return {
          title,
          description: htmlToText(description),
          source: 'json-ld',
          sourceUrl: '',
        };
      }
    } catch {
      /* try next script block */
    }
  }
  return null;
}

function extractFromGenericHtml(html: string, pageUrl: string): FetchedJobPosting | null {
  const jsonLd = extractJsonLdJobPosting(html);
  if (jsonLd) {
    return { ...jsonLd, sourceUrl: pageUrl };
  }

  const ogDescription = extractRegex(
    html,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
  );
  const title = extractRegex(html, /<title[^>]*>([^<]+)<\/title>/i);
  const body = extractRegex(html, /<body[^>]*>([\s\S]*?)<\/body>/i) ?? html;
  const text = htmlToText(body);

  const description = ogDescription ? htmlToText(ogDescription) : text;
  if (description.length < MIN_EXTRACTED_CHARS) return null;

  return {
    title,
    description,
    source: 'html',
    sourceUrl: pageUrl,
  };
}

export async function fetchJobPostingFromUrl(rawUrl: string): Promise<FetchedJobPosting> {
  const url = assertSafePublicUrl(rawUrl);

  try {
    if (isComeetHost(url.hostname)) {
      return await fetchFromComeet(url);
    }

    const html = await fetchHtml(url.toString());
    const extracted = extractFromGenericHtml(html, url.toString());
    if (!extracted) {
      throw new UnprocessableError(
        'Could not extract a job description from this page. Paste the text manually instead.'
      );
    }
    return extracted;
  } catch (err) {
    if (err instanceof ValidationError || err instanceof UnprocessableError) {
      throw err;
    }
    throw new UnprocessableError(
      'Could not fetch the job posting link. Check the URL or paste the description manually.'
    );
  }
}
