const axios = require('axios');
const xml2js = require('xml2js');

async function retrieveSitemapUrls(sitemapUrl) {
    try {
        const response = await axios.get(sitemapUrl);
        const parser = new xml2js.Parser({ explicitArray: false, trim: true });
        const result = await parser.parseStringPromise(response.data);

        let urls = [];
        if (result.urlset && result.urlset.url) {
            // Check if it's an array, if not, make it an array
            const urlEntries = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url];
            urls = urlEntries.map(u => (typeof u === 'string' ? u : u.loc));
        } else if (result.sitemapindex && result.sitemapindex.sitemap) {
            // Sitemap index
            const sitemaps = Array.isArray(result.sitemapindex.sitemap) ? result.sitemapindex.sitemap : [result.sitemapindex.sitemap];
            for (const sitemap of sitemaps) {
                const loc = sitemap.loc;
                const subUrls = await retrieveSitemapUrls(loc);
                urls.push(...subUrls);
            }
        }

        // De-duplicate URLs
        const uniqueUrls = [...new Set(urls)];
        return uniqueUrls;
    } catch (error) {
        console.error(`Error retrieving sitemap from: ${sitemapUrl}`, error);
        return [];
    }
}

module.exports = retrieveSitemapUrls;
