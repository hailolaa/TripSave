import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/shopsave_logo.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:trip_save/features/home/bloc/home_cubit.dart';
import '../../../core/services/location_service.dart';
import '../../../core/di/injection.dart';
import '../../auth/auth_repository.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ScrollController _dealsScrollController = ScrollController();

  @override
  void dispose() {
    _dealsScrollController.dispose();
    super.dispose();
  }

  void _showLocationPicker(BuildContext context, String currentLocation) {
    HapticFeedback.mediumImpact();
    final locationService = getIt<LocationService>();
    final searchController = TextEditingController();
    bool isSearching = false;
    List<Map<String, dynamic>> searchResults = [];
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.55,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle bar
                  Center(
                    child: Container(
                      margin: const EdgeInsets.only(top: 12),
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  // Title
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 20, 24, 4),
                    child: Text(
                      'Change Location',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 22, color: AppTheme.textDark),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Text(
                      'Search for a city or zip code',
                      style: GoogleFonts.outfit(color: Colors.grey.shade500, fontSize: 14),
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Search field
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: TextField(
                      controller: searchController,
                      autofocus: true,
                      style: GoogleFonts.outfit(fontSize: 16),
                      decoration: InputDecoration(
                        hintText: 'e.g. Houston, TX or 77001',
                        hintStyle: GoogleFonts.outfit(color: Colors.grey.shade400),
                        prefixIcon: Icon(Icons.search, color: Colors.grey.shade400),
                        suffixIcon: isSearching
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                              )
                            : null,
                        filled: true,
                        fillColor: const Color(0xFFF1F5F9),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      ),
                      onSubmitted: (query) async {
                        if (query.trim().isEmpty) return;
                        setSheetState(() => isSearching = true);
                        
                        final repo = getIt<AuthRepository>();
                        final result = await repo.geocode(query.trim());
                        
                        if (result != null) {
                          setSheetState(() {
                            isSearching = false;
                            searchResults = [result];
                          });
                        } else {
                          setSheetState(() {
                            isSearching = false;
                            searchResults = [];
                          });
                        }
                      },
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Current / Auto-detected location option
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: InkWell(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        final cubit = ctx.mounted ? null : null;  // just for context
                        // Use the parent context to read HomeCubit
                        final homeCubit = BlocProvider.of<HomeCubit>(this.context);
                        homeCubit.resetLocation();
                        Navigator.pop(context);
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: locationService.isOverridden
                              ? const Color(0xFFF8F9FA)
                              : const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: locationService.isOverridden
                                ? Colors.grey.shade200
                                : AppTheme.primaryBlue.withValues(alpha: 0.3),
                            width: 1.5,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: AppTheme.savingsGreen.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.my_location, color: AppTheme.savingsGreen, size: 20),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Auto-detected', style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 15, color: AppTheme.textDark)),
                                  const SizedBox(height: 2),
                                  Text(locationService.autoDetectedCity, style: GoogleFonts.outfit(color: Colors.grey.shade500, fontSize: 13)),
                                ],
                              ),
                            ),
                            if (!locationService.isOverridden)
                              const Icon(Icons.check_circle, color: AppTheme.primaryBlue, size: 22),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Current override if any
                  if (locationService.isOverridden)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: AppTheme.primaryBlue.withValues(alpha: 0.3),
                            width: 1.5,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryBlue.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.location_on, color: AppTheme.primaryBlue, size: 20),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Current', style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 15, color: AppTheme.textDark)),
                                  const SizedBox(height: 2),
                                  Text(currentLocation, style: GoogleFonts.outfit(color: Colors.grey.shade500, fontSize: 13)),
                                ],
                              ),
                            ),
                            const Icon(Icons.check_circle, color: AppTheme.primaryBlue, size: 22),
                          ],
                        ),
                      ),
                    ),
                  // Search results
                  if (searchResults.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Text('SEARCH RESULTS', style: GoogleFonts.outfit(color: Colors.grey.shade500, fontWeight: FontWeight.w700, fontSize: 11, letterSpacing: 1)),
                    ),
                    const SizedBox(height: 8),
                    ...searchResults.map((result) {
                      final name = result['displayName'] ?? result['location_name'] ?? 'Unknown';
                      final lat = double.tryParse(result['lat']?.toString() ?? '');
                      final lng = double.tryParse(result['lng']?.toString() ?? result['lon']?.toString() ?? '');
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
                        child: InkWell(
                          onTap: () {
                            HapticFeedback.mediumImpact();
                            final homeCubit = BlocProvider.of<HomeCubit>(this.context);
                            // Use a short display name
                            String displayName = name;
                            if (result['location_name'] != null) {
                              displayName = result['location_name'];
                            }
                            homeCubit.updateLocation(displayName, lat: lat, lng: lng);
                            Navigator.pop(context);
                          },
                          borderRadius: BorderRadius.circular(16),
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8F9FA),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: Colors.grey.shade200),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFDECB5),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Icon(Icons.place, color: Colors.black87, size: 20),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Text(
                                    name,
                                    style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 15, color: AppTheme.textDark),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey.shade400),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Stack(
          children: [
            // Immersive background elements
            Positioned(
              top: -50,
              right: -50,
              child: Container(
                width: 250,
                height: 250,
                decoration: BoxDecoration(
                  color: AppTheme.primaryBlue.withValues(alpha: 0.03),
                  shape: BoxShape.circle,
                ),
              ).animate(onPlay: (c) => c.repeat(reverse: true))
               .moveX(begin: 0, end: 30, duration: 5.seconds, curve: Curves.easeInOut)
               .moveY(begin: 0, end: 40, duration: 7.seconds, curve: Curves.easeInOut),
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
            
            RefreshIndicator(
              onRefresh: () => context.read<HomeCubit>().loadDashboard(),
              child: BlocBuilder<HomeCubit, HomeState>(
                builder: (context, state) {
                  if (state is HomeLoading) {
                    return const Center(child: CircularProgressIndicator());
                  } else if (state is HomeError) {
                    return Center(child: Text(state.message));
                  } else if (state is HomeLoaded) {
                    return _buildDashboard(context, state);
                  }
                  return const SizedBox.shrink();
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDashboard(BuildContext context, HomeLoaded state) {
    return ListView(
      clipBehavior: Clip.none,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      children: [
        // Top Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Flexible(
              child: const ShopSaveLogo(textSize: 18, iconSize: 24, compact: true)
                  .animate(onPlay: (c) => c.repeat(reverse: true))
                  .shimmer(delay: 5.seconds, duration: 2.seconds, color: Colors.white24)
                  .animate()
                  .fadeIn()
                  .slideX(begin: -0.2),
            ),
            
            const SizedBox(width: 12), // Horizontal gap between logo and location
            
            // Location Selector
            Flexible(
              child: GestureDetector(
                  onTap: () => _showLocationPicker(context, state.locationName),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F9FA),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.location_on_outlined, size: 16, color: AppTheme.savingsGreen),
                        const SizedBox(width: 6),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 120),
                          child: Text(
                            state.locationName,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(Icons.keyboard_arrow_down, size: 16, color: Colors.grey.shade600),
                      ],
                    ),
                  ),
              ),
            ),
            
            const SizedBox(width: 8), // Gap between location and notification
            
            // Notification
            Stack(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: const BoxDecoration(color: Color(0xFFF8F9FA), shape: BoxShape.circle),
                  child: const Icon(Icons.notifications_none, color: AppTheme.textDark, size: 22),
                ),
                Positioned(
                  right: 4,
                  top: 4,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                  ),
                ),
              ],
            ),
          ],
        ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.2),
        const SizedBox(height: 10),
        
        // Search Bar
        GestureDetector(
          onTap: () => context.go('/list'),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9).withValues(alpha: 0.5), 
              borderRadius: BorderRadius.circular(24),
            ),
            child: Row(
              children: [
                Icon(Icons.search, color: Colors.grey.shade400, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Search products to compare...', 
                    style: GoogleFonts.outfit(color: Colors.grey.shade400, fontSize: 16),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),
        const SizedBox(height: 16),
        
        // Categories
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _buildCategoryPill(Icons.shopping_cart_outlined, 'Grocery', true, onTap: () => context.push('/category/grocery')),
            _buildCategoryPill(Icons.local_gas_station_outlined, 'Gas', false, onTap: () => context.push('/category/gas')),
            _buildCategoryPill(Icons.local_pharmacy_outlined, 'Pharmacy', false, onTap: () => context.push('/category/pharmacy')),
          ],
        ).animate().fadeIn(delay: 200.ms).slideX(begin: 0.2).scale(begin: const Offset(0.95, 0.95)),
        const SizedBox(height: 24),
        
        // Best Store Hero Card
        if (state.bestStore != null)
          _buildHeroCard(context, state.bestStore!)
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .shimmer(delay: 5.seconds, duration: 2.seconds, color: Colors.white10)
            .animate()
            .fadeIn(delay: 300.ms)
            .scale(begin: const Offset(0.95, 0.95))
        else if (state.cartItemCount > 0)
          _buildNoResultsHero().animate().fadeIn(delay: 300.ms)
        else
          _buildEmptyHero().animate().fadeIn(delay: 300.ms),
          
        const SizedBox(height: 32),
        // Compare Stores Header
        const Text('Compare Stores', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 22, color: AppTheme.textDark, letterSpacing: -0.5))
            .animate().fadeIn(delay: 400.ms),
        const SizedBox(height: 4),
        Text(state.cartItemCount > 0 
          ? 'Comparison for ${state.cartItemCount} items' 
          : 'Based on your shopping list', 
          style: const TextStyle(color: Colors.grey, fontSize: 14))
            .animate().fadeIn(delay: 450.ms),
        const SizedBox(height: 16),
        
        // Store List
        if (state.bestStore != null)
          _buildStoreListItem(state.bestStore!, isBest: true).animate(delay: 400.ms).fadeIn().slideX(),
        
        ...state.otherStores.asMap().entries.map((entry) {
          final index = entry.key;
          final store = entry.value;
          return Padding(
            padding: const EdgeInsets.only(top: 16),
            child: _buildStoreListItem(store),
          ).animate(delay: (500 + index * 100).ms).fadeIn().slideX();
        }),
        
        if (state.cartItemCount == 0)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Center(child: Text('Add items to your list to compare', style: TextStyle(color: Colors.grey.shade500))),
          )
        else if (state.bestStore == null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Center(child: Text('No store results for your items', style: TextStyle(color: Colors.grey.shade500))),
          ),

        const SizedBox(height: 32),
        // Nearby Deals Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Expanded(
              child: Text(
                'Nearby Deals', 
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 22, color: AppTheme.textDark, letterSpacing: -0.5),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            GestureDetector(
              onTap: () => context.go('/deals'),
              child: const Text('See all', style: TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.w600, fontSize: 14)),
            ),
          ],
        ),
        const SizedBox(height: 20),
        // Deals Carousel
        if (state.nearbyDeals.isEmpty)
          const Center(child: Text('No deals found nearby'))
        else
          Stack(
            clipBehavior: Clip.none,
            children: [
              SingleChildScrollView(
                controller: _dealsScrollController,
                scrollDirection: Axis.horizontal,
                clipBehavior: Clip.none,
                child: Row(
                  children: [
                    ...state.nearbyDeals.asMap().entries.map((entry) {
                      final index = entry.key;
                      final deal = entry.value;
                      return Padding(
                        padding: const EdgeInsets.only(right: 16),
                        child: _buildDealCard(context, deal),
                      ).animate(onPlay: (c) => c.repeat(reverse: true))
                       .moveY(begin: 0, end: index % 2 == 0 ? 5 : -5, duration: (2000 + index * 200).ms, curve: Curves.easeInOut);
                    }).toList(),
                    // Add some extra padding at the end so the arrow doesn't cover the last card too much
                    const SizedBox(width: 40),
                  ],
                ),
              ),
              Positioned(
                right: -10,
                top: 0,
                bottom: 0,
                child: Center(
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      _dealsScrollController.animateTo(
                        _dealsScrollController.offset + 220,
                        duration: const Duration(milliseconds: 500),
                        curve: Curves.easeOutQuart,
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryBlue,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primaryBlue.withValues(alpha: 0.4),
                            blurRadius: 12,
                            spreadRadius: 4,
                          ),
                        ],
                      ),
                      child: const Icon(Icons.arrow_forward_ios, size: 12, color: Colors.white),
                    )
                    .animate(onPlay: (controller) => controller.repeat(reverse: true))
                    .scale(begin: const Offset(1, 1), end: const Offset(1.1, 1.1), duration: 1000.ms, curve: Curves.easeInOut)
                    .shimmer(delay: 3.seconds, duration: 1.seconds, color: Colors.white24),
                  ),
                ),
              ),
            ],
          ),
        const SizedBox(height: 40),
      ],
    );
  }

  Widget _buildEmptyHero() {
    return Container(
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F9FA),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade100, width: 1.5),
      ),
      child: Column(
        children: [
          Icon(Icons.shopping_cart_outlined, size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text('No items to compare', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const SizedBox(height: 8),
          const Text('Add products to your list to find the best local prices.', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _buildNoResultsHero() {
    return Container(
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F9FA),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade100, width: 1.5),
      ),
      child: Column(
        children: [
          Icon(Icons.search_off_outlined, size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text('Finding best prices...', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const SizedBox(height: 8),
          const Text('Calculating totals across local stores.', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _buildHeroCard(BuildContext context, Map<String, dynamic> data) {
    final store = data['store'];
    final products = data['products'] as List? ?? [];
    
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: Colors.grey.shade100, width: 2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 30,
            offset: const Offset(0, 10),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.savingsGreen,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.star, color: Colors.white, size: 14),
                      SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          'BEST STORE RIGHT NOW', 
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11, letterSpacing: 0.5),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ).animate(onPlay: (controller) => controller.repeat(reverse: true))
                 .shimmer(delay: 2.seconds, duration: 1500.ms, color: Colors.white24),
              ),
              const SizedBox(width: 8),
              if (data['savings'] != null && data['savings'] > 0)
                Text('Save \$${data['savings']}', style: const TextStyle(color: AppTheme.savingsGreen, fontWeight: FontWeight.w900, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              const Icon(Icons.verified, color: AppTheme.primaryBlue, size: 24),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  store['name'],
                  style: const TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.w900, fontSize: 32, letterSpacing: -0.5),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text('Best value for your full basket', style: TextStyle(color: Colors.grey, fontSize: 16, fontWeight: FontWeight.w500)),
          const SizedBox(height: 24),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildDetailPill(Icons.location_on, '${(data['driving_distance'] / 2).toStringAsFixed(1)} mi'),
                const SizedBox(width: 12),
                _buildDetailPill(Icons.access_time_filled, '4 min'),
                const SizedBox(width: 12),
                _buildDetailPill(Icons.directions_car, '\$${data['driving_cost']} drive'),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 100,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: products.length > 3 ? 3 : products.length,
                    itemBuilder: (context, index) {
                      final product = products[index];
                      return Container(
                        width: 80,
                        margin: const EdgeInsets.only(right: 12),
                        child: Column(
                          children: [
                            _buildProductImage(product),
                            const SizedBox(height: 8),
                            Text('\$${product['price']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
              GestureDetector(
                onTap: () => context.push('/compare'),
                child: const Row(
                  children: [
                    Text('View All', style: TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.bold, fontSize: 15)),
                    SizedBox(width: 4),
                    Icon(Icons.chevron_right, color: AppTheme.primaryBlue, size: 20),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }


  Widget _buildStoreListItem(Map<String, dynamic> data, {bool isBest = false}) {
    final store = data['store'];
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isBest ? const Color(0xFFF0FDF4).withValues(alpha: 0.5) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isBest ? AppTheme.savingsGreen : Colors.grey.shade100, 
          width: isBest ? 2 : 1.5,
        ),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          if (isBest)
            Positioned(
              top: -32,
              left: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: const BoxDecoration(
                  color: AppTheme.savingsGreen,
                  borderRadius: BorderRadius.only(topLeft: Radius.circular(8), topRight: Radius.circular(8)),
                ),
                child: const Text('BEST PRICE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 10)),
              ),
            ),
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F9FA),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: store['chain']?['logo_url'] != null
                      ? Image.network(store['chain']['logo_url'], width: 32, height: 32, errorBuilder: (c,e,s) => const Icon(Icons.store, color: AppTheme.primaryBlue))
                      : const Icon(Icons.store, color: AppTheme.primaryBlue, size: 24),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(store['name'], style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppTheme.textDark), overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Text('${(data['driving_distance']/2).toStringAsFixed(1)} mi \u00B7 4 min \u00B7 \$${data['driving_cost']}', style: const TextStyle(color: Colors.grey, fontSize: 13, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('\$${data['true_cost']}', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: isBest ? AppTheme.savingsGreen : AppTheme.textDark)),
                  if (data['savings'] != null && data['savings'] > 0)
                    Text('Save \$${data['savings']}', style: const TextStyle(color: AppTheme.savingsGreen, fontWeight: FontWeight.bold, fontSize: 12)),
                ],
              )
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryPill(IconData icon, String text, bool isSelected, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryBlue : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? AppTheme.primaryBlue : Colors.grey.shade200),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: isSelected ? Colors.white : Colors.grey.shade500),
            const SizedBox(width: 4),
            Text(text, style: TextStyle(color: isSelected ? Colors.white : Colors.grey.shade600, fontWeight: FontWeight.w600, fontSize: 13)),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailPill(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: const Color(0xFFF8F9FA), borderRadius: BorderRadius.circular(10)),
      child: Row(
        children: [
          Icon(icon, size: 14, color: Colors.grey.shade500),
          const SizedBox(width: 6),
          Text(text, style: TextStyle(color: Colors.grey.shade600, fontSize: 12, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildDealCard(BuildContext context, Map<String, dynamic> deal) {
    return Container(
      width: 200,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade100, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              Container(
                height: 140,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F9FA),
                  borderRadius: const BorderRadius.only(topLeft: Radius.circular(24), topRight: Radius.circular(24)),
                ),
                child: Center(
                  child: deal['image_url'] != null
                      ? Image.network(deal['image_url'], height: 100, fit: BoxFit.contain, errorBuilder: (c, e, s) => _buildDealPlaceholder(deal))
                      : _buildDealPlaceholder(deal),
                ),
              ),
              Positioned(
                top: 12, left: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: AppTheme.savingsGreen, borderRadius: BorderRadius.circular(12)),
                  child: Text('${deal['savings_percentage']}% OFF', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 11)),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(deal['store']['name'].toString().toUpperCase(), style: const TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 1)),
                const SizedBox(height: 4),
                Text(deal['name'], style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppTheme.textDark), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(deal['brand'] ?? '52 fl oz', style: const TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w500)),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('\$${deal['sale_price']}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: AppTheme.textDark)),
                    const SizedBox(width: 8),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text('\$${deal['price']}', style: const TextStyle(color: Colors.grey, decoration: TextDecoration.lineThrough, fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
                  ],
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildProductImage(Map<String, dynamic> product) {
    final name = product['name']?.toString().toLowerCase() ?? '';
    final category = product['category']?.toString().toLowerCase() ?? '';
    
    IconData icon = Icons.shopping_basket_rounded;
    Color color = Colors.grey.shade400;

    if (category.contains('pharmacy') || name.contains('med') || name.contains('pill') || name.contains('drug')) {
      icon = Icons.medication_rounded;
      color = const Color(0xFF6A3CE2).withValues(alpha: 0.5);
    } else if (category.contains('house') || name.contains('clean') || name.contains('soap') || name.contains('wash')) {
      icon = Icons.inventory_2_rounded;
      color = Colors.blueGrey.shade300.withValues(alpha: 0.5);
    } else {
      color = AppTheme.savingsGreen.withValues(alpha: 0.5);
    }

    return Container(
      width: 50,
      height: 50,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(icon, color: color, size: 28),
    );
  }

  Widget _buildDealPlaceholder(Map<String, dynamic> deal) {
    final name = deal['name']?.toString().toLowerCase() ?? '';
    final category = deal['category']?.toString().toLowerCase() ?? '';
    
    IconData icon = Icons.shopping_cart_rounded;
    Color color = AppTheme.primaryBlue;

    if (category.contains('pharmacy') || name.contains('med') || name.contains('pill')) {
      icon = Icons.local_pharmacy_rounded;
      color = const Color(0xFF6A3CE2);
    } else if (category.contains('house') || name.contains('clean') || name.contains('home')) {
      icon = Icons.home_rounded;
      color = Colors.blueGrey;
    }

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 40, color: color.withValues(alpha: 0.3)),
          const SizedBox(height: 8),
          Icon(Icons.image_not_supported_outlined, size: 16, color: color.withValues(alpha: 0.2)),
        ],
      ),
    );
  }
}
