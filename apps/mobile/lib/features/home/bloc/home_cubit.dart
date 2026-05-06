import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../list/list_repository.dart';
import '../../list/bloc/list_cubit.dart';
import 'dart:async';
import '../../deals/deals_repository.dart';
import '../../compare/bloc/comparison_cubit.dart';
import '../../../core/services/location_service.dart';

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
  StreamSubscription? _listSubscription;

  HomeCubit({
    required this.listRepository,
    required this.dealsRepository,
    required this.comparisonCubit,
    required this.locationService,
    required this.listCubit,
  }) : super(HomeInitial()) {
    _listSubscription = listCubit.stream.listen((listState) {
      if (listState is ListLoaded) {
        loadDashboard();
      }
    });
  }

  @override
  Future<void> close() {
    _listSubscription?.cancel();
    return super.close();
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

      final productIds = cartItems.map((item) => item['product_id'] as String).toList();

      // 3. Fetch comparisons
      print('DEBUG: Loading dashboard for ${productIds.length} items at $locationName');
      await comparisonCubit.fetchComparisons(productIds, forceRefresh: true);
      
      print('DEBUG: Comparison state: ${comparisonCubit.state}');
      if (comparisonCubit.state is ComparisonLoaded) {
        final results = (comparisonCubit.state as ComparisonLoaded).results;
        print('DEBUG: Found ${results.length} results');
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
        print('DEBUG: Comparison error: ${(comparisonCubit.state as ComparisonError).message}');
        emit(HomeLoaded(
          bestStore: null,
          otherStores: [],
          nearbyDeals: nearbyDeals,
          cartItemCount: cartItemCount,
          locationName: locationName,
        ));
      }
    } catch (e) {
      final message = e.toString().contains('401') 
          ? 'Session expired. Please log in again.' 
          : 'Failed to load dashboard: ${e.toString()}';
      emit(HomeError(message));
    }
  }
}
