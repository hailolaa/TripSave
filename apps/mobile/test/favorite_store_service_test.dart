import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trip_save/core/services/favorite_store_service.dart';

void main() {
  group('FavoriteStoreService', () {
    test('toggles and persists favorite store names normalized', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final service = FavoriteStoreService(prefs);

      expect(service.getFavoriteStoreNames(), isEmpty);

      await service.toggleFavorite('Walmart');
      expect(service.isFavorite('Walmart'), isTrue);
      expect(service.isFavorite('walmart'), isTrue);

      await service.toggleFavorite('Walmart');
      expect(service.isFavorite('Walmart'), isFalse);
      expect(service.getFavoriteStoreNames(), isEmpty);
    });
  });
}
