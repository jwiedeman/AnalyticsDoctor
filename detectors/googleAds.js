module.exports = {
    name: 'Google Ads',
    patterns: [
        'https://googleads.g.doubleclick.net/',
    ],
    parseRequest: (requestUrl) => {
        console.log(`Attempting to parse Google Ads request: ${requestUrl}`);
        try {
            const url = new URL(requestUrl);
            let callType = 'Unknown';
            let eventType = 'Not specified';
            let accountId = url.pathname.split('/')[3]; // Extract Account ID from the URL path
            // Attempt to extract 'event' parameter for more specific call type/event type identification
            let eventData = url.searchParams.get('data') || 'Not specified';

            if (eventData.includes('event=')) {
                eventType = eventData.split('=')[1];
                callType = eventType.charAt(0).toUpperCase() + eventType.slice(1); // Capitalize the first letter and make the rest lowercase
            }

            if (accountId.startsWith('AW-')) {
                console.log(`Found Account ID: ${accountId}, Call Type: ${callType}, Event Type: ${eventType}`);
                return {
                    accountId,
                    callType,
                    eventType,
                    calls: 1
                };
            } else {
                console.log(`No valid Account ID found in URL: ${requestUrl}`);
                return { accountId: 'Unknown ID', callType, eventType, calls: 1 };
            }
        } catch (error) {
            console.error(`Error parsing Google Ads URL: ${requestUrl}`, error);
            return { accountId: 'Invalid URL', callType: 'Error', eventType: 'Error', calls: 0 };
        }
    },
};
