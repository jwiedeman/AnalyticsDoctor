const mongoose = require('mongoose');
const Domain = require('./models/Domain'); // Ensure correct import path
const retrieveSitemapUrls = require('./services/retrieveSitemapUrls'); // Ensure correct import path
const processUrl = require('./services/processUrl'); // Ensure correct import path

const mongoConnectionString = 'mongodb://127.0.0.1/AnalyticsDr';

// MongoDB connection
mongoose.connect(mongoConnectionString, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected successfully for Palantir.'))
  .catch(err => console.error('MongoDB connection error in Palantir:', err));

  async function processDomainsReadyForCrawl() {
    console.log("Checking for domains ready for crawl...");
  
    // Fetch all domains ready for crawl
    const domainsToCrawl = await Domain.find({ crawlRequest: null });
  
    // Process up to 5 domains concurrently
    const concurrencyLimit = 5;
    for (let i = 0; i < domainsToCrawl.length; i += concurrencyLimit) {
      // Slice the domainsToCrawl array to get the next batch based on concurrencyLimit
      const batch = domainsToCrawl.slice(i, i + concurrencyLimit);
  
      // Map each domain in the current batch to a processing Promise
      const batchPromises = batch.map(domain => processDomain(domain));
  
      // Wait for all Promises in the batch to resolve
      await Promise.all(batchPromises);
    }
  
    console.log("Finished processing domains ready for crawl.");
  }
  
  // Helper function to process a single domain
  async function processDomain(domain) {
    console.log(`Domain ${domain.domain} is ready for crawl.`);

    try {
        // Only fetch the sitemap if the domain's URLs array is empty
        if (domain.urls.length === 0) {
            const sitemapUrl = `https://${domain.domain}/sitemap.xml`;
            console.log(`Fetching sitemap for domain: ${domain.domain}`);
            let urls = await retrieveSitemapUrls(sitemapUrl);

            // Limit the number of URLs to the first 100
            urls = urls.slice(0, 100);

            // Prepare URL objects for insertion
            const urlObjects = urls.map(url => ({
                url: url,
                status: 'pending', // Set initial status
            }));

            // Bulk update to insert URL objects into the domain document
            await Domain.updateOne(
                { _id: domain._id },
                { $set: { urls: urlObjects } }
            );

            console.log(`Sitemap URLs updated for domain: ${domain.domain}, limited to the first 100 URLs.`);
        } else {
            console.log(`Existing URLs found for domain: ${domain.domain}, skipping sitemap fetch.`);
        }

        // Process each URL one at a time to avoid overwhelming the server
        for (const urlObj of domain.urls) {
            if (urlObj.status !== 'completed') {
                try {
                    console.log(`Processing URL: ${urlObj.url} for domain: ${domain.domain}`);
                    await processUrl(domain.domain, urlObj.url);
                    console.log(`URL processed: ${urlObj.url}`);
                } catch (error) {
                    console.error(`Error processing URL: ${urlObj.url} for domain: ${domain.domain}`, error);
                    // Optionally update the URL status to 'error' or similar
                }
            } else {
                console.log(`Skipping completed URL: ${urlObj.url}`);
            }
        }

        console.log(`Completed crawl for domain: ${domain.domain}`);
    } catch (error) {
        console.error(`Error processing domain ${domain.domain}:`, error);
        // Handle domain-level errors, such as issues fetching the sitemap
    }
}

  
  
  

  async function main() {
    while (true) {
      await processDomainsReadyForCrawl();
      console.log("Waiting before checking for more domains to crawl...");
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds before checking again
    }
  }
  
  main().catch(console.error);
  