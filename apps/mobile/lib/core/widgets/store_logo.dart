import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../../core/theme/app_theme.dart';

class StoreLogo extends StatelessWidget {
  final Map<String, dynamic>? chain;
  final double size;
  final double padding;
  final bool showBorder;

  const StoreLogo({
    super.key,
    required this.chain,
    this.size = 40,
    this.padding = 8,
    this.showBorder = true,
  });

  @override
  Widget build(BuildContext context) {
    if (chain == null) {
      return _buildFallback();
    }

    final slug = chain!['slug']?.toString().toLowerCase();
    final logoUrl = chain!['logo_url']?.toString();
    final type = chain!['type']?.toString().toLowerCase();

    // 1. Try Local Asset (SVG)
    final assetPath = 'assets/logos/$slug.svg';
    
    return Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(padding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(size * 0.25),
        border: showBorder ? Border.all(color: Colors.grey.shade100, width: 1.5) : null,
        boxShadow: showBorder ? [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ] : null,
      ),
      child: Center(
        child: _buildLogoContent(assetPath, logoUrl, type),
      ),
    );
  }

  Widget _buildLogoContent(String assetPath, String? logoUrl, String? type) {
    // Note: We can't easily check for asset existence synchronously in build
    // but flutter_svg handles errors gracefully if we provide a placeholder.
    
    // For now, we'll implement the logic to check for a small list of known assets
    final knownAssets = ['walmart', 'target', 'kroger', 'heb', 'aldi', 'costco', 'shell', 'exxon'];
    final slug = assetPath.split('/').last.replaceAll('.svg', '');

    if (knownAssets.contains(slug)) {
      return SvgPicture.asset(
        assetPath,
        width: size - (padding * 2),
        height: size - (padding * 2),
        fit: BoxFit.contain,
        placeholderBuilder: (context) => _buildRemoteOrFallback(logoUrl, type),
      );
    }

    return _buildRemoteOrFallback(logoUrl, type);
  }

  Widget _buildRemoteOrFallback(String? logoUrl, String? type) {
    // If we have a URL from the backend, use it
    if (logoUrl != null && logoUrl.isNotEmpty) {
      return _buildCachedImage(logoUrl, type);
    }

    // NEW: Client-side "guess" based on store name if logo_url is missing
    final name = chain!['name']?.toString().toLowerCase() ?? '';
    final guessedUrl = _guessLogoUrl(name);
    if (guessedUrl != null) {
      return _buildCachedImage(guessedUrl, type);
    }

    return _buildTypeIcon(type);
  }

  Widget _buildCachedImage(String url, String? type) {
    return CachedNetworkImage(
      imageUrl: url,
      width: size - (padding * 2),
      height: size - (padding * 2),
      fit: BoxFit.contain,
      placeholder: (context, url) => _buildTypeIcon(type),
      errorWidget: (context, url, error) => _buildTypeIcon(type),
    );
  }

  String? _guessLogoUrl(String name) {
    if (name.contains('walmart')) return 'https://logo.clearbit.com/walmart.com';
    if (name.contains('target')) return 'https://logo.clearbit.com/target.com';
    if (name.contains('aldi')) return 'https://logo.clearbit.com/aldi.us';
    if (name.contains('costco')) return 'https://logo.clearbit.com/costco.com';
    if (name.contains('kroger')) return 'https://logo.clearbit.com/kroger.com';
    if (name.contains('whole foods')) return 'https://logo.clearbit.com/wholefoodsmarket.com';
    if (name.contains('publix')) return 'https://logo.clearbit.com/publix.com';
    if (name.contains('heb') || name.contains('h-e-b')) return 'https://logo.clearbit.com/heb.com';
    if (name.contains('cvs')) return 'https://logo.clearbit.com/cvs.com';
    if (name.contains('walgreens')) return 'https://logo.clearbit.com/walgreens.com';
    if (name.contains('shell')) return 'https://logo.clearbit.com/shell.com';
    if (name.contains('exxon')) return 'https://logo.clearbit.com/exxon.com';
    if (name.contains('7-eleven')) return 'https://logo.clearbit.com/7-eleven.com';
    return null;
  }

  Widget _buildTypeIcon(String? type) {
    IconData icon;
    Color color;

    switch (type) {
      case 'gas':
        icon = Icons.local_gas_station_outlined;
        color = const Color(0xFF2563EB);
        break;
      case 'pharmacy':
        icon = Icons.local_pharmacy_outlined;
        color = const Color(0xFF6A3CE2);
        break;
      case 'grocery':
      default:
        icon = Icons.shopping_basket_outlined;
        color = AppTheme.primaryBlue;
        break;
    }

    return Icon(icon, color: color, size: size * 0.5);
  }

  Widget _buildFallback() {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFFF8F9FA),
        borderRadius: BorderRadius.circular(size * 0.25),
      ),
      child: Icon(Icons.store, color: Colors.grey.shade400, size: size * 0.5),
    );
  }
}
