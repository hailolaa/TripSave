
// Manual mock test for radius filtering
const preferredRadius = 10;
const isRoundTrip = true;

const mockItems = [
    { 
        price: 5.00, 
        driving_distance: 8 * 2, // 8 miles one way
        store: { name: 'Close Store', lat: 32.7, lng: -96.8 }
    },
    { 
        price: 4.00, 
        driving_distance: 12 * 2, // 12 miles one way
        store: { name: 'Far Store', lat: 32.9, lng: -96.9 }
    },
    { 
        price: 4.50, 
        driving_distance: 5 * 2, // 5 miles one way
        store: { name: 'Very Close Store', lat: 32.75, lng: -96.85 }
    }
];

console.log(`--- Testing Radius Filtering (Radius: ${preferredRadius} miles) ---`);

const filteredItems = mockItems.filter((item: any) => {
    const dist = (item.driving_distance / (isRoundTrip ? 2 : 1));
    const isWithin = dist <= preferredRadius;
    console.log(`Store: ${item.store.name}, Distance: ${dist}mi -> ${isWithin ? 'KEEP' : 'REJECT'}`);
    return isWithin;
});

console.log(`Results: ${filteredItems.length} stores kept (Expected: 2)`);
if (filteredItems.length === 2 && !filteredItems.find(i => i.store.name === 'Far Store')) {
    console.log('RADIUS FILTERING TEST PASSED');
} else {
    console.log('RADIUS FILTERING TEST FAILED');
}
