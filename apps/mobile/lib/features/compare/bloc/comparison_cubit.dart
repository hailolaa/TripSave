import 'dart:convert';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../../core/network/api_client.dart';
import '../../../core/services/location_service.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

abstract class ComparisonState extends Equatable {
  @override
  List<Object?> get props => [];
}

class ComparisonInitial extends ComparisonState {}
class ComparisonLoading extends ComparisonState {}
class ComparisonWarming extends ComparisonState {
  final String query;
  final String? storeType;
  ComparisonWarming({required this.query, this.storeType});
  @override
  List<Object?> get props => [query, storeType];
}
class ComparisonLoaded extends ComparisonState {
  final List<dynamic> results;
  final String sortBy;
  final bool isRoundTrip;
  final double? userLat;
  final double? userLng;
  final DateTime fetchedAt;
  final bool isLocalCache;
  final bool isStoreShells;
  final String? cacheAgeLabel;
  final int? cacheAgeHours;
  final String? query;
  
  ComparisonLoaded(
    this.results, {
    this.sortBy = 'true_cost',
    this.isRoundTrip = true,
    this.userLat,
    this.userLng,
    DateTime? fetchedAt,
    this.isLocalCache = false,
    this.isStoreShells = false,
    this.cacheAgeLabel,
    this.cacheAgeHours,
    this.query,
  }) : fetchedAt = fetchedAt ?? DateTime.now();
  
  @override
  List<Object?> get props => [results, sortBy, isRoundTrip, userLat, userLng, fetchedAt, isLocalCache, isStoreShells, cacheAgeLabel, cacheAgeHours, query];

  ComparisonLoaded copyWith({
    List<dynamic>? results,
    String? sortBy,
    bool? isRoundTrip,
    double? userLat,
    double? userLng,
    DateTime? fetchedAt,
    bool? isLocalCache,
    bool? isStoreShells,
    String? cacheAgeLabel,
    int? cacheAgeHours,
    String? query,
  }) {
    return ComparisonLoaded(
      results ?? this.results,
      sortBy: sortBy ?? this.sortBy,
      isRoundTrip: isRoundTrip ?? this.isRoundTrip,
      userLat: userLat ?? this.userLat,
      userLng: userLng ?? this.userLng,
      fetchedAt: fetchedAt ?? this.fetchedAt,
      isLocalCache: isLocalCache ?? this.isLocalCache,
      isStoreShells: isStoreShells ?? this.isStoreShells,
      cacheAgeLabel: cacheAgeLabel ?? this.cacheAgeLabel,
      cacheAgeHours: cacheAgeHours ?? this.cacheAgeHours,
      query: query ?? this.query,
    );
  }
}
class ComparisonError extends ComparisonState {
  final String message;
  ComparisonError(this.message);
  @override
  List<Object?> get props => [message];
}

class ComparisonCubit extends Cubit<ComparisonState> {
  final ApiClient apiClient;
  final LocationService locationService;

  String? _lastQuery;
  String? _lastStoreType;
  String _sortBy = 'true_cost';
  bool _isRoundTrip = true;
  bool _isLoading = false;

  ComparisonCubit(this.apiClient, this.locationService) : super(ComparisonInitial()) {
    _initConnectivityListener();
  }

  String get currentSortBy => _sortBy;
  bool get currentIsRoundTrip => _isRoundTrip;
  bool get hasData => state is ComparisonLoaded;

  void _initConnectivityListener() {
    Connectivity().onConnectivityChanged.listen((List<ConnectivityResult> results) {
      if (!results.contains(ConnectivityResult.none) && _lastQuery != null) {
        // Re-fetch when connectivity is restored silently
        searchItem(_lastQuery!, storeType: _lastStoreType, forceRefresh: false, isSilent: true);
      }
    });
  }

  void changeSort(String sortBy) {
    _sortBy = sortBy;
    if (state is ComparisonLoaded) {
      final currentState = state as ComparisonLoaded;
      final sortedResults = List<dynamic>.from(currentState.results);
      
      sortedResults.sort((a, b) {
        final aVal = a[sortBy] ?? 0.0;
        final bVal = b[sortBy] ?? 0.0;
        return (aVal as num).compareTo(bVal as num);
      });

      emit(currentState.copyWith(results: sortedResults, sortBy: sortBy));
    }
  }

