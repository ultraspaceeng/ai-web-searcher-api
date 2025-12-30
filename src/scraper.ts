
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

// Types
export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

export interface PageContent {
    url: string;
    title: string;
    content: string;
    favicon: string;
    image?: string;
    mediaType?: 'image' | 'video' | 'audio';
    mediaUrl?: string;
}

// Chrome-like User-Agent
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const axiosInstance = axios.create({
    headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    },
    timeout: 10000,
    maxRedirects: 3,
});

// Search using DuckDuckGo HTML
async function searchDuckDuckGo(query: string, limit: number = 4): Promise<SearchResult[]> {
    try {
        const response = await axiosInstance.get('https://html.duckduckgo.com/html/', {
            params: { q: query },
        });

        const $ = cheerio.load(response.data);
        const results: SearchResult[] = [];

        $('.result').each((i, elem) => {
            if (results.length >= limit) return false;

            const titleElem = $(elem).find('.result__title a');
            const snippetElem = $(elem).find('.result__snippet');

            const title = titleElem.text().trim();
            let url = titleElem.attr('href') || '';
            const snippet = snippetElem.text().trim();

            if (url.includes('uddg=')) {
                const match = url.match(/uddg=([^&]+)/);
                if (match) {
                    url = decodeURIComponent(match[1]);
                }
            }

            if (title && url && url.startsWith('http')) {
                results.push({ title, url, snippet });
            }
        });

        return results;
    } catch (error) {
        console.error('DuckDuckGo search error:', error);
        return [];
    }
}

// Fallback: Google Custom Search
async function searchGoogle(query: string, limit: number = 4): Promise<SearchResult[]> {
    try {
        const response = await axiosInstance.get('https://www.google.com/search', {
            params: { q: query, num: limit },
        });

        const $ = cheerio.load(response.data);
        const results: SearchResult[] = [];

        $('div.g').each((i, elem) => {
            if (results.length >= limit) return false;

            const titleElem = $(elem).find('h3').first();
            const linkElem = $(elem).find('a').first();
            const snippetElem = $(elem).find('div[data-sncf]').first();

            const title = titleElem.text().trim();
            const url = linkElem.attr('href') || '';
            const snippet = snippetElem.text().trim();

            if (title && url && url.startsWith('http')) {
                results.push({ title, url, snippet });
            }
        });

        return results;
    } catch (error) {
        console.error('Google search error:', error);
        return [];
    }
}

// Brave Search API
async function searchBrave(query: string, limit: number = 5): Promise<SearchResult[]> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (!apiKey) {
        console.log('[Scraper] No Brave Search API key configured, skipping');
        return [];
    }

    try {
        console.log('[Scraper] Using Brave Search API');
        const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
            params: {
                q: query,
                count: limit,
            },
            headers: {
                'Accept': 'application/json',
                'X-Subscription-Token': apiKey,
            },
            timeout: 8000,
        });

        const results: SearchResult[] = (response.data.web?.results || []).slice(0, limit).map((r: any) => ({
            title: r.title || '',
            url: r.url || '',
            snippet: r.description || '',
        }));

        console.log(`[Scraper] Brave Search returned ${results.length} results`);
        return results;
    } catch (error: any) {
        console.error('[Scraper] Brave Search error:', error.message || error);
        return [];
    }
}

// Combined search
export async function searchWeb(query: string, limit: number = 4, focusMode: string = 'web'): Promise<SearchResult[]> {
    let search_query = query;
    let searchLimit = limit;

    if (focusMode === 'images') {
        search_query += ' images';
        searchLimit = Math.max(limit, 10);
    } else if (focusMode === 'videos') {
        search_query += ' videos';
        searchLimit = Math.max(limit, 8);
    } else if (focusMode === 'academic') {
        search_query += ' research paper';
    } else if (focusMode === 'music') {
        search_query += ' music';
    }

    console.log(`[Scraper] Searching for: "${search_query}" (Mode: ${focusMode}, Limit: ${searchLimit})`);

    let results: SearchResult[] = [];

    // 1. Try Brave Search API first
    results = await searchBrave(search_query, searchLimit);

    // 2. Fallback to duck-duck-scrape
    if (results.length === 0) {
        try {
            const { search, SafeSearchType } = await import('duck-duck-scrape');
            console.log('[Scraper] Trying duck-duck-scrape library');
            const ddgResults = await search(search_query, {
                safeSearch: SafeSearchType.MODERATE
            });

            results = ddgResults.results.slice(0, searchLimit).map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.description || '',
            }));
            console.log(`[Scraper] duck-duck-scrape returned ${results.length} results`);
        } catch (e: any) {
            console.error('[Scraper] duck-duck-scrape failed:', e.message || e);
        }
    }

    // 3. Fallback to DuckDuckGo HTML scraping
    if (results.length === 0) {
        console.log('[Scraper] Trying DuckDuckGo HTML scraping');
        results = await searchDuckDuckGo(search_query, searchLimit);
        console.log(`[Scraper] DuckDuckGo HTML returned ${results.length} results`);
    }

    // 4. Final fallback to Google
    if (results.length === 0) {
        console.log('[Scraper] Trying Google scraping');
        results = await searchGoogle(search_query, searchLimit);
        console.log(`[Scraper] Google returned ${results.length} results`);
    }

    return results;
}

