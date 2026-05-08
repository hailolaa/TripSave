import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../theme/app_theme.dart';

class ShopSaveLogo extends StatelessWidget {
  const ShopSaveLogo({
    super.key,
    this.textSize = 18,
    this.iconSize = 28,
    this.compact = false,
  });

  final double textSize;
  final double iconSize;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: iconSize,
          height: iconSize,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF2B77F3), Color(0xFF2063E8)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(iconSize * 0.34),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primaryBlue.withValues(alpha: 0.24),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(
                Icons.shopping_bag_outlined,
                color: Colors.white,
                size: iconSize * 0.56,
              ),
              Positioned(
                right: iconSize * 0.15,
                top: iconSize * 0.14,
                child: Container(
                  width: iconSize * 0.18,
                  height: iconSize * 0.18,
                  decoration: const BoxDecoration(
                    color: AppTheme.savingsGreen,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(width: compact ? 6 : 8),
        Text(
          'ShopSave',
          style: GoogleFonts.outfit(
            color: AppTheme.primaryBlue,
            fontWeight: FontWeight.w800,
            fontSize: textSize,
            letterSpacing: -0.4,
          ),
        ),
      ],
    );
  }
}