  Future<void> _saveToLocalCache(String key, List<dynamic> results) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('cache_$key', jsonEncode(results));
  }

  Future<List<dynamic>?> _loadFromLocalCache(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final cachedData = prefs.getString('cache_$key');
    if (cachedData != null) {
      return jsonDecode(cachedData) as List<dynamic>;
    }
    return null;
  }

  String? get lastQuery => _lastQuery;
  String? get lastStoreType => _lastStoreType;

  Future<void> prefetch() async {
    return;
  }

  Future<void> fetchComparisons(List<dynamic> items, {String? storeType, bool forceRefresh = false, String? sortBy, bool? isRoundTrip}) async {
    final key = 'cart:${items.map((i) => i['product_id']).join(',')}';
    if (sortBy != null) _sortBy = sortBy;
    if (isRoundTrip != null) _isRoundTrip = isRoundTrip;

    if (!forceRefresh && state is ComparisonLoaded && _lastQuery == key && _lastStoreType == storeType && sortBy == null && isRoundTrip == null) {
      return;
    }

    emit(ComparisonLoading());
    try {
      final position = await locationService.getCurrentLocation();
      final double userLat = position.latitude;
      final double userLng = position.longitude;

      final data = {
        'userLat': userLat,
        'userLng': userLng,
        'items': items.map((i) => {
          'productId': i['product_id'],
          'quantity': i['quantity'] ?? 1,
        }).toList(),
      };

      if (storeType != null && storeType != 'all') data['storeType'] = storeType;
      data['sortBy'] = _sortBy;
      data['isRoundTrip'] = _isRoundTrip;

      final response = await apiClient.dio.post('/comparison/cart/compare', data: data);

      _lastQuery = key;
      _lastStoreType = storeType;
      emit(ComparisonLoaded(
        response.data, 
        sortBy: _sortBy, 
        isRoundTrip: _isRoundTrip, 
        userLat: userLat, 
        userLng: userLng,
        query: key,
      ));
    } catch (e) {
      emit(ComparisonError(ApiClient.parseError(e)));
    }
  }

  Future<void> searchItem(String itemName, {String? storeType, bool forceRefresh = false, String? sortBy, bool? isRoundTrip, bool isPolling = false, bool isSilent = false, bool isRetry = false, bool keepCurrentResultsOnWarm = false}) async {
    if (itemName.isEmpty) return;
    if (_isLoading && !isPolling && !isRetry) return;

    if (sortBy != null) _sortBy = sortBy;
    if (isRoundTrip != null) _isRoundTrip = isRoundTrip;

    final cacheKey = '${itemName}_${storeType}_$_sortBy';

    if (!forceRefresh && !isPolling && !isRetry && !isSilent) {
      if (state is ComparisonLoaded && _lastQuery == itemName && _lastStoreType == storeType && sortBy == null && isRoundTrip == null) {
        return;
      }
      
      // Local cache check first
      final cachedResults = await _loadFromLocalCache(cacheKey);
      if (cachedResults != null && cachedResults.isNotEmpty) {
        emit(ComparisonLoaded(cachedResults, sortBy: _sortBy, isRoundTrip: _isRoundTrip, isLocalCache: true, query: itemName));
      } else {
        emit(ComparisonLoading());
      }
    } else if (!isPolling && !isSilent && state is! ComparisonLoaded) {
      emit(ComparisonLoading());
    }

    _isLoading = true;
    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      if (connectivityResult.contains(ConnectivityResult.none) && !isRetry) {
        if (state is! ComparisonLoaded) emit(ComparisonError('No internet connection. Please try again.'));
        _isLoading = false;
        return;
      }

      final position = await locationService.getCurrentLocation();
      final double userLat = position.latitude;
      final double userLng = position.longitude;

      // PROGRESSIVE LOADING: fetch stores instantly first
      if (!isPolling && !isSilent && state is! ComparisonLoaded) {
        try {
          final storesResponse = await apiClient.dio.get('/stores', queryParameters: {'lat': userLat, 'lng': userLng, 'radius': 20});
          if (storesResponse.data is List) {
            var stores = storesResponse.data as List<dynamic>;
            
            // Smart progressive shell filtering to prevent UI glitches & mismatched store types
            final isGasSearch = storeType == 'gas' || itemName.toLowerCase() == 'gas' || itemName.toLowerCase().contains('fuel');
            
            if (isGasSearch) {
              // Strictly gas stations
              stores = stores.where((s) {
                final type = s['store']?['chain']?['type']?.toString().toLowerCase();
                return type == 'gas';
              }).toList();
            } else {
              // Grocery or pharmacy search (no gas stations to prevent glitches)
              stores = stores.where((s) {
                final type = s['store']?['chain']?['type']?.toString().toLowerCase();
                if (type == 'gas') return false; // exclude gas
                if (storeType != null && storeType != 'all') {
                  return type == storeType;
                }
                return true;
              }).toList();
            }

            final shellResults = stores.map((s) => {
              'store': {
                'name': s['store']['name'],
                'chain': s['store']['chain'],
                'address': s['store']['address'],
                'id': s['store']['id']
              },
              'driving_distance': s['distance'],
              'driving_cost': 0.0,
              'true_cost': 0.0,
              'item_total': 0.0,
              'is_loading': true
            }).toList();
            if (shellResults.isNotEmpty) {
              emit(ComparisonLoaded(shellResults, sortBy: _sortBy, isRoundTrip: _isRoundTrip, userLat: userLat, userLng: userLng, isStoreShells: true));
            }
          }
        } catch (e) {
          // Ignore store fetch error, wait for prices
        }
      }

      final Map<String, dynamic> queryParams = {
        'lat': userLat,
        'lng': userLng,
      };

      Response response;
      final isGasSearch = storeType == 'gas' || ['gas', 'fuel', 'diesel'].contains(itemName.toLowerCase());

      if (isGasSearch) {
        queryParams['gallons'] = 15;
        queryParams['fuelType'] = 'regular';
        queryParams['sortBy'] = _sortBy;
        queryParams['isRoundTrip'] = _isRoundTrip.toString();
        queryParams['forceRefresh'] = forceRefresh.toString();
        queryParams['locationName'] = await locationService.getLocationName();
        response = await apiClient.dio.get('/comparison/gas', queryParameters: queryParams);
      } else {
        queryParams['item'] = itemName;
        if (storeType != null && storeType != 'all') queryParams['storeType'] = storeType;
        queryParams['sortBy'] = _sortBy;
        queryParams['isRoundTrip'] = _isRoundTrip.toString();
        queryParams['forceRefresh'] = forceRefresh.toString();
        response = await apiClient.dio.get('/comparison/compare', queryParameters: queryParams);
      }

      _lastQuery = itemName;
      _lastStoreType = storeType;

      final responseData = response.data;
      if (responseData is Map && responseData['status'] == 'warming') {
        if (!keepCurrentResultsOnWarm) {
          if (!isSilent) emit(ComparisonWarming(query: itemName, storeType: storeType));
        }
        _pollWarming(itemName, storeType, _sortBy, _isRoundTrip, forceRefresh, preserveCurrentResults: keepCurrentResultsOnWarm);
         return;
      }
      
      List<dynamic> results;
      if (responseData is List) {
        results = responseData;
      } else if (responseData is Map && responseData['results'] is List) {
        results = responseData['results'] as List<dynamic>;
      } else {
        results = [];
      }

      final meta = responseData is Map ? responseData['meta'] : null;
      final cacheAgeLabel = meta?['label'] as String?;
      final cacheAgeHours = meta?['ageHours'] as int?;

      if (meta != null && meta['forcedZip'] != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('resolved_zip', meta['forcedZip']);
        await prefs.setDouble('resolved_lat', 32.776664);
        await prefs.setDouble('resolved_lng', -96.796987);
        locationService.setLocation(meta['forcedLocation'] ?? 'Dallas, TX', lat: 32.776664, lng: -96.796987);
      }

      await _saveToLocalCache(cacheKey, results);
      emit(ComparisonLoaded(
        results, 
        sortBy: _sortBy, 
        isRoundTrip: _isRoundTrip, 
        userLat: userLat, 
        userLng: userLng,
        cacheAgeLabel: cacheAgeLabel,
        cacheAgeHours: cacheAgeHours,
        query: itemName,
      ));
      
    } on DioException catch (e) {
      if (!isRetry && (e.type == DioExceptionType.receiveTimeout || e.type == DioExceptionType.connectionTimeout)) {
        // Automatic retry once
        await Future.delayed(const Duration(seconds: 2));
        return searchItem(itemName, storeType: storeType, forceRefresh: forceRefresh, sortBy: sortBy, isRoundTrip: isRoundTrip, isRetry: true, isSilent: isSilent);
      }
      
      if (!isSilent) {
        if (state is! ComparisonLoaded) {
          emit(ComparisonError(ApiClient.parseError(e)));
        }
      }
    } catch (e) {
      if (!isSilent && state is! ComparisonLoaded) {
        emit(ComparisonError(ApiClient.parseError(e)));
      }
    } finally {
      _isLoading = false;
    }
  }

  void _pollWarming(String itemName, String? storeType, String sortBy, bool isRoundTrip, bool forceRefresh, {bool preserveCurrentResults = false}) async {
    int attempts = 0;
    while (attempts < 10) {
      await Future.delayed(const Duration(seconds: 4));
      if (preserveCurrentResults) {
        if (state is! ComparisonLoaded) return;
        final currentState = state as ComparisonLoaded;
        if (currentState.query != itemName) return;
      } else {
        if (state is! ComparisonWarming) return;
        final warmingState = state as ComparisonWarming;
        if (warmingState.query != itemName) return;
      }

      attempts++;
      await searchItem(
        itemName,
        storeType: storeType,
        forceRefresh: false,
        sortBy: sortBy,
        isRoundTrip: isRoundTrip,
        isPolling: true,
        isSilent: preserveCurrentResults,
        keepCurrentResultsOnWarm: preserveCurrentResults,
      );
      
      if (state is ComparisonLoaded || state is ComparisonError) return;
    }
    
    if (state is ComparisonWarming) {
      emit(ComparisonError('Still finding best prices. Try refreshing in a moment.'));
    }
  }

  void clear() {
    _lastQuery = null;
    _lastStoreType = null;
    emit(ComparisonInitial());
  }
}
