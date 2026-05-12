import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:rxdart/rxdart.dart';
import '../../../core/services/settings_service.dart';
import '../../../core/services/location_service.dart';
import '../list_repository.dart';

abstract class ListState extends Equatable {
  @override
  List<Object?> get props => [];
}

class ListInitial extends ListState {}

class ListLoading extends ListState {}

class ListLoaded extends ListState {
  final List<Map<String, dynamic>> items;
  final List<Map<String, dynamic>> searchResults;
  final bool isSearching;
  final Map<String, dynamic>? cartSummary;

  ListLoaded({
    required this.items,
    this.searchResults = const [],
    this.isSearching = false,
    this.cartSummary,
  });

  @override
  List<Object?> get props => [items, searchResults, isSearching, cartSummary];

  ListLoaded copyWith({
    List<Map<String, dynamic>>? items,
    List<Map<String, dynamic>>? searchResults,
    bool? isSearching,
    Map<String, dynamic>? cartSummary,
  }) {
    return ListLoaded(
      items: items ?? this.items,
      searchResults: searchResults ?? this.searchResults,
      isSearching: isSearching ?? this.isSearching,
      cartSummary: cartSummary ?? this.cartSummary,
    );
  }
}

class ListError extends ListState {
  final String message;
  ListError(this.message);
  @override
  List<Object?> get props => [message];
}

class ListCubit extends Cubit<ListState> {
  final ListRepository _repository;
  final SettingsService _settings;
  final LocationService _locationService;
  
  // Subject to handle search queries with debouncing
  final _searchQuerySubject = PublishSubject<String>();
  StreamSubscription? _searchSubscription;

  ListCubit(this._repository, this._settings, this._locationService) : super(ListInitial()) {
    // Set up debounced search
    _searchSubscription = _searchQuerySubject
        .debounceTime(const Duration(milliseconds: 400))
        .distinct()
        .listen((query) {
      _executeSearch(query);
    });
  }

  @override
  Future<void> close() {
    _searchSubscription?.cancel();
    _searchQuerySubject.close();
    return super.close();
  }

  Future<void> fetchCart() async {
    emit(ListLoading());
    try {
      final items = await _repository.getCart();
      emit(ListLoaded(items: items));
      if (items.isNotEmpty) {
        await fetchSummary();
      }
    } catch (e) {
      emit(ListError('Failed to load shopping list'));
    }
  }

  void searchProducts(String query) {
    if (state is! ListLoaded) return;
    final currentState = state as ListLoaded;
    
    if (query.isEmpty) {
      emit(currentState.copyWith(searchResults: [], isSearching: false));
      return;
    }

    // Keep current search results while starting a new search to prevent blinking
    emit(currentState.copyWith(isSearching: true, searchResults: currentState.searchResults));
    _searchQuerySubject.add(query);
  }

  Future<void> _executeSearch(String query) async {
    if (state is! ListLoaded) return;

    try {
      final results = await _repository.searchProducts(query);
      if (state is ListLoaded) {
        emit((state as ListLoaded).copyWith(
          searchResults: results, 
          isSearching: false,
        ));
      }
    } catch (e) {
      if (state is ListLoaded) {
        emit((state as ListLoaded).copyWith(
          searchResults: [], 
          isSearching: false,
        ));
      }
    }
  }

  Future<void> addToCart(String productId) async {
    if (state is! ListLoaded) return;
    final currentState = state as ListLoaded;

    try {
      await _repository.addToCart(productId, 1);
      // Immediately clear search to close dropdown and refresh list
      emit(currentState.copyWith(searchResults: [], isSearching: false));
      await fetchCart(); 
    } catch (e) {
      emit(ListError('Failed to add item'));
    }
  }

  Future<void> updateQuantity(String itemId, int quantity) async {
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }
    
    try {
      await _repository.updateCartItem(itemId, quantity);
      await fetchCart();
    } catch (e) {
      emit(ListError('Failed to update item'));
    }
  }

  Future<void> removeFromCart(String itemId) async {
    try {
      await _repository.removeFromCart(itemId);
      await fetchCart();
    } catch (e) {
      emit(ListError('Failed to remove item'));
    }
  }

  void clear() {
    emit(ListInitial());
  }

  void clearSearch() {
    if (state is ListLoaded) {
      emit((state as ListLoaded).copyWith(searchResults: [], isSearching: false));
    }
  }

  Future<void> fetchSummary() async {
    if (state is! ListLoaded) return;
    final currentState = state as ListLoaded;
    if (currentState.items.isEmpty) return;

    try {
      final position = await _locationService.getCurrentLocation();
      final summary = await _repository.getCartSummary(
        lat: position.latitude,
        lng: position.longitude,
        mpg: _settings.mpg,
        gasPrice: _settings.gasCostPerMile * _settings.mpg,
        items: currentState.items,
      );
      
      if (state is ListLoaded) {
        emit((state as ListLoaded).copyWith(cartSummary: summary));
      }
    } catch (e) {
      // Fail silently for summary to not disrupt user experience
    }
  }
}
