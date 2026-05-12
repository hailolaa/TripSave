import 'package:shared_preferences/shared_preferences.dart';

class SettingsService {
  final SharedPreferences _prefs;

  SettingsService(this._prefs);

  double get mpg => _prefs.getDouble('trip_save_mpg') ?? 25.0;
  Future<void> setMpg(double value) => _prefs.setDouble('trip_save_mpg', value);

  double get gasPrice => _prefs.getDouble('trip_save_gas_price') ?? 3.50;
  Future<void> setGasPrice(double value) => _prefs.setDouble('trip_save_gas_price', value);

  double get gasCostPerMile => gasPrice / mpg;

  Future<void> clear() async {
    await _prefs.remove('trip_save_mpg');
    await _prefs.remove('trip_save_gas_price');
    await _prefs.remove('trip_save_gas_cost');
  }
}
