import 'package:shared_preferences/shared_preferences.dart';

class SettingsService {
  final SharedPreferences _prefs;

  SettingsService(this._prefs);

  double get mpg => _prefs.getDouble('trip_save_mpg') ?? 36.0;
  Future<void> setMpg(double value) => _prefs.setDouble('trip_save_mpg', value);

  double get gasCostPerMile => _prefs.getDouble('trip_save_gas_cost') ?? 0.10;
  Future<void> setGasCostPerMile(double value) => _prefs.setDouble('trip_save_gas_cost', value);
}
