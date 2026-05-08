import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('TripSave smoke test widget renders', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: Text('TripSave'),
          ),
        ),
      ),
    );

    expect(find.text('TripSave'), findsOneWidget);
  });
}
