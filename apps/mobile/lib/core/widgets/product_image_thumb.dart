import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class ProductImageThumb extends StatelessWidget {
  const ProductImageThumb({
    super.key,
    required this.name,
    this.imageUrl,
    this.category,
    this.size = 50,
    this.borderRadius = 12,
    this.fit = BoxFit.contain,
  });

  final String name;
  final String? imageUrl;
  final String? category;
  final double size;
  final double borderRadius;
  final BoxFit fit;

  String get _normalizedImageUrl {
    final raw = imageUrl?.trim() ?? '';
    if (raw.startsWith('//')) return 'https:$raw';
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
      return raw;
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final normalizedUrl = _normalizedImageUrl;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: Colors.grey.shade200),
      ),
      alignment: Alignment.center,
      clipBehavior: Clip.antiAlias,
      child: normalizedUrl.isNotEmpty
          ? CachedNetworkImage(
              imageUrl: normalizedUrl,
              width: size,
              height: size,
              fit: fit,
              placeholder: (context, url) => _fallback(),
              errorWidget: (context, url, error) => _fallback(),
            )
          : _fallback(),
    );
  }

  Widget _fallback() {
    final fallbackIcon = _fallbackIcon();
    final initial = name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : '';

    if (initial.isNotEmpty && fallbackIcon == Icons.shopping_basket_rounded) {
      return Center(
        child: Text(
          initial,
          style: TextStyle(
            color: AppTheme.primaryBlue.withValues(alpha: 0.85),
            fontWeight: FontWeight.w800,
            fontSize: size * 0.34,
          ),
        ),
      );
    }

    return Center(
      child: Icon(
        fallbackIcon,
        color: AppTheme.primaryBlue.withValues(alpha: 0.45),
        size: size * 0.42,
      ),
    );
  }

  IconData _fallbackIcon() {
    final lowerName = name.toLowerCase();
    final lowerCategory = category?.toLowerCase() ?? '';

    if (lowerCategory.contains('medicine') ||
        lowerCategory.contains('pharmacy') ||
        lowerName.contains('med') ||
        lowerName.contains('pill') ||
        lowerName.contains('drug') ||
        lowerName.contains('vitamin')) {
      return Icons.medication_rounded;
    }

    if (lowerCategory.contains('clean') ||
        lowerCategory.contains('house') ||
        lowerName.contains('soap') ||
        lowerName.contains('wash') ||
        lowerName.contains('detergent')) {
      return Icons.inventory_2_rounded;
    }

    return Icons.shopping_basket_rounded;
  }
}