// Extract favicon URL
function getFaviconUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch {
        return '';
    }
}

// Extract main content
async function extractPageContent(url: string, snippet?: string): Promise<PageContent | null> {
    console.log(`[Scraper] Fetching content from: ${new URL(url).hostname}`);
    try {
        const response = await axiosInstance.get(url, { timeout: 10000 });
        const html = response.data;

        const $ = cheerio.load(html);
        const fallbackTitle = $('title').text().trim() || url;
        const ogImage = $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            $('img').first().attr('src');

        let image = ogImage;
        if (image && !image.startsWith('http')) {
            try {
                image = new URL(image, url).toString();
            } catch { }
        }

        const ogVideo = $('meta[property="og:video"]').attr('content') ||
            $('meta[property="og:video:url"]').attr('content') ||
            $('meta[property="og:video:secure_url"]').attr('content') ||
            $('meta[name="twitter:player"]').attr('content');

        const ogAudio = $('meta[property="og:audio"]').attr('content') ||
            $('meta[property="og:audio:url"]').attr('content') ||
            $('meta[property="og:audio:secure_url"]').attr('content');

        let mediaType: 'image' | 'video' | 'audio' = 'image';
        let mediaUrl: string | undefined = undefined;

        if (ogVideo) {
            mediaType = 'video';
            mediaUrl = ogVideo;
        } else if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com')) {
            mediaType = 'video';
            mediaUrl = url;
        }

        if (ogAudio) {
            mediaType = 'audio';
            mediaUrl = ogAudio;
        } else if (url.includes('soundcloud.com') || url.includes('spotify.com') || url.includes('bandcamp.com')) {
            mediaType = 'audio';
            mediaUrl = url;
            if (!image) {
                image = 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png';
            }
        }

        if (mediaUrl && !mediaUrl.startsWith('http')) {
            try {
                mediaUrl = new URL(mediaUrl, url).toString();
            } catch { }
        }

        const { document } = parseHTML(html);
        const reader = new Readability(document as any);
        const article: ReturnType<typeof reader.parse> = reader.parse();

        if (!article) {
            const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
            return {
                url,
                title: fallbackTitle,
                content: bodyText.slice(0, 1500),
                favicon: getFaviconUrl(url),
                image: image,
                mediaType,
                mediaUrl
            };
        }

        const cleanContent = (article.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 1500);

        return {
            url,
            title: article.title || fallbackTitle,
            content: cleanContent,
            favicon: getFaviconUrl(url),
            image: image,
            mediaType,
            mediaUrl
        };
    } catch (error) {
        const errorCode = (error as { response?: { status: number } })?.response?.status;
        console.log(`[Scraper] Skipped ${new URL(url).hostname} (${errorCode || 'timeout'})`);

        if (snippet) {
            return {
                url,
                title: new URL(url).hostname,
                content: snippet,
                favicon: getFaviconUrl(url),
            };
        }
        return null;
    }
}

// Combined search and scrape
export async function searchAndScrape(query: string, focusMode: string = 'web'): Promise<{
    sources: PageContent[];
    searchResults: SearchResult[];
}> {
    console.log(`[Scraper] Starting searchAndScrape for: "${query}"`);

    const searchResults = await searchWeb(query, 5, focusMode);

    if (searchResults.length === 0) {
        console.log('[Scraper] No search results found');
        return { sources: [], searchResults: [] };
    }

    console.log(`[Scraper] Got ${searchResults.length} search results, attempting to scrape content...`);

    let sources: PageContent[] = [];

    try {
        const scrapePromise = Promise.allSettled(
            searchResults.map(r => extractPageContent(r.url, r.snippet))
        );

        const timeoutPromise = new Promise<PromiseSettledResult<PageContent | null>[]>((resolve) =>
            setTimeout(() => {
                console.log('[Scraper] Scraping timed out, using fallback');
                resolve([]);
            }, 10000) // Increased timeout for server
        );

        const results = await Promise.race([scrapePromise, timeoutPromise]);

        sources = results
            .filter((r): r is PromiseFulfilledResult<PageContent | null> => r.status === 'fulfilled')
            .map(r => r.value)
            .filter((content): content is PageContent => content !== null);

        console.log(`[Scraper] Successfully scraped ${sources.length} pages`);
    } catch (error) {
        console.error('[Scraper] Scraping failed:', error);
    }

    if (sources.length === 0) {
        console.log('[Scraper] Using search snippets as fallback sources');
        sources = searchResults.map(r => ({
            url: r.url,
            title: r.title,
            content: r.snippet || 'Content preview unavailable',
            favicon: getFaviconUrl(r.url),
        }));
    }

    console.log(`[Scraper] Returning ${sources.length} sources total`);
    return { sources, searchResults };
}
