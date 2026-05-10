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
    return Image.asset(
      'images/logo.jpg',
      height: iconSize * 3.4,
      width: iconSize * 10,
      fit: BoxFit.contain,
      errorBuilder: (context, error, stackTrace) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.shopping_cart, color: AppTheme.primaryBlue, size: iconSize),
          if (!compact) ...[
            const SizedBox(width: 8),
            Text('ShopSave', style: GoogleFonts.outfit(fontSize: textSize, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
          ],
        ],
      ),
    );
  }
}
