import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/theme/app_theme.dart';
import 'package:trip_save/features/list/bloc/list_cubit.dart';
import 'package:trip_save/features/home/bloc/home_cubit.dart';
import 'package:trip_save/features/deals/bloc/deals_cubit.dart';
import '../../../core/widgets/app_error_widget.dart';

class DealsScreen extends StatefulWidget {
  const DealsScreen({super.key});

  @override
  State<DealsScreen> createState() => _DealsScreenState();
}

class _DealsScreenState extends State<DealsScreen> {
  int _selectedFilter = 0; // Categories
  int _selectedTopPill = 0; // 0: All, 1: Clearance, 2: My Saving
  final List<String> _filters = ['All', 'Grocery', 'Pharmacy', 'Household'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('DEALS', style: GoogleFonts.outfit(color: AppTheme.primaryBlue, fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 1.5)),
            Text('Nearby Offers', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 32, color: AppTheme.textDark, letterSpacing: -0.5)),
          ],
        ),
        titleSpacing: 20,
        toolbarHeight: 90,
      ),
      body: Stack(
        children: [
          // Background Blobs
          Positioned(
            top: -30,
            right: -20,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                color: const Color(0xFFF97316).withValues(alpha: 0.04),
                shape: BoxShape.circle,
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
             .moveX(begin: 0, end: -15, duration: 12.seconds, curve: Curves.easeInOut)
             .moveY(begin: 0, end: 20, duration: 15.seconds, curve: Curves.easeInOut),
          ),
          Positioned(
            bottom: 150,
            left: -40,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                color: AppTheme.primaryBlue.withValues(alpha: 0.03),
                shape: BoxShape.circle,
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
             .moveX(begin: 0, end: 25, duration: 10.seconds, curve: Curves.easeInOut)
             .moveY(begin: 0, end: -15, duration: 8.seconds, curve: Curves.easeInOut),
          ),

          BlocBuilder<DealsCubit, DealsState>(
            builder: (context, state) {
              if (state is DealsLoading) {
                return const Center(child: CircularProgressIndicator());
              } else if (state is DealsError) {
                return AppErrorWidget(
                  message: state.message,
                  onRetry: () => context.read<DealsCubit>().fetchDeals(),
                );
              } else if (state is DealsLoaded) {
                final deals = state.deals.where((deal) => _matchesSelectedFilter(deal)).toList();
                
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top Pills (Primary Filters)
                    const SizedBox(height: 8),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Row(
                        children: [
                          GestureDetector(
                            onTap: () {
                              HapticFeedback.lightImpact();
                              setState(() => _selectedTopPill = 0);
                            },
                            child: _buildPill(Icons.local_offer_outlined, 'All Deals', _selectedTopPill == 0)
                                .animate().fadeIn(duration: 400.ms).slideX(begin: 0.1),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () {
                              HapticFeedback.lightImpact();
                              setState(() => _selectedTopPill = 1);
                            },
                            child: _buildPill(Icons.percent, 'Clearance', _selectedTopPill == 1, isOrange: true)
                                .animate(delay: 100.ms).fadeIn(duration: 400.ms).slideX(begin: 0.1),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () {
                              HapticFeedback.lightImpact();
                              setState(() => _selectedTopPill = 2);
                            },
                            child: _buildPill(Icons.star_border, 'My Saving', _selectedTopPill == 2)
                                .animate(delay: 200.ms).fadeIn(duration: 400.ms).slideX(begin: 0.1),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Category Filters
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Row(
                        children: List.generate(_filters.length, (index) {
                          final isSelected = _selectedFilter == index;
                          return GestureDetector(
                            onTap: () {
                              HapticFeedback.lightImpact();
                              setState(() => _selectedFilter = index);
                            },
                            child: Container(
                              margin: const EdgeInsets.only(right: 12),
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                              decoration: BoxDecoration(
                                color: isSelected ? AppTheme.textDark : Colors.white,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: isSelected ? Colors.transparent : Colors.grey.shade200),
                                boxShadow: isSelected ? [
                                  BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 8, offset: const Offset(0, 4))
                                ] : null,
                              ),
                              child: Text(
                                _filters[index],
                                style: GoogleFonts.outfit(
                                    color: isSelected ? Colors.white : Colors.grey.shade700,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500),
                              ),
                            ).animate().fadeIn(delay: (300 + index * 50).ms).slideX(begin: 0.1),
                          );
                        }),
                      ),
                    ),
                    const SizedBox(height: 20),
                    // List
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: () => context.read<DealsCubit>().fetchDeals(),
                        child: deals.isEmpty 
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.search_off, size: 64, color: Colors.grey.shade300),
                                  const SizedBox(height: 16),
                                  Text('No items found for this filter', style: GoogleFonts.outfit(color: Colors.grey.shade500, fontSize: 16)),
                                ],
                              ),
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(20, 10, 20, 100),
                              itemCount: deals.length,
                              separatorBuilder: (c, i) => const SizedBox(height: 16),
                              itemBuilder: (context, index) {
                                final deal = deals[index];
                                return _buildProductDeal(context, deal)
                                    .animate(delay: (400 + (index < 6 ? index * 100 : 0)).ms)
                                    .fadeIn(duration: 400.ms)
                                    .slideY(begin: 0.1);
                              },
                            ),
                      ),
                    )
                  ],
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
    );
  }

  Widget _buildPill(IconData icon, String text, bool isSelected, {bool isOrange = false}) {
    Color bgColor = isSelected ? (isOrange ? const Color(0xFFF97316) : AppTheme.textDark) : Colors.white;
    Color textColor = isSelected ? Colors.white : AppTheme.textDark;
    Color borderColor = isSelected ? Colors.transparent : Colors.grey.shade300;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor),
        boxShadow: isSelected ? [
          BoxShadow(color: bgColor.withValues(alpha: 0.2), blurRadius: 10, offset: const Offset(0, 4))
        ] : null,
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: textColor),
          const SizedBox(width: 6),
          Text(text, style: GoogleFonts.outfit(color: textColor, fontWeight: FontWeight.bold, fontSize: 13)),
        ],
      ),
    );
  }

  bool _matchesSelectedFilter(Map<String, dynamic> deal) {
    // 1. Top Pill Filtering
    bool matchesTop = true;
    if (_selectedTopPill == 1) { // Clearance
      final savingsPct = num.tryParse(deal['savings_percentage']?.toString() ?? '0') ?? 0;
      matchesTop = savingsPct > 0;
    } else if (_selectedTopPill == 2) { // My Saving
      final listState = context.read<ListCubit>().state;
      if (listState is ListLoaded) {
        final productId = deal['productId']?.toString();
        matchesTop = listState.items.any((item) => item['id']?.toString() == productId);
      } else {
        matchesTop = false;
      }
    }

    if (!matchesTop) return false;

    // 2. Category Filtering
    if (_selectedFilter == 0) return true;

    final category = (deal['category'] ?? '').toString().toLowerCase();
    final name = (deal['name'] ?? '').toString().toLowerCase();
    final storeType = (deal['store']?['chain']?['type'] ?? '').toString().toLowerCase();

    switch (_filters[_selectedFilter].toLowerCase()) {
      case 'grocery':
        return storeType == 'grocery' || 
               category.contains('grocery') || category.contains('food') || category.contains('bev') || category.contains('produce') ||
               name.contains('milk') || name.contains('bread') || name.contains('egg') || name.contains('meat') || 
               name.contains('fruit') || name.contains('veg') || name.contains('snack') || name.contains('drink') ||
               name.contains('dairy') || name.contains('pantry') || name.contains('frozen');
      case 'pharmacy':
        return storeType == 'pharmacy' || 
               category.contains('pharmacy') || category.contains('medicine') || category.contains('health') || category.contains('wellness') ||
               name.contains('med') || name.contains('pill') || name.contains('drug') || name.contains('vitamin') || 
               name.contains('cold') || name.contains('flu') || name.contains('pain') || name.contains('care');
      case 'household':
        return category.contains('house') || category.contains('clean') || category.contains('home') || 
               category.contains('paper') || category.contains('personal care') ||
               name.contains('wash') || name.contains('soap') || name.contains('detergent') || name.contains('kitchen') || 
               name.contains('bath') || name.contains('toilet') || name.contains('towel') || name.contains('bag');
      default:
        return true;
    }
  }

  Widget _buildProductDeal(BuildContext context, Map<String, dynamic> deal) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 15, offset: const Offset(0, 8))
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: 70,
                      height: 70,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8F9FA),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey.shade100),
                      ),
                      child: (deal['image_url'] != null && deal['image_url'].toString().isNotEmpty)
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(16),
                            child: CachedNetworkImage(
                              imageUrl: deal['image_url'], 
                              fit: BoxFit.cover, 
                              placeholder: (context, url) => Center(child: Icon(_getCategoryIcon(deal), color: Colors.grey.shade300, size: 20)),
                              errorWidget: (context, url, error) => Icon(_getCategoryIcon(deal), color: Colors.grey.shade300, size: 32),
                            ),
                          )
                        : Icon(_getCategoryIcon(deal), color: Colors.grey.shade300, size: 32),
                    ),
                    if (num.tryParse(deal['savings_percentage']?.toString() ?? '0')! > 0)
                      Positioned(
                        top: -6,
                        left: -6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF97316),
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: [
                              BoxShadow(color: const Color(0xFFF97316).withValues(alpha: 0.3), blurRadius: 8, offset: const Offset(0, 2))
                            ],
                          ),
                          child: Text('${deal['savings_percentage']}% OFF', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(deal['store']['name'].toString().toUpperCase(), 
                          style: GoogleFonts.outfit(color: AppTheme.primaryBlue, fontWeight: FontWeight.w900, fontSize: 9, letterSpacing: 1.2)),
                      const SizedBox(height: 4),
                      Text(deal['name'], 
                          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 17, color: AppTheme.textDark), 
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          if (deal['savings_percentage'] > 0) ...[
                            Text('\$${deal['price']}', style: GoogleFonts.outfit(color: Colors.grey.shade400, decoration: TextDecoration.lineThrough, fontSize: 13)),
                            const SizedBox(width: 8),
                          ],
                          Text('\$${deal['sale_price']}', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 18, color: deal['savings_percentage'] > 0 ? AppTheme.savingsGreen : AppTheme.textDark)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                GestureDetector(
                  onTap: () async {
                    HapticFeedback.mediumImpact();
                    final listCubit = context.read<ListCubit>();
                    final homeCubit = context.read<HomeCubit>();
                    await listCubit.addToCart(deal['productId']);
                    homeCubit.loadDashboard();
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).hideCurrentSnackBar();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: AppTheme.textDark,
                          duration: const Duration(seconds: 2),
                          content: Text('${deal['name']} added to your list!', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          behavior: SnackBarBehavior.floating,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          action: SnackBarAction(label: 'VIEW LIST', textColor: AppTheme.savingsGreen, onPressed: () => context.go('/list')),
                        ),
                      );
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0F5FF),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.add_shopping_cart_rounded, color: AppTheme.primaryBlue, size: 20),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _getCategoryIcon(Map<String, dynamic> deal) {
    final name = deal['name']?.toString().toLowerCase() ?? '';
    final category = deal['category']?.toString().toLowerCase() ?? '';

    if (category.contains('pharmacy') || name.contains('med') || name.contains('pill') || name.contains('drug')) {
      return Icons.local_pharmacy_rounded;
    } else if (category.contains('house') || name.contains('clean') || name.contains('home') || name.contains('soap')) {
      return Icons.home_rounded;
    }
    return Icons.shopping_basket_rounded;
  }
}

