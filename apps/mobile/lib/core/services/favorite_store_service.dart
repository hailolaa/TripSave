import 'package:shared_preferences/shared_preferences.dart';

class FavoriteStoreService {
  static const String _favoritesKey = 'trip_save_favorite_stores';
  final SharedPreferences _prefs;

  FavoriteStoreService(this._prefs);

  List<String> getFavoriteStoreNames() {
    return _prefs.getStringList(_favoritesKey) ?? <String>[];
  }

  bool isFavorite(String storeName) {
    final favorites = getFavoriteStoreNames();
    return favorites.contains(storeName.toLowerCase());
  }

  Future<void> toggleFavorite(String storeName) async {
    final normalized = storeName.toLowerCase();
    final favorites = getFavoriteStoreNames();
    if (favorites.contains(normalized)) {
      favorites.remove(normalized);
    } else {
      favorites.add(normalized);
    }
    await _prefs.setStringList(_favoritesKey, favorites);
  }
}
