import 'package:shared_preferences/shared_preferences.dart';

class SettingsService {
  final SharedPreferences _prefs;

  SettingsService(this._prefs);

  int get preferredRadius => _prefs.getInt('trip_save_radius') ?? 20;
  Future<void> setPreferredRadius(int value) => _prefs.setInt('trip_save_radius', value);

  double get gasCostPerMile => 0.72; // Fixed drive cost per mile as requested

  bool get notificationsEnabled => _prefs.getBool('notifications_enabled') ?? true;
  Future<void> setNotificationsEnabled(bool value) => _prefs.setBool('notifications_enabled', value);

  Future<void> clear() async {
    await _prefs.remove('trip_save_radius');
    await _prefs.remove('notifications_enabled');
  }
}
