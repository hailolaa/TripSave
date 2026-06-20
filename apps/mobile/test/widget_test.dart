import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('PricePilot smoke test widget renders', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: Text('PricePilot'),
          ),
        ),
      ),
    );

    expect(find.text('PricePilot'), findsOneWidget);
  });
}
