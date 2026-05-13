import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../../core/network/api_client.dart';
import '../../../core/services/settings_service.dart';
import '../../../core/services/location_service.dart';
import 'package:dio/dio.dart';

abstract class ComparisonState extends Equatable {
  @override
  List<Object?> get props => [];
}

class ComparisonInitial extends ComparisonState {}
class ComparisonLoading extends ComparisonState {}
class ComparisonLoaded extends ComparisonState {
  final List<dynamic> results;
  final String sortBy;
  final bool isRoundTrip;
  final double? userLat;
  final double? userLng;
  final DateTime fetchedAt;
  
  ComparisonLoaded(
    this.results, {
    this.sortBy = 'true_cost',
    this.isRoundTrip = true,
    this.userLat,
    this.userLng,
    DateTime? fetchedAt,
  }) : fetchedAt = fetchedAt ?? DateTime.now();
  
  @override
  List<Object?> get props => [results, sortBy, isRoundTrip, userLat, userLng, fetchedAt];

  ComparisonLoaded copyWith({
    List<dynamic>? results,
    String? sortBy,
    bool? isRoundTrip,
    double? userLat,
    double? userLng,
    DateTime? fetchedAt,
  }) {
    return ComparisonLoaded(
      results ?? this.results,
      sortBy: sortBy ?? this.sortBy,
      isRoundTrip: isRoundTrip ?? this.isRoundTrip,
      userLat: userLat ?? this.userLat,
      userLng: userLng ?? this.userLng,
      fetchedAt: fetchedAt ?? this.fetchedAt,
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
  final SettingsService settings;
  final LocationService locationService;

  /// Tracks the last successful query + filter to avoid redundant API calls.
  /// When the user navigates away and comes back, the cubit already has data
  /// and won't re-fetch unless the user explicitly searches or changes filters.
  String? _lastQuery;
  String? _lastStoreType;
  String _sortBy = 'true_cost';
  bool _isRoundTrip = true;

  ComparisonCubit(this.apiClient, this.settings, this.locationService) : super(ComparisonInitial());

  String get currentSortBy => _sortBy;
  bool get currentIsRoundTrip => _isRoundTrip;

  /// Whether we already have loaded results (used by the UI to skip initState fetch).
  bool get hasData => state is ComparisonLoaded;

  Future<void> fetchComparisons(List<dynamic> items, {String? storeType, bool forceRefresh = false, String? sortBy, bool? isRoundTrip}) async {
    final key = 'cart:${items.map((i) => i['product_id']).join(',')}';
    
    if (sortBy != null) _sortBy = sortBy;
    if (isRoundTrip != null) _isRoundTrip = isRoundTrip;

    // Skip if we already have results for this exact query
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

      if (storeType != null && storeType != 'all') {
        data['storeType'] = storeType;
      }
      
      data['sortBy'] = _sortBy;
      data['isRoundTrip'] = _isRoundTrip;

      final response = await apiClient.dio.post('/comparison/cart/compare', data: data);

      _lastQuery = key;
      _lastStoreType = storeType;
      emit(ComparisonLoaded(response.data, sortBy: _sortBy, isRoundTrip: _isRoundTrip, userLat: userLat, userLng: userLng));
    } on DioException catch (e) {
      if (e.type == DioExceptionType.receiveTimeout || e.type == DioExceptionType.connectionTimeout) {
        emit(ComparisonError('Search is taking longer than expected. Please try again.'));
      } else {
        emit(ComparisonError('Failed to fetch comparisons. Please check your connection.'));
      }
    } catch (e) {
      emit(ComparisonError(e.toString()));
    }
  }

  Future<void> searchItem(String itemName, {String? storeType, bool forceRefresh = false, String? sortBy, bool? isRoundTrip}) async {
    if (itemName.isEmpty) return;

    if (sortBy != null) _sortBy = sortBy;
    if (isRoundTrip != null) _isRoundTrip = isRoundTrip;

    // Skip if we already have results for this exact query + filter.
    // This prevents re-fetching when the user navigates between tabs.
    if (!forceRefresh && state is ComparisonLoaded && _lastQuery == itemName && _lastStoreType == storeType && sortBy == null && isRoundTrip == null) {
      return;
    }

    emit(ComparisonLoading());
    try {
      final position = await locationService.getCurrentLocation();
      final double userLat = position.latitude;
      final double userLng = position.longitude;

      final Map<String, dynamic> queryParams = {
        'lat': userLat,
        'lng': userLng,
      };

      Response response;
      if (storeType == 'gas' || itemName.toLowerCase() == 'gas') {
        queryParams['gallons'] = 15;
        queryParams['fuelType'] = 'regular';
        queryParams['sortBy'] = _sortBy;
        queryParams['isRoundTrip'] = _isRoundTrip.toString();
        queryParams['forceRefresh'] = forceRefresh.toString();
        queryParams['locationName'] = await locationService.getLocationName();
        response = await apiClient.dio.get('/comparison/gas', queryParameters: queryParams);
      } else {
        queryParams['item'] = itemName;
        if (storeType != null && storeType != 'all') {
          queryParams['storeType'] = storeType;
        }
        queryParams['sortBy'] = _sortBy;
        queryParams['isRoundTrip'] = _isRoundTrip.toString();
        // Ensure backend can bypass DB + in-memory cache when user refreshes.
        queryParams['forceRefresh'] = forceRefresh.toString();
        response = await apiClient.dio.get('/comparison/compare', queryParameters: queryParams);
      }

      // Track what we fetched so we can skip duplicate requests
      _lastQuery = itemName;
      _lastStoreType = storeType;

      // The backend now returns a list of UI-compatible comparison objects
      emit(ComparisonLoaded(response.data, sortBy: _sortBy, isRoundTrip: _isRoundTrip, userLat: userLat, userLng: userLng));
    } on DioException catch (e) {
      if (e.type == DioExceptionType.receiveTimeout || e.type == DioExceptionType.connectionTimeout) {
        emit(ComparisonError('Search is taking longer than expected. Please try again.'));
      } else {
        emit(ComparisonError('Failed to fetch comparisons. Please check your connection.'));
      }
    } catch (e) {
      emit(ComparisonError(e.toString()));
    }
  }

  void clear() {
    _lastQuery = null;
    _lastStoreType = null;
    emit(ComparisonInitial());
  }
}
