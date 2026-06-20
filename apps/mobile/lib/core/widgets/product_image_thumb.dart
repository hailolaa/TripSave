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

  String get _fallbackImageUrl {
    final lowerName = name.toLowerCase();
    final lowerCategory = category?.toLowerCase().trim() ?? '';

    const categoryImages = <String, String>{
      'produce': 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&q=80&w=400',
      'meat': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&q=80&w=400',
      'dairy': 'https://images.unsplash.com/photo-1550583724-125581f77833?auto=format&fit=crop&q=80&w=400',
      'bakery': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400',
      'beverages': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400',
      'snacks': 'https://images.unsplash.com/photo-1599490659213-e2b9527bb087?auto=format&fit=crop&q=80&w=400',
      'medicine': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400',
      'cleaning': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400',
      'pet': 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=400',
      'baby': 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?auto=format&fit=crop&q=80&w=400',
      'personal_care': 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=400',
      'household': 'https://images.unsplash.com/photo-1528740561666-dc2479bd08bc?auto=format&fit=crop&q=80&w=400',
      'gas': 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?auto=format&fit=crop&q=80&w=400',
      'canned': 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&q=80&w=400',
      'condiments': 'https://images.unsplash.com/photo-1607604668248-f0143ad3964f?auto=format&fit=crop&q=80&w=400',
      'frozen': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=400',
      'other': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
    };

    if (lowerName.contains('egg')) {
      return 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&q=80&w=400';
    }
    if (lowerName.contains('rice')) {
      return 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&q=80&w=400';
    }
    if (lowerName.contains('pasta') ||
        lowerName.contains('spaghetti') ||
        lowerName.contains('macaroni') ||
        lowerName.contains('noodle')) {
      return 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&q=80&w=400';
    }
    if (lowerName.contains('juice')) {
      return 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&q=80&w=400';
    }
    if (lowerName.contains('milk') ||
        lowerName.contains('cheese') ||
        lowerName.contains('yogurt') ||
        lowerName.contains('butter')) {
      return categoryImages['dairy']!;
    }
    if (lowerName.contains('bread') || lowerName.contains('bagel') || lowerName.contains('cake')) {
      return categoryImages['bakery']!;
    }
    if (lowerName.contains('water') || lowerName.contains('soda') || lowerName.contains('beverage')) {
      return categoryImages['beverages']!;
    }
    if (lowerName.contains('chip') ||
        lowerName.contains('cookie') ||
        lowerName.contains('candy') ||
        lowerName.contains('chocolate')) {
      return categoryImages['snacks']!;
    }

    if (categoryImages.containsKey(lowerCategory)) {
      return categoryImages[lowerCategory]!;
    }

    return categoryImages['other']!;
  }

  @override
  Widget build(BuildContext context) {
    final normalizedUrl = _normalizedImageUrl;
    final fallbackUrl = _fallbackImageUrl;

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
              placeholder: (context, url) => _iconFallback(),
              errorWidget: (context, url, error) => _fallbackImage(fallbackUrl),
            )
          : _fallbackImage(fallbackUrl),
    );
  }

  Widget _fallbackImage(String fallbackUrl) {
    return Image.network(
      fallbackUrl,
      width: size,
      height: size,
      fit: fit,
      errorBuilder: (context, error, stackTrace) => _iconFallback(),
    );
  }

  Widget _iconFallback() {
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
