async function connectToDatabase() {
    try {
      await client.connect();
      console.log('Connected to MongoDB');
      initializeDataStore();
      startExpressServer();
    } catch (err) {
      console.error('Error connecting to MongoDB:', err);
    }
  }
  
  function initializeDataStore() {
    dataStore.domains = [];
  }
  
  const dataStore = {
    domains: [],
  };
  
  function createDomain(name) {
    const domain = {
      id: dataStore.domains.length + 1,
      name,
      urls: [],
      detectedAnalytics: [],
    };
    dataStore.domains.push(domain);
    return domain;
  }
  
  function addUrlToDomain(domain, url) {
    const newUrl = {
      url,
      last_crawled: null,
    };
    domain.urls.push(newUrl);
    return newUrl;
  }
  
  function addDetectedAnalyticsToDomain(domain, library) {
    const detectedAnalytics = {
      library,
      urls: [],
      hits: [],
    };
    domain.detectedAnalytics.push(detectedAnalytics);
    return detectedAnalytics;
  }
  
  function addHitToAnalytics(detectedAnalytics, url) {
    detectedAnalytics.urls.push(url);
    detectedAnalytics.hits.push({ url });
  }
  
  async function startExpressServer() {
    const app = express();
    app.use(bodyParser.json());
  
    // Create a new domain
    app.post('/domains', (req, res) => {
      const { name } = req.body;
      const domain = createDomain(name);
      res.json(domain);
    });
  
    // Retrieve all domains
    app.get('/domains', (req, res) => {
      res.json(dataStore.domains);
    });
  
    // Retrieve a specific domain by ID
    app.get('/domains/:id', (req, res) => {
      const { id } = req.params;
      const domain = dataStore.domains.find((d) => d.id === parseInt(id));
      if (domain) {
        res.json(domain);
      } else {
        res.status(404).json({ error: 'Domain not found' });
      }
    });
  
    // Add a URL to a domain
    app.post('/domains/:id/url', (req, res) => {
      const { id } = req.params;
      const domain = dataStore.domains.find((d) => d.id === parseInt(id));
      if (domain) {
        const { url } = req.body;
        const newUrl = addUrlToDomain(domain, url);
        res.json(newUrl);
      } else {
        res.status(404).json({ error: 'Domain not found' });
      }
    });
  
    // Update a domain by ID
app.put('/domains/:id', (req, res) => {
    const { id } = req.params;
    const domain = dataStore.domains.find((d) => d.id === parseInt(id));
    if (domain) {
      const { name } = req.body;
      domain.name = name;
      res.json(domain);
    } else {
      res.status(404).json({ error: 'Domain not found' });
    }
  });
  
  // Delete a domain by ID
  app.delete('/domains/:id', (req, res) => {
    const { id } = req.params;
    const index = dataStore.domains.findIndex((d) => d.id === parseInt(id));
    if (index !== -1) {
      dataStore.domains.splice(index, 1);
      res.json({ message: 'Domain deleted successfully' });
    } else {
      res.status(404).json({ error: 'Domain not found' });
    }
  });
  
  // Update a URL by domain ID and URL ID
  app.put('/domains/:domainId/url/:urlId', (req, res) => {
    const { domainId, urlId } = req.params;
    const domain = dataStore.domains.find((d) => d.id === parseInt(domainId));
    if (domain) {
      const { url, last_crawled } = req.body;
      const urlToUpdate = domain.urls.find((u) => u.id === parseInt(urlId));
      if (urlToUpdate) {
        urlToUpdate.url = url || urlToUpdate.url;
        urlToUpdate.last_crawled = last_crawled || urlToUpdate.last_crawled;
        res.json(urlToUpdate);
      } else {
        res.status(404).json({ error: 'URL not found' });
      }
    } else {
      res.status(404).json({ error: 'Domain not found' });
    }
  });
  
  // Delete a URL by domain ID and URL ID
  app.delete('/domains/:domainId/url/:urlId', (req, res) => {
    const { domainId, urlId } = req.params;
    const domain = dataStore.domains.find((d) => d.id === parseInt(domainId));
    if (domain) {
      const index = domain.urls.findIndex((u) => u.id === parseInt(urlId));
      if (index !== -1) {
        domain.urls.splice(index, 1);
        res.json({ message: 'URL deleted successfully' });
      } else {
        res.status(404).json({ error: 'URL not found' });
      }
    } else {
      res.status(404).json({ error: 'Domain not found' });
    }
  });
  
  // Update detected analytics by domain ID and analytics ID
  app.put('/domains/:domainId/analytics/:analyticsId', (req, res) => {
    const { domainId, analyticsId } = req.params;
    const domain = dataStore.domains.find((d) => d.id === parseInt(domainId));
    if (domain) {
      const { library } = req.body;
      const analyticsToUpdate = domain.detectedAnalytics.find((a) => a.id === parseInt(analyticsId));
      if (analyticsToUpdate) {
        analyticsToUpdate.library = library || analyticsToUpdate.library;
        res.json(analyticsToUpdate);
      } else {
        res.status(404).json({ error: 'Detected analytics not found' });
      }
    } else {
      res.status(404).json({ error: 'Domain not found' });
    }
  });
  
  // Delete detected analytics by domain ID and analytics ID
  app.delete('/domains/:domainId/analytics/:analyticsId', (req, res) => {
    const { domainId, analyticsId } = req.params;
    const domain = dataStore.domains.find((d) => d.id === parseInt(domainId));
    if (domain) {
      const index = domain.detectedAnalytics.findIndex((a) => a.id === parseInt(analyticsId));
      if (index !== -1) {
        domain.detectedAnalytics.splice(index, 1);
        res.json({ message: 'Detected analytics deleted successfully' });
      } else {
        res.status(404).json({ error: 'Detected analytics not found' });
      }
    } else {
      res.status(404).json({ error: 'Domain not found' });
    }
  });
  
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  }
  
  connectToDatabase();