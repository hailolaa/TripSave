import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../bloc/list_cubit.dart';
import '../../home/bloc/home_cubit.dart';

class ListScreen extends StatefulWidget {
  const ListScreen({super.key});

  @override
  State<ListScreen> createState() => _ListScreenState();
}

class _ListScreenState extends State<ListScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocus = FocusNode();

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    context.read<ListCubit>().searchProducts(query);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('My List', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 32, color: AppTheme.textDark, letterSpacing: -0.5)),
            Text('Manage your grocery savings', style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
          ],
        ),
        titleSpacing: 20,
        toolbarHeight: 90,
        actions: [
          BlocBuilder<ListCubit, ListState>(
            builder: (context, state) {
              int count = 0;
              if (state is ListLoaded) {
                count = state.items.length;
              }
              return Container(
                margin: const EdgeInsets.only(right: 20),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F0FE),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text('$count items', style: const TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.bold)),
              );
            },
          )
        ],
      ),
      body: Stack(
        children: [
          // Background Blobs
          Positioned(
            top: -50,
            right: -30,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                color: AppTheme.primaryBlue.withValues(alpha: 0.04),
                shape: BoxShape.circle,
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
             .moveX(begin: 0, end: -20, duration: 8.seconds, curve: Curves.easeInOut)
             .moveY(begin: 0, end: 30, duration: 10.seconds, curve: Curves.easeInOut),
          ),
          Positioned(
            bottom: 50,
            left: -50,
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                color: AppTheme.savingsGreen.withValues(alpha: 0.03),
                shape: BoxShape.circle,
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
             .moveX(begin: 0, end: 30, duration: 7.seconds, curve: Curves.easeInOut)
             .moveY(begin: 0, end: -20, duration: 9.seconds, curve: Curves.easeInOut),
          ),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20.0),
            child: Column(
              children: [
                // Search Input
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.grey.withValues(alpha: 0.05)),
                  ),
                  child: TextField(
                    controller: _searchController,
                    focusNode: _searchFocus,
                    onChanged: _onSearchChanged,
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w500),
                    decoration: InputDecoration(
                      hintText: 'Search products to add...',
                      hintStyle: GoogleFonts.outfit(color: Colors.grey.shade400, fontSize: 15),
                      prefixIcon: const Icon(Icons.search, color: AppTheme.primaryBlue, size: 20),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, color: Colors.grey, size: 20),
                              onPressed: () {
                                _searchController.clear();
                                context.read<ListCubit>().clearSearch();
                                _searchFocus.unfocus();
                              },
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                  ),
                ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.1),
                const SizedBox(height: 20),
                // List Items
                Expanded(
                  child: BlocBuilder<ListCubit, ListState>(
                    builder: (context, state) {
                      if (state is ListLoading) {
                        return const Center(child: CircularProgressIndicator());
                      } else if (state is ListError) {
                        return Center(child: Text(state.message, style: const TextStyle(color: Colors.red)));
                      } else if (state is ListLoaded) {
                        if (state.items.isEmpty) {
                          return _buildEmptyState();
                        }
                        
                        return ListView.builder(
                          itemCount: state.items.length,
                          itemBuilder: (context, index) {
                            final item = state.items[index];
                            return _buildListItem(item).animate(delay: (index * 50).ms).fadeIn().slideX(begin: 0.05);
                          },
                        );
                      }
                      return const SizedBox.shrink();
                    },
                  ),
                ),
                
                // Mini Cart Summary (Flow 4)
                BlocBuilder<ListCubit, ListState>(
                  builder: (context, state) {
                    if (state is! ListLoaded || state.items.isEmpty || state.cartSummary == null) {
                      return const SizedBox.shrink();
                    }
                    return _buildCartSummary(state.cartSummary!).animate().fadeIn(delay: 200.ms).slideY(begin: 0.2, end: 0);
                  },
                ),
                const SizedBox(height: 12),


              ],
            ),
          ),
          
          // Autocomplete Dropdown overlay
          BlocBuilder<ListCubit, ListState>(
            builder: (context, state) {
              if (state is ListLoaded && state.searchResults.isNotEmpty) {
                return Positioned(
                  top: 70, 
                  left: 20,
                  right: 20,
                  child: Material(
                    elevation: 8,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      constraints: const BoxConstraints(maxHeight: 300),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: ListView.builder(
                        padding: EdgeInsets.zero,
                        shrinkWrap: true,
                        itemCount: state.searchResults.length,
                        itemBuilder: (context, index) {
                          final product = state.searchResults[index];
                          return ListTile(
                            leading: product['image_url'] != null
                              ? Image.network(product['image_url'], width: 40, height: 40, errorBuilder: (c,e,s) => const Icon(Icons.fastfood))
                              : const Icon(Icons.fastfood, color: Colors.grey),
                            title: Text(product['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text('${product['brand'] ?? ''} • ${product['category'] ?? ''}', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                            trailing: const Icon(Icons.add_circle, color: AppTheme.primaryBlue),
                            onTap: () async {
                              final listCubit = context.read<ListCubit>();
                              final homeCubit = context.read<HomeCubit>();
                              await listCubit.addToCart(product['id']);
                              homeCubit.loadDashboard();
                              _searchController.clear();
                              _searchFocus.unfocus();
                            },
                          );
                        },
                      ),
                    ),
                  ),
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.shopping_basket_outlined, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text('Your list is empty', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: Colors.grey.shade700)),
          const SizedBox(height: 8),
          Text('Search above to add items', style: TextStyle(color: Colors.grey.shade500)),
        ],
      ),
    );
  }

  Widget _buildCartSummary(Map<String, dynamic> summary) {
    final itemsFound = summary['items_found'] ?? 0;
    final basketTotal = summary['item_total'] ?? 0.0;
    final driveCost = summary['driving_cost'] ?? 0.0;
    final trueCost = summary['true_cost'] ?? 0.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.savingsGreen.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, -4)),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: AppTheme.lightGreenBg, borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.stars, color: AppTheme.savingsGreen, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('My List', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 32, color: AppTheme.textDark, letterSpacing: -0.5)),
                    Text('Track your grocery savings', style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('\$$trueCost', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: AppTheme.savingsGreen)),
                  Text('$itemsFound items found', style: TextStyle(color: Colors.grey.shade600, fontSize: 10)),
                ],
              ),
            ],
          ),
          const Divider(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(child: _buildSummaryPill(Icons.shopping_bag_outlined, 'Items: \$$basketTotal')),
              const SizedBox(width: 4),
              Expanded(child: _buildSummaryPill(Icons.local_gas_station_outlined, 'Drive: \$$driveCost')),
              const SizedBox(width: 4),
              Expanded(child: _buildSummaryPill(Icons.timer_outlined, '${((summary['driving_distance'] ?? 0) / 2).toStringAsFixed(1)} mi')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryPill(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: Colors.grey.shade600),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              text, 
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey.shade700),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildListItem(Map<String, dynamic> item) {
    final product = item['product'] ?? {};
    final itemId = item['id'];
    final quantity = item['quantity'] ?? 1;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: Colors.grey.shade400),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product['name'] ?? 'Unknown Item',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textDark),
                ),
                if (product['brand'] != null)
                  Text(product['brand'], style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ],
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                InkWell(
                  onTap: () async {
                    final listCubit = context.read<ListCubit>();
                    final homeCubit = context.read<HomeCubit>();
                    await listCubit.updateQuantity(itemId, quantity - 1);
                    homeCubit.loadDashboard();
                  },
                  child: const Padding(padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4), child: Icon(Icons.remove, size: 16)),
                ),
                Text('$quantity', style: const TextStyle(fontWeight: FontWeight.bold)),
                InkWell(
                  onTap: () async {
                    final listCubit = context.read<ListCubit>();
                    final homeCubit = context.read<HomeCubit>();
                    await listCubit.updateQuantity(itemId, quantity + 1);
                    homeCubit.loadDashboard();
                  },
                  child: const Padding(padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4), child: Icon(Icons.add, size: 16)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: () async {
              final listCubit = context.read<ListCubit>();
              final homeCubit = context.read<HomeCubit>();
              await listCubit.removeFromCart(itemId);
              homeCubit.loadDashboard();
            },
            child: Icon(Icons.delete_outline, color: Colors.red.shade300, size: 22),
          ),
        ],
      ),
    );
  }
}
