import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class SavingsRecord {
  final String id;
  final DateTime date;
  final String storeName;
  final double amountSaved;
  final String category;
  final String iconName;

  SavingsRecord({
    required this.id,
    required this.date,
    required this.storeName,
    required this.amountSaved,
    required this.category,
    required this.iconName,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'date': date.toIso8601String(),
    'storeName': storeName,
    'amountSaved': amountSaved,
    'category': category,
    'iconName': iconName,
  };

  factory SavingsRecord.fromJson(Map<String, dynamic> json) => SavingsRecord(
    id: json['id'],
    date: DateTime.parse(json['date']),
    storeName: json['storeName'],
    amountSaved: json['amountSaved'].toDouble(),
    category: json['category'],
    iconName: json['iconName'],
  );
}

class SavingsRepository {
  final SharedPreferences _prefs;
  static const String _storageKey = 'tripsave_savings_records';

  SavingsRepository(this._prefs);

  List<SavingsRecord> getRecords() {
    final String? jsonStr = _prefs.getString(_storageKey);
    if (jsonStr == null) return [];
    final List<dynamic> decoded = json.decode(jsonStr);
    return decoded.map((item) => SavingsRecord.fromJson(item)).toList();
  }

  Future<void> addRecord(SavingsRecord record) async {
    final records = getRecords();
    records.insert(0, record);
    await _prefs.setString(_storageKey, json.encode(records.map((r) => r.toJson()).toList()));
  }

  Future<void> clearAll() async {
    await _prefs.remove(_storageKey);
  }

  double getTotalSaved() {
    return getRecords().fold(0.0, (sum, item) => sum + item.amountSaved);
  }
}
