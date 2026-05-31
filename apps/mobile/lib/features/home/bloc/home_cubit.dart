import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../list/list_repository.dart';
import '../../list/bloc/list_cubit.dart';
import 'dart:async';
import '../../deals/deals_repository.dart';
import '../../compare/bloc/comparison_cubit.dart';
import '../../../core/services/location_service.dart';
import '../../auth/auth_repository.dart';
import '../../../core/di/injection.dart';
import '../../location/bloc/location_cubit.dart';
import '../../../core/network/api_client.dart';

abstract class HomeState extends Equatable {
  @override
  List<Object?> get props => [];
}

class HomeInitial extends HomeState {}

class HomeLoading extends HomeState {}

class HomeLoaded extends HomeState {
  final Map<String, dynamic>? bestStore;
  final List<dynamic> otherStores;
  final List<dynamic> nearbyDeals;
  final int cartItemCount;
  final String locationName;

  HomeLoaded({
    this.bestStore,
    this.otherStores = const [],
    this.nearbyDeals = const [],
    this.cartItemCount = 0,
    this.locationName = 'Dallas, TX',
  });

  @override
  List<Object?> get props => [bestStore, otherStores, nearbyDeals, cartItemCount, locationName];

  HomeLoaded copyWith({
    Map<String, dynamic>? bestStore,
    List<dynamic>? otherStores,
    List<dynamic>? nearbyDeals,
    int? cartItemCount,
    String? locationName,
  }) {
    return HomeLoaded(
      bestStore: bestStore ?? this.bestStore,
      otherStores: otherStores ?? this.otherStores,
      nearbyDeals: nearbyDeals ?? this.nearbyDeals,
      cartItemCount: cartItemCount ?? this.cartItemCount,
      locationName: locationName ?? this.locationName,
    );
  }
}

class HomeError extends HomeState {
  final String message;
  HomeError(this.message);
  @override
  List<Object?> get props => [message];
}

class HomeCubit extends Cubit<HomeState> {
  final ListRepository listRepository;
  final DealsRepository dealsRepository;
  final ComparisonCubit comparisonCubit;
  final LocationService locationService;
  final ListCubit listCubit;
  final LocationCubit locationCubit;
  StreamSubscription? _listSubscription;
  StreamSubscription? _locationSubscription;

  HomeCubit({
    required this.listRepository,
    required this.dealsRepository,
    required this.comparisonCubit,
    required this.locationService,
    required this.listCubit,
    required this.locationCubit,
  }) : super(HomeInitial()) {
    // Listen to shopping list changes
    _listSubscription = listCubit.stream.listen((listState) {
      if (listState is ListLoaded) {
        loadDashboard();
      }
    });

    // Listen to location changes (detect startup location or manual overrides)
    _locationSubscription = locationCubit.stream.listen((locationState) {
      if (locationState is LocationLoaded) {
        // Keep gas stations warm in the background so the Gas tab feels instant.
        comparisonCubit.loadGasStations();

        // Refresh dashboard (only if not already loading)
        if (state is! HomeLoading) {
          loadDashboard();
        }
      }
    });
  }

  @override
  Future<void> close() {
    _listSubscription?.cancel();
    _locationSubscription?.cancel();
    return super.close();
  }

  /// Update the user's location and refresh dashboard data.
  Future<void> updateLocation(String cityName, {double? lat, double? lng}) async {
    // 1. Update the global LocationCubit state
    locationCubit.updateLocation(cityName, lat: lat, lng: lng);
    
    // 2. Update the backend profile with the new location
    try {
      final repo = getIt<AuthRepository>();
      final updateData = <String, dynamic>{'location_name': cityName};
      if (lat != null) updateData['location_lat'] = lat;
      if (lng != null) updateData['location_lng'] = lng;
      await repo.updateProfile(updateData);
    } catch (_) {}

    // Dashboard refresh will be triggered by the LocationCubit listener in the constructor
  }

  /// Reset to auto-detected GPS location.
  Future<void> resetLocation() async {
    await locationCubit.resetToAuto();
  }

  Future<void> loadDashboard() async {
    emit(HomeLoading());
    try {
      // 1. Get current cart
      final cartItems = await listRepository.getCart();
      final cartItemCount = cartItems.length;
      
      // 2. Fetch deals (top 3 for the home screen)
      final deals = await dealsRepository.getDeals();
      final nearbyDeals = deals.length > 3 ? deals.sublist(0, 3) : deals;

      // 3. Get location name
      final locationName = await locationService.getLocationName();
      
      if (cartItems.isEmpty) {
        emit(HomeLoaded(
          bestStore: null, 
          otherStores: [], 
          nearbyDeals: nearbyDeals, 
          cartItemCount: 0,
          locationName: locationName,
        ));
        return;
      }

      // 3. Fetch comparisons
      await comparisonCubit.fetchComparisons(cartItems, forceRefresh: false);
      
      if (comparisonCubit.state is ComparisonLoaded) {
        final results = (comparisonCubit.state as ComparisonLoaded).results;
        final best = results.isNotEmpty ? results.first : null;
        final others = results.length > 1 ? results.sublist(1) : [];
        
        emit(HomeLoaded(
          bestStore: best,
          otherStores: others,
          nearbyDeals: nearbyDeals,
          cartItemCount: cartItemCount,
          locationName: locationName,
        ));
      } else if (comparisonCubit.state is ComparisonError) {
        emit(HomeLoaded(
          bestStore: null,
          otherStores: [],
          nearbyDeals: nearbyDeals,
          cartItemCount: cartItemCount,
          locationName: locationName,
        ));
      }
    } catch (e) {
      emit(HomeError(ApiClient.parseError(e)));
    }
  }

  void clear() {
    emit(HomeInitial());
  }
}
