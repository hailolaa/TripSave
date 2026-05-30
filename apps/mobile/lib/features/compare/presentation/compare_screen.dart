import 'package:flutter/material.dart';
import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';
import 'package:latlong2/latlong.dart';
import 'compare_map_view.dart';
import '../bloc/comparison_cubit.dart';
import '../../savings/bloc/savings_cubit.dart';
import '../../../core/widgets/store_logo.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/di/injection.dart';
import '../../../core/widgets/app_error_widget.dart';
import '../../../core/services/favorite_store_service.dart';

class CompareScreen extends StatefulWidget {
  const CompareScreen({super.key});

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends State<CompareScreen> {
  final TextEditingController _searchController = TextEditingController();
  int _selectedFilterIndex = 0;
  final List<String> _filters = ['All', 'Grocery', 'Gas', 'Pharmacy'];
  bool _isMapView = false;
  final FavoriteStoreService _favoriteStoreService = getIt<FavoriteStoreService>();
  Set<String> _favoriteStores = <String>{};
  Timer? _debounceTimer;

  @override
  void dispose() {
    _searchController.dispose();
    _debounceTimer?.cancel();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _loadFavorites();
    final cubit = context.read<ComparisonCubit>();
    final lastQuery = cubit.lastQuery;
    if (lastQuery != null && lastQuery.isNotEmpty) {
      if (lastQuery.startsWith('cart:')) {
        _searchController.clear();
      } else {
        _searchController.text = lastQuery;
      }
    }
    final lastStoreType = cubit.lastStoreType;
    if (lastStoreType != null) {
      final index = _filters.indexWhere((f) => f.toLowerCase() == lastStoreType.toLowerCase());
      if (index != -1) {
        _selectedFilterIndex = index;
      }
    }
    cubit.prefetch();
  }

  void _loadFavorites() {
    _favoriteStores = _favoriteStoreService.getFavoriteStoreNames().toSet();
  }

  Future<void> _toggleFavoriteStore(String storeName) async {
    await _favoriteStoreService.toggleFavorite(storeName);
    if (!mounted) return;
    setState(() {
      _loadFavorites();
    });
  }

  bool _isFavoriteStore(String storeName) {
    return _favoriteStores.contains(storeName.toLowerCase());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: null,
        toolbarHeight: 0,
        backgroundColor: AppTheme.backgroundLight,
      ),
      body: SafeArea(
        child: BlocListener<ComparisonCubit, ComparisonState>(
          listener: (context, state) {
            if (state is ComparisonLoaded) {
              final q = state.query;
              if (q != null && q.isNotEmpty) {
                if (q.startsWith('cart:')) {
                  _searchController.clear();
                } else if (_searchController.text != q) {
                  _searchController.text = q;
                }
              }
              final lastStoreType = context.read<ComparisonCubit>().lastStoreType;
              if (lastStoreType != null) {
                final index = _filters.indexWhere((f) => f.toLowerCase() == lastStoreType.toLowerCase());
                if (index != -1 && index != _selectedFilterIndex) {
                  setState(() {
                    _selectedFilterIndex = index;
                  });
                }
              }
            }
          },
          child: Stack(
            children: [
              // Background Blobs
              Positioned(
                top: -100,
                right: -50,
                child: Container(
                  width: 250,
                  height: 250,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryBlue.withValues(alpha: 0.04),
                    shape: BoxShape.circle,
                  ),
                ).animate(onPlay: (c) => c.repeat(reverse: true))
                 .moveX(begin: 0, end: -30, duration: 10.seconds, curve: Curves.easeInOut)
                 .moveY(begin: 0, end: 50, duration: 12.seconds, curve: Curves.easeInOut),
              ),
              Positioned(
                bottom: 100,
                left: -80,
                child: Container(
                  width: 300,
                  height: 300,
                  decoration: BoxDecoration(
                    color: AppTheme.savingsGreen.withValues(alpha: 0.03),
                    shape: BoxShape.circle,
                  ),
                ).animate(onPlay: (c) => c.repeat(reverse: true))
                 .moveX(begin: 0, end: 40, duration: 6.seconds, curve: Curves.easeInOut)
                 .moveY(begin: 0, end: -30, duration: 8.seconds, curve: Curves.easeInOut),
              ),
  
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20.0),
                child: Column(
                  children: [
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.05),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: TextField(
                          controller: _searchController,
                          onSubmitted: (text) {
                            if (text.isNotEmpty && mounted) {
                              context.read<ComparisonCubit>().searchItem(
                                text, 
                                storeType: _filters[_selectedFilterIndex].toLowerCase(),
                                forceRefresh: false,
                              );
                            }
                          },
                          style: GoogleFonts.outfit(fontWeight: FontWeight.w500),
                          decoration: InputDecoration(
                            hintText: 'Search products to compare...',
                            hintStyle: GoogleFonts.outfit(color: Colors.grey.shade400, fontSize: 15),
                            prefixIcon: const Icon(Icons.search, color: AppTheme.primaryBlue, size: 20),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Compare Button
                    Container(
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppTheme.primaryBlue, Color(0xFF1E40AF)],
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primaryBlue.withValues(alpha: 0.2),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(20),
                          onTap: () {
                            final cubit = context.read<ComparisonCubit>();
                            final query = _searchController.text.isNotEmpty ? _searchController.text : (cubit.lastQuery ?? 'milk');
                            context.read<ComparisonCubit>().searchItem(
                              query, 
                              storeType: _filters[_selectedFilterIndex].toLowerCase(),
                              forceRefresh: false,
                            );
                          },
                          child: const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 16),
                            child: Icon(Icons.compare_arrows, color: Colors.white),
                          ),
                        ),
                      ),
                    ),
                  ],
                ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.1),
                const SizedBox(height: 20),
                // Horizontal Filters
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: List.generate(_filters.length, (index) {
                      final isSelected = _selectedFilterIndex == index;
                      return GestureDetector(
                        onTap: () {
                          setState(() => _selectedFilterIndex = index);
                          final filter = _filters[index].toLowerCase();
                          final cubit = context.read<ComparisonCubit>();
                          final query = _searchController.text.isNotEmpty ? _searchController.text : (cubit.lastQuery ?? 'milk');
                          context.read<ComparisonCubit>().searchItem(query, storeType: filter, forceRefresh: false);
                        },
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                          decoration: BoxDecoration(
                            color: isSelected ? AppTheme.primaryBlue : Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            children: [
                              if (index == 0) Icon(Icons.layers, size: 18, color: isSelected ? Colors.white : Colors.grey),
                              if (index == 1) Icon(Icons.shopping_cart_outlined, size: 18, color: isSelected ? Colors.white : Colors.grey),
                              if (index == 2) Icon(Icons.local_gas_station_outlined, size: 18, color: isSelected ? Colors.white : Colors.grey),
                              if (index == 3) Icon(Icons.local_pharmacy_outlined, size: 18, color: isSelected ? Colors.white : Colors.grey),
                              if (index != 0) const SizedBox(width: 8),
                              Text(
                                _filters[index],
                                style: TextStyle(
                                    color: isSelected ? Colors.white : Colors.grey.shade700,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                  ),
                ).animate().fadeIn(delay: 100.ms).slideX(begin: 0.1),
                const SizedBox(height: 16),
                // Sort and Trip Type Settings
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Sort Dropdown
                    BlocSelector<ComparisonCubit, ComparisonState, String>(
                      selector: (state) {
                        if (state is ComparisonLoaded) return state.sortBy;
                        return 'true_cost';
                      },
                      builder: (context, currentSort) {
                        
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: DropdownButton<String>(
                            value: currentSort,
                            underline: const SizedBox(),
                            icon: const Icon(Icons.sort, size: 16, color: AppTheme.primaryBlue),
                            items: const [
                              DropdownMenuItem(value: 'true_cost', child: Text('Total Cost', style: TextStyle(fontSize: 13))),
                              DropdownMenuItem(value: 'item_total', child: Text('Item Price', style: TextStyle(fontSize: 13))),
                              DropdownMenuItem(value: 'driving_cost', child: Text('Drive Cost', style: TextStyle(fontSize: 13))),
                            ],
                            onChanged: (val) {
                              if (val != null) {
                                context.read<ComparisonCubit>().changeSort(val);
                              }
                            },
                          ),
                        );
                      },
                    ).animate().fadeIn(delay: 200.ms).slideX(begin: -0.1),
                    const SizedBox(width: 10),
  
                    // Round Trip Toggle
                    BlocSelector<ComparisonCubit, ComparisonState, bool>(
                      selector: (state) {
                        if (state is ComparisonLoaded) return state.isRoundTrip;
                        return true;
                      },
                      builder: (context, isRoundTrip) {
                        
                        return GestureDetector(
                          onTap: () {
                            final filter = _filters[_selectedFilterIndex].toLowerCase();
                            final cubit = context.read<ComparisonCubit>();
                            final query = _searchController.text.isNotEmpty ? _searchController.text : (cubit.lastQuery ?? 'milk');
                            context.read<ComparisonCubit>().searchItem(query, storeType: filter, isRoundTrip: !isRoundTrip, forceRefresh: false);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              color: isRoundTrip ? AppTheme.primaryBlue.withValues(alpha: 0.1) : Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: isRoundTrip ? AppTheme.primaryBlue.withValues(alpha: 0.3) : Colors.grey.shade200),
                            ),
                            child: Row(
                              children: [
                                Icon(isRoundTrip ? Icons.repeat : Icons.trending_flat, size: 16, color: isRoundTrip ? AppTheme.primaryBlue : Colors.grey),
                                const SizedBox(width: 8),
                                Text(isRoundTrip ? 'Round Trip' : 'One Way', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isRoundTrip ? AppTheme.primaryBlue : Colors.grey.shade700)),
                              ],
                            ),
                          ),
                        );
                      },
                    ).animate().fadeIn(delay: 300.ms).slideX(begin: -0.1),
                    const SizedBox(width: 10),
  
                    // Map/List Toggle
                    GestureDetector(
                      onTap: () => setState(() => _isMapView = !_isMapView),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: _isMapView ? AppTheme.primaryBlue.withValues(alpha: 0.1) : Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _isMapView ? AppTheme.primaryBlue.withValues(alpha: 0.3) : Colors.grey.shade200),
                        ),
                        child: Row(
                          children: [
                            Icon(_isMapView ? Icons.list : Icons.map_outlined, size: 16, color: _isMapView ? AppTheme.primaryBlue : Colors.grey),
                            const SizedBox(width: 8),
                            Text(_isMapView ? 'List View' : 'Map View', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _isMapView ? AppTheme.primaryBlue : Colors.grey.shade700)),
                          ],
                        ),
                      ),
                    ).animate().fadeIn(delay: 400.ms).slideX(begin: -0.1),
                  ],
                ),
              ),
                const SizedBox(height: 24),
                BlocSelector<ComparisonCubit, ComparisonState, String?>(
                  selector: (state) {
                    if (state is ComparisonLoaded) return state.cacheAgeLabel;
                    return null;
                  },
                  builder: (context, label) {
                    if (label == null) return const SizedBox.shrink();
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Icon(Icons.schedule, size: 14, color: Colors.grey.shade500),
                          const SizedBox(width: 6),
                          Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                        ],
                      ),
                    );
                  },
                ),
                // List of Results
                Expanded(
                  child: BlocBuilder<ComparisonCubit, ComparisonState>(
                    builder: (context, state) {
                      if (state is ComparisonLoading || state is ComparisonInitial) {
                        return const Center(child: CircularProgressIndicator(color: AppTheme.savingsGreen));
                      } else if (state is ComparisonWarming) {
                        return Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const CircularProgressIndicator(color: AppTheme.primaryBlue),
                              const SizedBox(height: 24),
                              Text('Finding best prices near you...', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 8),
                              const Text('This usually takes 10-15 seconds', style: TextStyle(color: Colors.grey)),
                            ],
                          ),
                        );
                      } else if (state is ComparisonError) {
                        return AppErrorWidget(
                          message: state.message,
                          onRetry: () {
                            final cubit = context.read<ComparisonCubit>();
                            if (_searchController.text.isNotEmpty) {
                              cubit.searchItem(
                                _searchController.text,
                                storeType: _filters[_selectedFilterIndex].toLowerCase(),
                                forceRefresh: false,
                              );
                            } else {
                              cubit.searchItem(
                                cubit.lastQuery ?? 'milk',
                                storeType: _filters[_selectedFilterIndex].toLowerCase(),
                                forceRefresh: false,
                              );
                            }
                          },
                        );
                      } else if (state is ComparisonLoaded) {
                        final results = state.results;
                        if (results.isEmpty) {
                          final queryText = _searchController.text.isNotEmpty 
                            ? _searchController.text 
                            : (context.read<ComparisonCubit>().lastQuery ?? '');
                          return Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.search_off_rounded, size: 64, color: Colors.grey.shade400),
                                const SizedBox(height: 16),
                                Text(
                                  queryText.isNotEmpty 
                                      ? 'No products found for "$queryText"' 
                                      : 'No products found',
                                  style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey.shade800),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 8),
                                const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 32),
                                  child: Text(
                                    'Try adjusting your search terms or filters to find what you are looking for.',
                                    style: TextStyle(color: Colors.grey),
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }
  
                        if (_isMapView) {
                          return ClipRRect(
                            borderRadius: BorderRadius.circular(20),
                            child: CompareMapView(
                              results: results,
                              userLocation: LatLng(
                                state.userLat ?? 32.776664, 
                                state.userLng ?? -96.796987
                              ),
                              onStoreTap: (comparison) => _showStoreDetails(context, comparison, results.indexOf(comparison) == 0),
                            ),
                          );
                        }
  
                        return ListView.builder(
                          itemCount: results.length,
                          itemBuilder: (context, index) {
                            final comparison = results[index];
                            final isBest = index == 0;
                            
                            final sortBy = state.sortBy;
                            
                            Widget card;
                            if (isBest) {
                              card = Column(
                                children: [
                                  RepaintBoundary(child: _buildBestOptionCard(comparison, true, sortBy: sortBy)),
                                  const SizedBox(height: 16),
                                ],
                              );
                            } else {
                              card = Padding(
                                padding: const EdgeInsets.only(bottom: 16),
                                child: RepaintBoundary(child: _buildRegularStoreCard(comparison, false, sortBy: sortBy)),
                              );
                            }
  
                            return card.animate(delay: (index * 100).ms).fadeIn(duration: 500.ms).slideX(begin: 0.1, end: 0);
                          },
                        );
                      }
                      return const SizedBox.shrink();
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
    ),
  ),
  ),
);
  }

  void _showStoreDetails(BuildContext context, Map<String, dynamic> comparison, bool isBest) {
    final store = comparison['store'];
    final chain = store['chain'];
    final isPharmacy = chain['type'] == 'pharmacy';
    final products = comparison['products'] is List ? comparison['products'] as List<dynamic> : [];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(topLeft: Radius.circular(24), topRight: Radius.circular(24)),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (isBest) Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: isPharmacy ? const Color(0xFF6A3CE2) : AppTheme.savingsGreen, borderRadius: BorderRadius.circular(20)),
                child: Text(comparison['source'] == 'oxylabs' ? 'LIVE PRICE' : 'BEST VALUE NEAR YOU', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 10)),
              ),
              if (!isBest) Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(20)),
                child: Text(comparison['source'] == 'oxylabs' ? 'LIVE SCRAPE' : 'STORE DETAILS', style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.bold, fontSize: 10)),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Icon(Icons.verified, color: AppTheme.primaryBlue),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(store['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: AppTheme.textDark), overflow: TextOverflow.ellipsis),
                  ),
                ],
              ),
              const Text('Best value for your full basket', style: TextStyle(color: Colors.grey, fontSize: 14)),
              const SizedBox(height: 24),
              Row(
                children: [
                  _buildDetailPill(
                    Icons.location_on_outlined,
                    '${((double.tryParse(comparison['driving_distance'].toString()) ?? 0) / 2).toStringAsFixed(1)} mi',
                  ),
                  const SizedBox(width: 8),
                  _buildDetailPill(Icons.directions_car_outlined, '\$${comparison['driving_cost']} drive'),
                ],
              ),
              if (chain['type'] == 'gas' && store['gasPrices'] != null) ...[
                const SizedBox(height: 24),
                const Text('FUEL TYPES', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey, letterSpacing: 0.5)),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildGasTypeColumn('Regular', store['gasPrices']['regular']),
                    _buildGasTypeColumn('Mid-grade', store['gasPrices']['midgrade']),
                    _buildGasTypeColumn('Premium', store['gasPrices']['premium']),
                    _buildGasTypeColumn('Diesel', store['gasPrices']['diesel']),
                  ],
                ),
              ],
              const SizedBox(height: 24),
              Text('PRODUCTS FOUND (${products.length})', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey, letterSpacing: 0.5)),
              const SizedBox(height: 12),
              SizedBox(
                height: 110,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: products.length,
                  itemBuilder: (context, idx) {
                    final p = products[idx];
                    return Padding(
                      padding: const EdgeInsets.only(right: 16),
                      child: _buildProductThumbnail(
                        p['name'], 
                        '\$${p['price']}', 
                        imageUrl: p['image'], 
                        quantity: p['quantity']
                      ),
                    );
                  },
                ),
              ),
              if (comparison['missing_items'] != null && comparison['missing_items'] > 0) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.orange.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text('${comparison['missing_items']} items from your list are not available at this location.', 
                          style: const TextStyle(color: Colors.orange, fontSize: 13, fontWeight: FontWeight.w500)),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    final cubit = context.read<ComparisonCubit>();
                    double maxCost = 0;
                    if (cubit.state is ComparisonLoaded) {
                      final results = (cubit.state as ComparisonLoaded).results;
                      for (var res in results) {
                        final cost = double.tryParse(res['true_cost'].toString()) ?? 0;
                        if (cost > maxCost) maxCost = cost;
                      }
                    }
                    
                    final currentCost = double.tryParse(comparison['true_cost'].toString()) ?? 0;
                    final savings = double.tryParse(comparison['savings']?.toString() ?? '') ?? (maxCost > currentCost ? maxCost - currentCost : 2.50);

                    context.read<SavingsCubit>().addSavingsRecord(
                      storeName: store['name'],
                      amountSaved: savings,
                      category: chain['type'].toString().toUpperCase(),
                      iconName: chain['type'] == 'gas' ? 'gas' : (chain['type'] == 'pharmacy' ? 'pharmacy' : 'grocery'),
                    );
                    
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).hideCurrentSnackBar();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Trip saved! You saved \$${savings.toStringAsFixed(2)}'),
                        behavior: SnackBarBehavior.floating,
                        backgroundColor: AppTheme.savingsGreen,
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.savingsGreen,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text('Confirm Trip Selection', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }

  Widget _buildProductThumbnail(String name, String price, {String? imageUrl, int? quantity}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 70, height: 70,
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6), 
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              alignment: Alignment.center,
              child: (imageUrl != null && imageUrl.isNotEmpty)
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: CachedNetworkImage(
                        imageUrl: imageUrl,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => const Icon(Icons.shopping_basket, color: Colors.grey),
                        errorWidget: (context, url, error) => const Icon(Icons.shopping_basket, color: Colors.grey),
                      ),
                    )
                  : Text(name.substring(0, 1).toUpperCase(), style: const TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.bold, fontSize: 24)),
            ),
            if (quantity != null && quantity > 1)
              Positioned(
                top: -6,
                right: -6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryBlue,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Text(
                    '${quantity}x', 
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Text(price, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ],
    );
  }

  Widget _buildGasTypeColumn(String label, dynamic price) {
    String priceStr = '--';
    if (price is num) {
      priceStr = '\$${price.toStringAsFixed(2)}';
    } else if (price != null) {
      priceStr = '\$$price';
    }
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        Text(priceStr, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: price != null ? AppTheme.textDark : Colors.grey.shade400)),
      ],
    );
  }

  Widget _buildDetailPill(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.grey.shade200)),
      child: Row(
        children: [
          Icon(icon, size: 14, color: Colors.grey.shade600),
          const SizedBox(width: 6),
          Text(text, style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey.shade700)),
        ],
      ),
    );
  }

  Widget _buildBestOptionCard(Map<String, dynamic> comparison, bool isBest, {String? sortBy}) {
    final store = comparison['store'];
    final chain = store['chain'];
    final isGas = chain['type'] == 'gas';
    final isPharmacy = chain['type'] == 'pharmacy';
    final storeName = store['name']?.toString() ?? '';
    final isFavorite = _isFavoriteStore(storeName);

    final primaryColor = isGas ? const Color(0xFF2563EB) : (isPharmacy ? const Color(0xFF6A3CE2) : AppTheme.savingsGreen);
    final bgColor = isGas ? const Color(0xFFEFF6FF) : (isPharmacy ? const Color(0xFFF5F3FF) : const Color(0xFFF0FDF4));

    return GestureDetector(
      onTap: () => _showStoreDetails(context, comparison, isBest),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: primaryColor.withValues(alpha: 0.1), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: primaryColor.withValues(alpha: 0.05),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: primaryColor,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Best Option',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true)).shimmer(delay: 4.seconds, duration: 2.seconds, color: Colors.white24),
            const SizedBox(height: 16),
            Row(
              children: [
                StoreLogo(chain: chain, size: 56, padding: 12),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    storeName,
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppTheme.textDark, letterSpacing: -0.5),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  onPressed: () => _toggleFavoriteStore(storeName),
                  icon: Icon(
                    isFavorite ? Icons.favorite : Icons.favorite_border,
                    color: isFavorite ? AppTheme.savingsGreen : Colors.grey.shade500,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildBestOptionMetric(
                  'Basket',
                  '\$${comparison['item_total']}',
                  isPrimary: sortBy == 'item_total',
                  isLoading: comparison['is_loading'] == true,
                ),
                Container(width: 1, height: 40, color: Colors.grey.withValues(alpha: 0.1)),
                _buildBestOptionMetric(
                  'Drive',
                  '\$${comparison['driving_cost']}',
                  isPrimary: sortBy == 'driving_cost' || sortBy == 'distance' || sortBy == 'driving_distance',
                  isLoading: comparison['is_loading'] == true,
                ),
                Container(width: 1, height: 40, color: Colors.grey.withValues(alpha: 0.1)),
                _buildBestOptionMetric(
                  isGas ? 'Price' : 'Total',
                  isGas
                      ? '\$${comparison['price_per_gallon'] ?? (comparison['products'] != null && comparison['products'].isNotEmpty ? comparison['products'][0]['price'] : comparison['item_total'])}/gal'
                      : '\$${comparison['true_cost']}',
                  isPrimary: sortBy == 'true_cost' || sortBy == 'savings' || sortBy == null,
                  isLoading: comparison['is_loading'] == true,
                ),
              ],
            ),
            const SizedBox(height: 24),
            if (comparison['is_loading'] == true)
              Shimmer.fromColors(
                baseColor: primaryColor.withValues(alpha: 0.05),
                highlightColor: primaryColor.withValues(alpha: 0.1),
                child: Container(
                  width: double.infinity,
                  height: 48,
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                ),
              )
            else if (comparison['savings'] != null && comparison['savings'] > 0)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: primaryColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.favorite, color: AppTheme.savingsGreen, size: 18),
                    const SizedBox(width: 8),
                    Text(
                      'Save \$${comparison['savings']} vs most expensive',
                      style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    ).animate(onPlay: (c) => c.repeat(reverse: true)).moveY(begin: 0, end: -6, duration: 3.seconds, curve: Curves.easeInOut);
  }

  Widget _buildBestOptionMetric(String label, String value, {bool isPrimary = false, bool isLoading = false}) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        isLoading 
          ? Shimmer.fromColors(
              baseColor: Colors.grey.shade300,
              highlightColor: Colors.grey.shade100,
              child: Container(width: 50, height: 20, color: Colors.white),
            )
          : Text(
              value, 
              style: TextStyle(
                fontSize: isPrimary ? 20 : 16, 
                fontWeight: FontWeight.w900, 
                color: isPrimary ? AppTheme.savingsGreen : AppTheme.textDark
              )
            ),
      ],
    );
  }

  Widget _buildRegularStoreCard(Map<String, dynamic> comparison, bool isBest, {String? sortBy}) {
    final store = comparison['store'];
    final chain = store['chain'];
    final isGas = chain['type'] == 'gas';
    final storeName = store['name']?.toString() ?? '';
    final isFavorite = _isFavoriteStore(storeName);

    return GestureDetector(
      onTap: () => _showStoreDetails(context, comparison, isBest),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.grey.shade100, width: 1),
        ),
        child: Column(
          children: [
            Row(
              children: [
                StoreLogo(chain: chain, size: 44, padding: 10),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(storeName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppTheme.textDark)),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text(chain['type'].toString().toUpperCase(), style: const TextStyle(color: AppTheme.primaryBlue, fontSize: 11, fontWeight: FontWeight.w700)),
                          const SizedBox(width: 6),
                          Text(
                            '\u2022 ${((double.tryParse(comparison['driving_distance'].toString()) ?? 0) / 2).toStringAsFixed(1)} mi away',
                            style: const TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                ],
            ),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      comparison['is_loading'] == true
                          ? Shimmer.fromColors(
                              baseColor: Colors.grey.shade300,
                              highlightColor: Colors.grey.shade100,
                              child: Container(width: 40, height: 16, color: Colors.white),
                            )
                          : Text(
                              sortBy == 'item_total'
                                  ? '\$${comparison['item_total']}'
                                  : (sortBy == 'driving_cost' || sortBy == 'distance' || sortBy == 'driving_distance')
                                      ? '\$${comparison['driving_cost']}'
                                      : sortBy == 'savings'
                                          ? 'Save \$${comparison['savings']}'
                                          : (isGas
                                              ? '\$${comparison['price_per_gallon'] ?? (comparison['products'] != null && comparison['products'].isNotEmpty ? comparison['products'][0]['price'] : comparison['item_total'])}'
                                              : '\$${comparison['true_cost']}'),
                              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: AppTheme.textDark),
                            ),
                      Text(
                        sortBy == 'item_total'
                            ? 'items'
                            : (sortBy == 'driving_cost' || sortBy == 'distance' || sortBy == 'driving_distance')
                                ? 'drive'
                                : sortBy == 'savings'
                                    ? 'vs max'
                                    : (isGas ? 'per gal' : 'total'),
                        style: const TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 4),
                      InkWell(
                        onTap: () => _toggleFavoriteStore(storeName),
                        child: Icon(
                          isFavorite ? Icons.favorite : Icons.favorite_border,
                          color: isFavorite ? AppTheme.savingsGreen : Colors.grey.shade500,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (comparison['savings'] != null && comparison['savings'] > 0) ...[
              const SizedBox(height: 12),
              const Divider(height: 1, color: Color(0xFFF1F5F9)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Text('Save \$${comparison['savings']}', style: const TextStyle(color: AppTheme.savingsGreen, fontWeight: FontWeight.w800, fontSize: 14)),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
