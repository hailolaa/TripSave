import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import 'package:trip_save/features/list/bloc/list_cubit.dart';
import 'package:trip_save/features/home/bloc/home_cubit.dart';
import 'package:trip_save/features/deals/bloc/deals_cubit.dart';

class DealsScreen extends StatefulWidget {
  const DealsScreen({super.key});

  @override
  State<DealsScreen> createState() => _DealsScreenState();
}

class _DealsScreenState extends State<DealsScreen> {
  int _selectedFilter = 0;
  final List<String> _filters = ['All', 'Grocery', 'Pharmacy', 'Household'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Deals', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 24)),
        toolbarHeight: 70,
      ),
      body: BlocBuilder<DealsCubit, DealsState>(
        builder: (context, state) {
          if (state is DealsLoading) {
            return const Center(child: CircularProgressIndicator());
          } else if (state is DealsError) {
            return Center(child: Text(state.message));
          } else if (state is DealsLoaded) {
            final deals = state.deals;
            
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Pills
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    children: [
                      _buildPill(Icons.local_offer_outlined, 'All Deals', false),
                      const SizedBox(width: 8),
                      _buildPill(Icons.percent, 'Clearance', true, isOrange: true),
                      const SizedBox(width: 8),
                      _buildPill(Icons.star_border, 'My Saving', false),
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
                        onTap: () => setState(() => _selectedFilter = index),
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected ? AppTheme.textDark : Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            _filters[index],
                            style: GoogleFonts.outfit(
                                color: isSelected ? Colors.white : Colors.grey.shade700,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500),
                          ),
                        ),
                      );
                    }),
                  ),
                ),
                const SizedBox(height: 20),
                // List
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () => context.read<DealsCubit>().fetchDeals(),
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                      itemCount: deals.length,
                      separatorBuilder: (c, i) => const SizedBox(height: 16),
                      itemBuilder: (context, index) {
                        final deal = deals[index];
                        return _buildProductDeal(context, deal);
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
    );
  }

  Widget _buildPill(IconData icon, String text, bool isSelected, {bool isOrange = false}) {
    Color bgColor = Colors.white;
    Color textColor = AppTheme.textDark;
    Color borderColor = Colors.grey.shade300;

    if (isSelected && isOrange) {
      bgColor = const Color(0xFFF97316); // Orange
      textColor = Colors.white;
      borderColor = Colors.transparent;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor),
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

  Widget _buildStoreHeader(String name, String subtitle, String badgeText) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: const Color(0xFFE8F0FE), borderRadius: BorderRadius.circular(8)),
          child: const Icon(Icons.shopping_cart_outlined, color: AppTheme.primaryBlue, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16)),
              Text(subtitle, style: GoogleFonts.outfit(color: Colors.grey, fontSize: 12)),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF7ED),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(badgeText, style: GoogleFonts.outfit(color: const Color(0xFFF97316), fontWeight: FontWeight.bold, fontSize: 10)),
        ),
      ],
    );
  }

  Widget _buildProductDeal(BuildContext context, Map<String, dynamic> deal) {
    return InkWell(
      onTap: () {},
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Row(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: deal['image_url'] != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.network(deal['image_url'], fit: BoxFit.cover, errorBuilder: (c,e,s) => const Icon(Icons.fastfood, color: Colors.grey)),
                      )
                    : const Icon(Icons.fastfood, color: Colors.grey),
                ),
                Positioned(
                  top: -6,
                  left: -6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF97316),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text('${deal['savings_percentage']}%', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(deal['store']['name'].toString().toUpperCase(), style: GoogleFonts.outfit(color: AppTheme.primaryBlue, fontWeight: FontWeight.bold, fontSize: 10, letterSpacing: 0.5)),
                  const SizedBox(height: 2),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(child: Text(deal['name'], style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16), overflow: TextOverflow.ellipsis)),
                      Text('Save \$${deal['savings']}', style: GoogleFonts.outfit(color: AppTheme.savingsGreen, fontWeight: FontWeight.bold, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text('\$${deal['price']}', style: GoogleFonts.outfit(color: Colors.grey, decoration: TextDecoration.lineThrough, fontSize: 14)),
                      const SizedBox(width: 8),
                      Text('\$${deal['sale_price']}', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18, color: AppTheme.textDark)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            GestureDetector(
              onTap: () async {
                final listCubit = context.read<ListCubit>();
                final homeCubit = context.read<HomeCubit>();
                await listCubit.addToCart(deal['productId']);
                homeCubit.loadDashboard();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('${deal['name']} added to your shopping list!'),
                      behavior: SnackBarBehavior.floating,
                      action: SnackBarAction(label: 'View', onPressed: () => context.go('/list')),
                    ),
                  );
                }
              },
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(
                  color: Color(0xFFF0F5FF),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.add, color: AppTheme.primaryBlue, size: 20),
              ),
            )
          ],
        ),
      ),
    );
  }
}

