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
    if (_isPlaceholderImageUrl(raw) || _isOldCategoryFallbackUrl(raw)) {
      return '';
    }
    if (raw.startsWith('//')) return 'https:$raw';
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
      return raw;
    }
    return '';
  }

  String get _fallbackImageUrl {
    final lowerName = name.toLowerCase();
    final lowerCategory = category?.toLowerCase().trim() ?? '';

    const fallbackPhotos = <String, String>{
      'produce': 'https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg?auto=compress&cs=tinysrgb&w=400',
      'meat': 'https://images.pexels.com/photos/65175/pexels-photo-65175.jpeg?auto=compress&cs=tinysrgb&w=400',
      'dairy': 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg?auto=compress&cs=tinysrgb&w=400',
      'bakery': 'https://images.pexels.com/photos/209206/pexels-photo-209206.jpeg?auto=compress&cs=tinysrgb&w=400',
      'beverages': 'https://images.pexels.com/photos/416528/pexels-photo-416528.jpeg?auto=compress&cs=tinysrgb&w=400',
      'snacks': 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=400',
      'medicine': 'https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&cs=tinysrgb&w=400',
      'cleaning': 'https://images.pexels.com/photos/4239146/pexels-photo-4239146.jpeg?auto=compress&cs=tinysrgb&w=400',
      'pet': 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=400',
      'baby': 'https://images.pexels.com/photos/3662667/pexels-photo-3662667.jpeg?auto=compress&cs=tinysrgb&w=400',
      'personal_care': 'https://images.pexels.com/photos/3737594/pexels-photo-3737594.jpeg?auto=compress&cs=tinysrgb&w=400',
      'household': 'https://images.pexels.com/photos/4108715/pexels-photo-4108715.jpeg?auto=compress&cs=tinysrgb&w=400',
      'gas': 'https://images.pexels.com/photos/9796/car-refill-transportation-transport.jpg?auto=compress&cs=tinysrgb&w=400',
      'canned': 'https://images.pexels.com/photos/4033639/pexels-photo-4033639.jpeg?auto=compress&cs=tinysrgb&w=400',
      'condiments': 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=400',
      'frozen': 'https://images.pexels.com/photos/1352278/pexels-photo-1352278.jpeg?auto=compress&cs=tinysrgb&w=400',
      'other': 'https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=400',
    };

    if (lowerName.contains('egg')) {
      return 'https://images.pexels.com/photos/162712/pexels-photo-162712.jpeg?auto=compress&cs=tinysrgb&w=400';
    }
    if (lowerName.contains('rice')) {
      return 'https://images.pexels.com/photos/4110251/pexels-photo-4110251.jpeg?auto=compress&cs=tinysrgb&w=400';
    }
    if (lowerName.contains('pasta') ||
        lowerName.contains('spaghetti') ||
        lowerName.contains('macaroni') ||
        lowerName.contains('noodle')) {
      return 'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=400';
    }
    if (lowerName.contains('juice')) {
      return fallbackPhotos['beverages']!;
    }
    if (lowerName.contains('milk') ||
        lowerName.contains('cheese') ||
        lowerName.contains('yogurt') ||
        lowerName.contains('butter')) {
      return fallbackPhotos['dairy']!;
    }
    if (lowerName.contains('bread') || lowerName.contains('bagel') || lowerName.contains('cake')) {
      return fallbackPhotos['bakery']!;
    }
    if (lowerName.contains('water') || lowerName.contains('soda') || lowerName.contains('beverage')) {
      return fallbackPhotos['beverages']!;
    }
    if (lowerName.contains('chip') ||
        lowerName.contains('cookie') ||
        lowerName.contains('candy') ||
        lowerName.contains('chocolate')) {
      return fallbackPhotos['snacks']!;
    }

    if (fallbackPhotos.containsKey(lowerCategory)) {
      return fallbackPhotos[lowerCategory]!;
    }

    return fallbackPhotos['other']!;
  }

  bool _isPlaceholderImageUrl(String url) {
    final lowerUrl = url.toLowerCase().trim();
    if (lowerUrl.isEmpty) return false;

    const blockedHostsAndTerms = [
      'placehold.co',
      'placeholder.com',
      'via.placeholder',
      'dummyimage.com',
      'fakeimg.pl',
      'image-not-available',
      'image-not-found',
      'image not found',
      'image%20not%20found',
      'no-image',
      'no_image',
      'default-product',
      'default_product',
    ];

    if (blockedHostsAndTerms.any(lowerUrl.contains)) return true;

    final hasRenderedText = lowerUrl.contains('text=') || lowerUrl.contains('/text/');
    final isGeneratedImage = lowerUrl.contains('placeholder') || lowerUrl.contains('dummy');
    return hasRenderedText && isGeneratedImage;
  }

  bool _isOldCategoryFallbackUrl(String url) {
    final lowerUrl = url.toLowerCase().trim();
    if (lowerUrl.isEmpty) return false;

    const oldFallbackPhotoIds = [
      '1610348725531-843dff563e2c',
      '1607623814075-e51df1bdc82f',
      '1550583724-125581f77833',
      '1509440159596-0249088772ff',
      '1622483767028-3f66f32aef97',
      '1599490659213-e2b9527bb087',
      '1584308666744-24d5c474f2ae',
      '1584622650111-993a426fbf0a',
      '1583511655857-d19b40a7a54e',
      '1515488764276-beab7607c1e6',
      '1570172619644-dfd03ed5d881',
      '1528740561666-dc2479bd08bc',
      '1614732414444-096e5f1122d5',
      '1534483509719-3feaee7c30da',
      '1607604668248-f0143ad3964f',
      '1547592166-23ac45744acd',
      '1582722872445-44dc5f7e3c8f',
      '1536304993881-ff6e9eefa2a6',
      '1600271886742-f049cd451bba',
      '1551462147-ff29053bfc14',
      '1542838132-92c53300491e',
    ];

    return lowerUrl.contains('images.unsplash.com') &&
        oldFallbackPhotoIds.any(lowerUrl.contains);
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
    return CachedNetworkImage(
      imageUrl: fallbackUrl,
      width: size,
      height: size,
      fit: fit,
      placeholder: (context, url) => _iconFallback(),
      errorWidget: (context, url, error) => _iconFallback(),
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
