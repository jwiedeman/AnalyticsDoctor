const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { URL } = require('url');
const http = require('http');
const https = require('https');

const DEFAULT_MAX_PAGES = 50;
const MAX_ALLOWED_PAGES = 250;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

const ANALYTICS_PATTERNS = {
  google_analytics: {
    src: ['googletagmanager.com/gtag/js', 'google-analytics.com/analytics.js'],
    idRegex: [/G-[A-Z0-9]+/g, /UA-\d+-\d+/g]
  },
  google_tag_manager: {
    src: ['googletagmanager.com/gtm.js'],
    idRegex: [/GTM-[A-Z0-9]+/g]
  },
  segment: {
    src: ['segment.com/analytics.js', 'cdn.segment.com'],
    idRegex: [/analytics\s*\.load\(['"]([A-Za-z0-9]+)['"]\)/gi]
  },
  meta_pixel: {
    src: ['connect.facebook.net'],
    idRegex: [/fbq\(['"]init['"],\s*['"](\d+)['"]\)/gi]
  },
  bing: {
    src: ['bat.bing.com'],
    idRegex: []
  }
};

function cleanDomain(domain) {
  domain = (domain || '').trim();
  if (!domain) return '';
  const parsed = new URL(domain.includes('://') ? domain : `http://${domain}`);
  let host = parsed.hostname.replace(/^www\./, '');
  return host.replace(/\/$/, '');
}

function findAnalytics(html) {
  const $ = cheerio.load(html);
  const text = $.html();
  const detected = {};

  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    for (const [name, patterns] of Object.entries(ANALYTICS_PATTERNS)) {
      for (const p of patterns.src) {
        if (src.includes(p)) {
          detected[name] = detected[name] || { ids: new Set(), method: null };
        }
      }
    }
  });

  for (const [name, patterns] of Object.entries(ANALYTICS_PATTERNS)) {
    for (const regex of patterns.idRegex) {
      let match;
      while ((match = regex.exec(text))) {
        detected[name] = detected[name] || { ids: new Set(), method: null };
        detected[name].ids.add(match[1] || match[0]);
      }
    }
  }

  if (detected.google_analytics) {
    if (detected.google_tag_manager) {
      detected.google_analytics.method = 'via gtm';
    } else if (detected.segment) {
      detected.google_analytics.method = 'via segment';
    } else {
      detected.google_analytics.method = 'native';
    }
  }

  if (detected.google_tag_manager && !detected.google_tag_manager.method) {
    detected.google_tag_manager.method = 'native';
  }
  if (detected.segment && !detected.segment.method) {
    detected.segment.method = 'native';
  }
  if (detected.meta_pixel && !detected.meta_pixel.method) {
    detected.meta_pixel.method = 'native';
  }
  if (detected.bing && !detected.bing.method) {
    detected.bing.method = 'native';
  }

  return detected;
}

function mergeAnalytics(target, pageData) {
  for (const [name, data] of Object.entries(pageData)) {
    const entry = target[name] || { ids: new Set(), method: data.method };
    data.ids.forEach(id => entry.ids.add(id));
    if (!entry.method && data.method) entry.method = data.method;
    target[name] = entry;
  }
}

function serializeAnalytics(data) {
  const out = {};
  for (const [name, info] of Object.entries(data)) {
    out[name] = { ids: Array.from(info.ids), method: info.method };
  }
  return out;
}

function directFetch(url) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    lib
      .get(url, res => {
        if (res.statusCode >= 400) {
          reject(new Error(`Status ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

async function fetchPage(page, url) {
  try {
    console.log(`Fetching ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    return await page.content();
  } catch (err) {
    console.error(`Failed to fetch ${url} with browser:`, err);
    try {
      console.log(`Attempting direct fetch for ${url}`);
      return await directFetch(url);
    } catch (directErr) {
      console.error(`Direct fetch failed for ${url}:`, directErr);
      return null;
    }
  }
}


async function crawlVariant(page, baseUrl, visited, scannedUrls, found, pageResults, queue, maxPages, progress) {

  const baseHost = new URL(baseUrl).host;
  while (queue.length && scannedUrls.length < maxPages) {
    const url = queue.shift();
    console.log('Crawling:', url);
    if (visited.has(url)) continue;
    visited.add(url);
    const html = await fetchPage(page, url);
    if (!html) continue;
    scannedUrls.push(url);
    if (progress) {
      progress({ url, scanned: scannedUrls.length });
    }

    const pageData = findAnalytics(html);
    mergeAnalytics(found, pageData);
    pageResults[url] = serializeAnalytics(pageData);


    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const link = new URL($(el).attr('href'), url).href;
      if (new URL(link).host === baseHost && !visited.has(link) && scannedUrls.length + queue.length < maxPages) {
        queue.push(link);
      }
    });
  }
}

async function scanVariants(variants, progress = () => {}, maxPages = DEFAULT_MAX_PAGES) {
  console.log('Starting scan of variants:', variants);
  const scanned = [];
  const working = [];
  const found = {};
  const pageResults = {};
  const visited = new Set();

  const launchOpts = { headless: 'new', args: ['--no-sandbox'] };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const browser = await puppeteer.launch(launchOpts);
  console.log('Browser launched');
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);

  try {
    for (const base of variants) {
      if (scanned.length >= maxPages) break;
      console.log('Scanning base URL:', base);
      const html = await fetchPage(page, base);
      if (!html) continue;
      working.push(base);
      scanned.push(base);
      visited.add(base);

      const baseData = findAnalytics(html);
      mergeAnalytics(found, baseData);
      pageResults[base] = serializeAnalytics(baseData);

      mergeAnalytics(found, findAnalytics(html));
      progress({ url: base, scanned: scanned.length });


      const $ = cheerio.load(html);
      const queue = [];
      $('a[href]').each((_, el) => {
        const link = new URL($(el).attr('href'), base).href;
        if (new URL(link).host === new URL(base).host && !visited.has(link)) {
          queue.push(link);
        }
      });


      await crawlVariant(page, base, visited, scanned, found, pageResults, queue, maxPages, progress);

    }

    const result = {};
    for (const [name, data] of Object.entries(found)) {
      result[name] = { ids: Array.from(data.ids), method: data.method };
    }

    const summary = {
      working_variants: working,
      scanned_urls: scanned,
      found_analytics: result,
      page_results: pageResults
    };
    console.log('Scan summary:', summary);
    return summary;
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`Incoming ${req.method} ${req.url}`, req.body);
  next();
});

app.post('/scan', async (req, res) => {
  const domain = cleanDomain(req.body.domain || '');
  const maxPagesInput = parseInt(req.body.maxPages, 10);
  const maxPages = Math.min(
    MAX_ALLOWED_PAGES,
    isNaN(maxPagesInput) ? DEFAULT_MAX_PAGES : Math.max(1, maxPagesInput)
  );
  const variants = Array.from(new Set([
    `http://${domain}`,
    `https://${domain}`,
    `http://www.${domain}`,
    `https://www.${domain}`
  ].filter(Boolean)));
  console.log('Scanning variants:', variants);
  try {
    const result = await scanVariants(variants, undefined, maxPages);
    res.json(result);
  } catch (err) {
    console.error('Scan failed:', err);
    res.status(500).json({ error: err.toString() });
  }
});

app.get('/scan-stream', async (req, res) => {
  const domain = cleanDomain(req.query.domain || '');
  const maxPagesInput = parseInt(req.query.maxPages, 10);
  const maxPages = Math.min(
    MAX_ALLOWED_PAGES,
    isNaN(maxPagesInput) ? DEFAULT_MAX_PAGES : Math.max(1, maxPagesInput)
  );
  const variants = Array.from(new Set([
    `http://${domain}`,
    `https://${domain}`,
    `http://www.${domain}`,
    `https://www.${domain}`
  ].filter(Boolean)));
  console.log('Streaming scan for variants:', variants);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();
  try {
    const result = await scanVariants(variants, update => {
      res.write(`data: ${JSON.stringify(update)}\n\n`);
    }, maxPages);
    res.write(`data: ${JSON.stringify({ done: true, result })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Streaming scan failed:', err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.toString() })}\n\n`);
    res.end();
  }
});

// The backend defaults to port 5005 so it does not conflict with other
// services that may use port 5000 on the host machine.
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
