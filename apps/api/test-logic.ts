
import { calculateDriveCost } from './src/utils/geo.util';

function testDriveCost() {
    console.log('--- Testing Drive Cost Calculation ($0.72/mile) ---');
    
    const testCases = [
        { distance: 5, isRoundTrip: true, expected: 5 * 2 * 0.72 },
        { distance: 10, isRoundTrip: true, expected: 10 * 2 * 0.72 },
        { distance: 5, isRoundTrip: false, expected: 5 * 0.72 },
        { distance: 20, isRoundTrip: true, expected: 20 * 2 * 0.72 },
    ];

    testCases.forEach((tc, i) => {
        const result = calculateDriveCost(tc.distance, 25, 3.50, tc.isRoundTrip);
        const passed = Math.abs(result - tc.expected) < 0.01;
        console.log(`Test ${i + 1}: Distance ${tc.distance}mi, RoundTrip: ${tc.isRoundTrip}`);
        console.log(`   Result: $${result.toFixed(2)}, Expected: $${tc.expected.toFixed(2)} -> ${passed ? 'PASSED' : 'FAILED'}`);
    });
}

testDriveCost();
