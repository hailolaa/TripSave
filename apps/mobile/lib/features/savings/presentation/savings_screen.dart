import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../bloc/savings_cubit.dart';

class SavingsScreen extends StatelessWidget {
  const SavingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Savings', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 32, color: AppTheme.textDark, letterSpacing: -0.5)),
            Text('Your trip history & rewards', style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
          ],
        ),
        titleSpacing: 20,
        toolbarHeight: 90,
      ),
      body: Stack(
        children: [
          // Background Blobs
          Positioned(
            top: -60,
            right: -40,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                color: AppTheme.savingsGreen.withValues(alpha: 0.04),
                shape: BoxShape.circle,
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
             .moveX(begin: 0, end: -25, duration: 9.seconds, curve: Curves.easeInOut)
             .moveY(begin: 0, end: 40, duration: 11.seconds, curve: Curves.easeInOut),
          ),
          Positioned(
            bottom: 80,
            left: -60,
            child: Container(
              width: 280,
              height: 280,
              decoration: BoxDecoration(
                color: AppTheme.primaryBlue.withValues(alpha: 0.03),
                shape: BoxShape.circle,
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
             .moveX(begin: 0, end: 35, duration: 7.seconds, curve: Curves.easeInOut)
             .moveY(begin: 0, end: -25, duration: 9.seconds, curve: Curves.easeInOut),
          ),

          BlocBuilder<SavingsCubit, SavingsState>(
            builder: (context, state) {
          if (state is SavingsLoading || state is SavingsInitial) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state is SavingsLoaded) {
            final records = state.records;
            return ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildTopChip('\$${state.totalSaved.toStringAsFixed(2)}', true).animate().fadeIn(delay: 0.ms).slideX(begin: -0.1),
                    _buildTopChip('${records.length} Trips', false, isBlue: true).animate().fadeIn(delay: 100.ms).slideX(begin: 0.1),
                  ],
                ),
                const SizedBox(height: 24),
                Text('Savings History', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 20, color: AppTheme.textDark)).animate(delay: 200.ms).fadeIn().slideX(begin: 0.1),
                const SizedBox(height: 16),
                if (records.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Text('No trips saved yet', style: TextStyle(color: Colors.grey.shade500)),
                    ),
                  )
                else
                  ...records.asMap().entries.map((entry) {
                    final index = entry.key;
                    final record = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: _buildHistoryItem(
                        _getIconData(record.iconName),
                        const Color(0xFFE8F0FE),
                        AppTheme.primaryBlue,
                        record.storeName,
                        '${record.category} \u00B7 ${_formatDate(record.date)}',
                        '-\$${record.amountSaved.toStringAsFixed(2)}',
                      ).animate(delay: (300 + index * 50).ms).fadeIn().slideX(begin: 0.1),
                    );
                  }),
                const SizedBox(height: 32),
                InkWell(
                  onTap: () => context.go('/list'),
                  borderRadius: BorderRadius.circular(24),
                  child: Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [const Color(0xFFEFF6FF), Colors.white, AppTheme.primaryBlue.withValues(alpha: 0.05)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: const Color(0xFFD6E4FF), width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.primaryBlue.withValues(alpha: 0.05),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(color: AppTheme.primaryBlue.withValues(alpha: 0.1), shape: BoxShape.circle),
                              child: const Icon(Icons.bolt, color: AppTheme.primaryBlue, size: 16),
                            ),
                            const SizedBox(width: 8),
                            Text('Pro Tip', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 12, color: AppTheme.primaryBlue, letterSpacing: 1)),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text('Save even more', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 20, color: AppTheme.textDark)),
                        const SizedBox(height: 12),
                        Text('Add items to your list and compare prices before every trip to maximize savings.', style: GoogleFonts.outfit(color: Colors.blue.shade800, height: 1.5, fontSize: 15)),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Text('Add to List', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: AppTheme.primaryBlue, fontSize: 16)),
                            const SizedBox(width: 4),
                            const Icon(Icons.arrow_forward_rounded, color: AppTheme.primaryBlue, size: 20),
                          ],
                        )
                      ],
                    ),
                  ),
                ).animate(delay: 600.ms).fadeIn().slideY(begin: 0.2)
                 .animate(onPlay: (c) => c.repeat(reverse: true))
                 .moveY(begin: 0, end: -4, duration: 4.seconds, curve: Curves.easeInOut),
                const SizedBox(height: 30),
              ],
            );
          }
          return const Center(child: Text('Error loading savings'));
        },
      ),
        ],
      ),
    );
  }

  IconData _getIconData(String name) {
    switch (name) {
      case 'gas': return Icons.local_gas_station_outlined;
      case 'pharmacy': return Icons.local_pharmacy_outlined;
      default: return Icons.shopping_cart_outlined;
    }
  }

  String _formatDate(DateTime date) {
    return '${_getMonthName(date.month)} ${date.day}';
  }

  String _getMonthName(int month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
  }

  Widget _buildTopChip(String amount, bool isBest, {bool isBlue = false}) {
    Color textColor = AppTheme.textDark;
    Color bgColor = Colors.white;
    Color borderColor = Colors.grey.shade300;

    if (isBest) {
      textColor = AppTheme.savingsGreen;
      borderColor = AppTheme.savingsGreen.withValues(alpha: 0.5);
    } else if (isBlue) {
      bgColor = const Color(0xFFE8F0FE);
      borderColor = Colors.transparent;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor),
      ),
      child: Text(amount, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18, color: textColor)),
    );
  }

  Widget _buildHistoryItem(IconData icon, Color iconBg, Color iconColor, String title, String subtitle, String amount) {
    return InkWell(
      onTap: () {},
      borderRadius: BorderRadius.circular(12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.textDark)),
                const SizedBox(height: 4),
                Text(subtitle, style: GoogleFonts.outfit(color: Colors.grey, fontSize: 13)),
              ],
            ),
          ),
          Text(amount, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.savingsGreen)),
        ],
      ),
    );
  }
}

