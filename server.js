const axios = require('axios');
const xml2js = require('xml2js');
const puppeteer = require('puppeteer');
const querystring = require('querystring');
require('events').EventEmitter.defaultMaxListeners = 50; // Increase as needed

// Global axios instance with headers
const axiosInstance = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.google.com/'
    },
    validateStatus: () => true  // Accept all status codes
});

async function testFinalUrl(domain) {
    try {
        const response = await axiosInstance.get(`https://${domain}`);
        return {
            status: response.status,
            url: response.request.res.responseUrl,
            isFinal: true
        };
    } catch (error) {
        return { status: null, error: error.message, isFinal: true };
    }
}

function printResult(result) {
    console.log("Final URL Test Result:");
    const { status, url, error } = result;
    const statusEmoji = status === 200 ? '✅' : '❌';
    console.log(`${statusEmoji} ${url}: Status ${status}, Error: ${error || 'None'}`);
}

async function retrieveSitemap(url) {
    try {
        const response = await axiosInstance.get(url);
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);

        let urls = [];
        if (result.urlset) {
            urls = result.urlset.url.map(u => u.loc[0]);
        } else if (result.sitemapindex) {
            for (const sitemap of result.sitemapindex.sitemap) {
                const loc = sitemap.loc[0];
                const subUrls = await retrieveSitemap(loc);
                urls.push(...subUrls);
            }
        }
        return urls;
    } catch (error) {
        console.error(`Error retrieving sitemap: ${error.message}`);
        return []; // Ensure that an array is returned even in case of an error
    }
}


async function captureAnalyticsRequests(url, watchlist) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
      // Disable the cache
      await page.setCacheEnabled(false);

    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.google.com/'
    });

    const capturedRequests = {};
    page.on('request', request => {
        const requestUrl = request.url();
        for (const watchUrl of watchlist) {
            if (requestUrl.startsWith(watchUrl)) {
                if (!capturedRequests[watchUrl]) {
                    capturedRequests[watchUrl] = [];
                }
                capturedRequests[watchUrl].push({
                    url: requestUrl,
                    method: request.method(),
                    postData: request.postData(),
                    headers: request.headers()
                });
            }
        }
    });

    await page.goto(url, { waitUntil: 'networkidle0' });
      // Add a slight delay to capture late requests
   await new Promise(resolve => setTimeout(resolve, 2000)); 
    await browser.close();
    return capturedRequests;
}

function parseGoogleAnalyticsHits(requests) {
    return requests.map(request => {
        const parsedUrl = new URL(request.url);
        const params = querystring.parse(parsedUrl.search.substring(1));
        const hitType = params.en || 'Unknown';
        const tid = params.tid || 'Unknown ID';
        return `GA4: ${tid} | ${hitType}`;
    });
}

async function processUrl(browser, url, watchlist) {
    console.log(`Processing URL: ${url}`);
    const page = await browser.newPage();

    // Disable the cache
    await page.setCacheEnabled(false);

    // Set custom headers
    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.google.com/'
    });

    const capturedRequests = {};
    page.on('request', request => {
        const requestUrl = request.url();
        for (const watchUrl of watchlist) {
            if (requestUrl.startsWith(watchUrl)) {
                if (!capturedRequests[watchUrl]) {
                    capturedRequests[watchUrl] = [];
                }
                capturedRequests[watchUrl].push({
                    url: requestUrl,
                    method: request.method(),
                    postData: request.postData(),
                    headers: request.headers()
                });
            }
        }
    });

    await page.goto(url, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second

    await page.close();

    // Process and log Google Analytics hits
    if (capturedRequests['https://analytics.google.com'] || capturedRequests['https://www.google-analytics.com/g/']) {
        const googleAnalyticsUrls = ['https://analytics.google.com', 'https://www.google-analytics.com/g/'];
        let allGoogleHits = [];
        for (const gaUrl of googleAnalyticsUrls) {
            if (capturedRequests[gaUrl]) {
                const googleHits = parseGoogleAnalyticsHits(capturedRequests[gaUrl]);
                allGoogleHits = allGoogleHits.concat(googleHits);
            }
        }

        if (allGoogleHits.length > 0) {
            console.log(`Google Analytics hits for ${url}: ${allGoogleHits.length}`);
            allGoogleHits.forEach(hit => console.log(` - ${hit}`));
        }
    }
    return capturedRequests;
}

(async () => {
    const domain = 'chlprep.com';
    const finalResult = await testFinalUrl(domain);
    printResult(finalResult);

    if (finalResult.status === 200) {
        const sitemapUrl = finalResult.url + '/sitemap_index.xml';
        let sitemapUrls = await retrieveSitemap(sitemapUrl);

        if (sitemapUrls.length === 0) {
            sitemapUrls = [finalResult.url];
        }

        console.log(`Number of URLs found in sitemap (or landing page): ${sitemapUrls.length}`);

        const watchlist = [
            'https://googleads.g.doubleclick.net',
            'https://www.facebook.com/tr/',
            'https://bat.bing.com/action/',
            'https://analytics.google.com',
            'https://www.google-analytics.com/g/'
        ];

        const maxConcurrentTasks = 10; // Adjust as needed
        const browser = await puppeteer.launch({ headless: "new" });

        for (let i = 0; i < sitemapUrls.length; i += maxConcurrentTasks) {
            const batch = sitemapUrls.slice(i, i + maxConcurrentTasks);
            await Promise.all(batch.map(url => processUrl(browser, url, watchlist)));
        }

        await browser.close();
    } else {
        console.error("Error: Unable to retrieve final URL for sitemap.");
    }
})();