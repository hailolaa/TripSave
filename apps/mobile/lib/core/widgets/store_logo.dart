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
    // 1. Prioritize Remote Logo from DB if it exists and is NOT a fallback
    // (This ensures our new database branding is always used)
    if (logoUrl != null && logoUrl.isNotEmpty && !logoUrl.contains('gasbuddy.com') && !logoUrl.contains('instacart.com')) {
      return _buildCachedImage(logoUrl, type);
    }

    // 2. Fallback to Local Asset (SVG) for known brands
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
    const token = 'pk_UUfT4NowQ-GmCHtVoknvfg'; // Use your Logo.dev token here
    const baseUrl = 'https://img.logo.dev';
    
    String? domain;
    if (name.contains('walmart')) {
      domain = 'walmart.com';
    } else if (name.contains('target')) {
      domain = 'target.com';
    } else if (name.contains('aldi')) {
      domain = 'aldi.us';
    } else if (name.contains('costco')) {
      domain = 'costco.com';
    } else if (name.contains('kroger')) {
      domain = 'kroger.com';
    } else if (name.contains('whole foods')) {
      domain = 'wholefoodsmarket.com';
    } else if (name.contains('publix')) {
      domain = 'publix.com';
    } else if (name.contains('heb') || name.contains('h-e-b')) {
      domain = 'heb.com';
    } else if (name.contains('cvs')) {
      domain = 'cvs.com';
    } else if (name.contains('walgreens')) {
      domain = 'walgreens.com';
    } else if (name.contains('shell')) {
      domain = 'shell.com';
    } else if (name.contains('exxon')) {
      domain = 'exxon.com';
    } else if (name.contains('7-eleven')) {
      domain = '7-eleven.com';
    }
    
    if (domain != null) {
      return '$baseUrl/$domain?token=$token';
    }
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
