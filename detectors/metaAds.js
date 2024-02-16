module.exports = {
    name: 'Meta Ads',
    patterns: [
        'https://www.facebook.com/tr/',
    ],
    parseRequest: (requestUrl) => {
        console.log(`Attempting to parse Meta Ads request: ${requestUrl}`);
        try {
            const url = new URL(requestUrl);
            let callType = 'Unknown';
            let eventType = 'Not specified';
            let accountId = url.searchParams.get('id'); // Account ID for Meta Ads

            // Extracting the event type from the URL
            eventType = url.searchParams.get('ev') || 'Not specified';

            // Adjusting callType based on the eventType parameter
            callType = eventType.charAt(0).toUpperCase() + eventType.slice(1).toLowerCase(); // Capitalize the first letter and make the rest lowercase
            
            if (accountId) {
                console.log(`Found Account ID: ${accountId}, Call Type: ${callType}, Event Type: ${eventType}`);
                return { 
                    accountId, 
                    callType, 
                    eventType,
                    calls: 1 
                };
            } else {
                console.log(`No Account ID found in URL: ${requestUrl}`);
                return { accountId: 'Unknown ID', callType, eventType, calls: 1 };
            }
        } catch (error) {
            console.error(`Error parsing Meta Ads URL: ${requestUrl}`, error);
            return { accountId: 'Invalid URL', callType: 'Error', eventType: 'Error', calls: 0 };
        }
    },
};
