const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { URL } = require('url');
const http = require('http');
const https = require('https');

const MAX_PAGES = 500;
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
    detected.google_analytics.method = detected.google_tag_manager ? 'via gtm' : 'native';
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

async function crawlVariant(page, baseUrl, visited, scannedUrls, found, queue) {
  const baseHost = new URL(baseUrl).host;
  while (queue.length && scannedUrls.length < MAX_PAGES) {
    const url = queue.shift();
    console.log('Crawling:', url);
    if (visited.has(url)) continue;
    visited.add(url);
    const html = await fetchPage(page, url);
    if (!html) continue;
    scannedUrls.push(url);
    mergeAnalytics(found, findAnalytics(html));
    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const link = new URL($(el).attr('href'), url).href;
      if (new URL(link).host === baseHost && !visited.has(link) && scannedUrls.length + queue.length < MAX_PAGES) {
        queue.push(link);
      }
    });
  }
}

async function scanVariants(variants) {
  console.log('Starting scan of variants:', variants);
  const scanned = [];
  const working = [];
  const found = {};
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
      if (scanned.length >= MAX_PAGES) break;
      console.log('Scanning base URL:', base);
      const html = await fetchPage(page, base);
      if (!html) continue;
      working.push(base);
      scanned.push(base);
      visited.add(base);
      mergeAnalytics(found, findAnalytics(html));

      const $ = cheerio.load(html);
      const queue = [];
      $('a[href]').each((_, el) => {
        const link = new URL($(el).attr('href'), base).href;
        if (new URL(link).host === new URL(base).host && !visited.has(link)) {
          queue.push(link);
        }
      });

      await crawlVariant(page, base, visited, scanned, found, queue);
    }

    const result = {};
    for (const [name, data] of Object.entries(found)) {
      result[name] = { ids: Array.from(data.ids), method: data.method };
    }

    const summary = { working_variants: working, scanned_urls: scanned, found_analytics: result };
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
  const variants = Array.from(new Set([
    `http://${domain}`,
    `https://${domain}`,
    `http://www.${domain}`,
    `https://www.${domain}`
  ].filter(Boolean)));
  console.log('Scanning variants:', variants);
  try {
    const result = await scanVariants(variants);
    res.json(result);
  } catch (err) {
    console.error('Scan failed:', err);
    res.status(500).json({ error: err.toString() });
  }
});

// The backend defaults to port 5005 so it does not conflict with other
// services that may use port 5000 on the host machine.
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
