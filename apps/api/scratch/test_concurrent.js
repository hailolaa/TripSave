const axios = require('axios');

async function runTest() {
  const url = 'http://213.199.35.225/tripsave/gas/sync';
  const body = { location: 'Denver, CO' };

  console.log('Sending 2 concurrent POST requests to /gas/sync for Denver, CO...');
  const start = Date.now();

  const requests = [1, 2].map(id => {
    return axios.post(url, body)
      .then(res => {
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        console.log(`[Request ${id}] Success in ${duration}s! Response:`, res.data);
      })
      .catch(err => {
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        console.error(`[Request ${id}] Failed in ${duration}s! Error:`, err.response?.data || err.message);
      });
  });

  await Promise.all(requests);
  console.log('Test completed.');
}

runTest();
