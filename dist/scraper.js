"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchWeb = searchWeb;
exports.searchAndScrape = searchAndScrape;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const readability_1 = require("@mozilla/readability");
const linkedom_1 = require("linkedom");
// Chrome-like User-Agent
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const axiosInstance = axios_1.default.create({
    headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    },
    timeout: 10000,
    maxRedirects: 3,
});
// Search using DuckDuckGo HTML
function searchDuckDuckGo(query_1) {
    return __awaiter(this, arguments, void 0, function* (query, limit = 4) {
        try {
            const response = yield axiosInstance.get('https://html.duckduckgo.com/html/', {
                params: { q: query },
            });
            const $ = cheerio.load(response.data);
            const results = [];
            $('.result').each((i, elem) => {
                if (results.length >= limit)
                    return false;
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
        }
        catch (error) {
            console.error('DuckDuckGo search error:', error);
            return [];
        }
    });
}
// Fallback: Google Custom Search
function searchGoogle(query_1) {
    return __awaiter(this, arguments, void 0, function* (query, limit = 4) {
        try {
            const response = yield axiosInstance.get('https://www.google.com/search', {
                params: { q: query, num: limit },
            });
            const $ = cheerio.load(response.data);
            const results = [];
            $('div.g').each((i, elem) => {
                if (results.length >= limit)
                    return false;
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
        }
        catch (error) {
            console.error('Google search error:', error);
            return [];
        }
    });
}
// Brave Search API
function searchBrave(query_1) {
    return __awaiter(this, arguments, void 0, function* (query, limit = 5) {
        var _a;
        const apiKey = process.env.BRAVE_SEARCH_API_KEY;
        if (!apiKey) {
            console.log('[Scraper] No Brave Search API key configured, skipping');
            return [];
        }
        try {
            console.log('[Scraper] Using Brave Search API');
            const response = yield axios_1.default.get('https://api.search.brave.com/res/v1/web/search', {
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
            const results = (((_a = response.data.web) === null || _a === void 0 ? void 0 : _a.results) || []).slice(0, limit).map((r) => ({
                title: r.title || '',
                url: r.url || '',
                snippet: r.description || '',
            }));
            console.log(`[Scraper] Brave Search returned ${results.length} results`);
            return results;
        }
        catch (error) {
            console.error('[Scraper] Brave Search error:', error.message || error);
            return [];
        }
    });
}
// Combined search
function searchWeb(query_1) {
    return __awaiter(this, arguments, void 0, function* (query, limit = 4, focusMode = 'web') {
        let search_query = query;
        let searchLimit = limit;
        if (focusMode === 'images') {
            search_query += ' images';
            searchLimit = Math.max(limit, 10);
        }
        else if (focusMode === 'videos') {
            search_query += ' videos';
            searchLimit = Math.max(limit, 8);
        }
        else if (focusMode === 'academic') {
            search_query += ' research paper';
        }
        else if (focusMode === 'music') {
            search_query += ' music';
        }
        console.log(`[Scraper] Searching for: "${search_query}" (Mode: ${focusMode}, Limit: ${searchLimit})`);
        let results = [];
        // 1. Try Brave Search API first
        results = yield searchBrave(search_query, searchLimit);
        // 2. Fallback to duck-duck-scrape
        if (results.length === 0) {
            try {
                const { search, SafeSearchType } = yield Promise.resolve().then(() => __importStar(require('duck-duck-scrape')));
                console.log('[Scraper] Trying duck-duck-scrape library');
                const ddgResults = yield search(search_query, {
                    safeSearch: SafeSearchType.MODERATE
                });
                results = ddgResults.results.slice(0, searchLimit).map(r => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.description || '',
                }));
                console.log(`[Scraper] duck-duck-scrape returned ${results.length} results`);
            }
            catch (e) {
                console.error('[Scraper] duck-duck-scrape failed:', e.message || e);
            }
        }
        // 3. Fallback to DuckDuckGo HTML scraping
        if (results.length === 0) {
            console.log('[Scraper] Trying DuckDuckGo HTML scraping');
            results = yield searchDuckDuckGo(search_query, searchLimit);
            console.log(`[Scraper] DuckDuckGo HTML returned ${results.length} results`);
        }
        // 4. Final fallback to Google
        if (results.length === 0) {
            console.log('[Scraper] Trying Google scraping');
            results = yield searchGoogle(search_query, searchLimit);
            console.log(`[Scraper] Google returned ${results.length} results`);
        }
        return results;
    });
}
// Extract favicon URL
function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    }
    catch (_a) {
        return '';
    }
}
// Extract main content
function extractPageContent(url, snippet) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        console.log(`[Scraper] Fetching content from: ${new URL(url).hostname}`);
        try {
            const response = yield axiosInstance.get(url, { timeout: 10000 });
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
                }
                catch (_b) { }
            }
            const ogVideo = $('meta[property="og:video"]').attr('content') ||
                $('meta[property="og:video:url"]').attr('content') ||
                $('meta[property="og:video:secure_url"]').attr('content') ||
                $('meta[name="twitter:player"]').attr('content');
            const ogAudio = $('meta[property="og:audio"]').attr('content') ||
                $('meta[property="og:audio:url"]').attr('content') ||
                $('meta[property="og:audio:secure_url"]').attr('content');
            let mediaType = 'image';
            let mediaUrl = undefined;
            if (ogVideo) {
                mediaType = 'video';
                mediaUrl = ogVideo;
            }
            else if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com')) {
                mediaType = 'video';
                mediaUrl = url;
            }
            if (ogAudio) {
                mediaType = 'audio';
                mediaUrl = ogAudio;
            }
            else if (url.includes('soundcloud.com') || url.includes('spotify.com') || url.includes('bandcamp.com')) {
                mediaType = 'audio';
                mediaUrl = url;
                if (!image) {
                    image = 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png';
                }
            }
            if (mediaUrl && !mediaUrl.startsWith('http')) {
                try {
                    mediaUrl = new URL(mediaUrl, url).toString();
                }
                catch (_c) { }
            }
            const { document } = (0, linkedom_1.parseHTML)(html);
            const reader = new readability_1.Readability(document);
            const article = reader.parse();
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
        }
        catch (error) {
            const errorCode = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status;
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
    });
}
// Combined search and scrape
function searchAndScrape(query_1) {
    return __awaiter(this, arguments, void 0, function* (query, focusMode = 'web') {
        console.log(`[Scraper] Starting searchAndScrape for: "${query}"`);
        const searchResults = yield searchWeb(query, 5, focusMode);
        if (searchResults.length === 0) {
            console.log('[Scraper] No search results found');
            return { sources: [], searchResults: [] };
        }
        console.log(`[Scraper] Got ${searchResults.length} search results, attempting to scrape content...`);
        let sources = [];
        try {
            const scrapePromise = Promise.allSettled(searchResults.map(r => extractPageContent(r.url, r.snippet)));
            const timeoutPromise = new Promise((resolve) => setTimeout(() => {
                console.log('[Scraper] Scraping timed out, using fallback');
                resolve([]);
            }, 10000) // Increased timeout for server
            );
            const results = yield Promise.race([scrapePromise, timeoutPromise]);
            sources = results
                .filter((r) => r.status === 'fulfilled')
                .map(r => r.value)
                .filter((content) => content !== null);
            console.log(`[Scraper] Successfully scraped ${sources.length} pages`);
        }
        catch (error) {
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
    });
}
