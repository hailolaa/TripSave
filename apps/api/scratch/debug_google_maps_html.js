const axios = require('axios');
const fs = require('fs');

async function debugGoogleMapsHtml() {
  const username = 'hailolaa_1nqoK';
  const password = 'Moadsahaka+21';
  const query = 'gas stations in TX';

  console.log(`Scraping Google Maps for: ${query}`);

  try {
    const response = await axios.post('https://realtime.oxylabs.io/v1/queries', {
      source: 'google_maps',
      geo_location: 'United States',
      query: query,
    }, {
      auth: { username, password }
    });

    const html = response.data?.results?.[0]?.content || '';
    if (html) {
      fs.writeFileSync('d:\\Project\\TripSave\\apps\\api\\scratch\\google_maps_response.html', html);
      console.log('HTML saved to scratch\\google_maps_response.html');
      console.log('HTML Length:', html.length);
      console.log('Snippet:', html.substring(0, 500));
    } else {
      console.log('No HTML content in response.');
      console.log('Full Response:', JSON.stringify(response.data, null, 2).substring(0, 500));
    }
  } catch (error) {
    console.error('Debug failed:', error.response?.data || error.message);
  }
}

debugGoogleMapsHtml();
