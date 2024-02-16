const GoogleAnalytics = require('./googleAnalytics');
const GoogleTagManager = require('./googleTagManager');
const GoogleAds = require('./googleAds');
const MetaAds = require('./metaAds');
const MicrosoftAds = require('./microsoftAds');

module.exports = [
    GoogleAnalytics,
    GoogleTagManager,
    GoogleAds,
    MetaAds,
    MicrosoftAds
    // Add more detectors here as you create them
];
