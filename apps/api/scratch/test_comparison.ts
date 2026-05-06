import axios from 'axios';

async function test() {
  const baseUrl = 'http://localhost:3000/comparison';
  
  console.log('--- Testing Single Item Search (Milk) ---');
  try {
    const res = await axios.get(`${baseUrl}/compare`, {
      params: {
        query: 'milk',
        lat: 32.7767, // Dallas
        lng: -96.7970,
        mpg: 25,
        gasPrice: 3.50,
        zip: '75201'
      }
    });

    console.log(`Found ${res.data.length} results.`);
    res.data.forEach((item: any, i: number) => {
      console.log(`[${i+1}] Store: ${item.store.name}`);
      console.log(`    Distance: ${item.driving_distance} mi`);
      console.log(`    Total: $${item.true_cost}`);
      console.log(`    Savings: $${item.savings || 0}`);
      if (item.store.lat === 0) console.log('    WARNING: Missing coordinates!');
    });

  } catch (err: any) {
    console.error('Test failed:', err.message);
  }
}

test();
