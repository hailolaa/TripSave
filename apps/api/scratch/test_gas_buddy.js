const axios = require('axios');

async function testGasBuddy() {
  const GRAPHQL_URL = 'https://www.gasbuddy.com/graphql';
  const regionCode = 'TX';

  const query = `query LocationByArea($area: String, $countryCode: String, $criteria: Criteria, $fuel: Int, $lang: String, $regionCode: String) {
    locationByArea(area: $area, countryCode: $countryCode, criteria: $criteria, regionCode: $regionCode) {
      stations(fuel: $fuel) {
        results {
          id
          name
          prices(fuel: $fuel) {
            fuelType
            cash { price }
            credit { price }
          }
        }
      }
    }
  }`;

  // Try to fetch multiple fuel types or check if it returns all if fuel is omitted
  const variables = {
    countryCode: 'US',
    criteria: { location_type: 'region' },
    lang: 'en',
    regionCode,
    // fuel: 1 // Omitted to see what happens
  };

  try {
    console.log('Testing GasBuddy API...');
    const response = await axios.post(GRAPHQL_URL, {
      operationName: 'LocationByArea',
      query,
      variables,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 15000,
    });

    const results = response.data.data.locationByArea.stations.results;
    console.log(`Found ${results.length} stations.`);
    
    // Check first station prices
    if (results.length > 0) {
      console.log('First station:', results[0].name);
      console.log('Prices:', JSON.stringify(results[0].prices, null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testGasBuddy();
