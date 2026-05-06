import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';

class CompareMapView extends StatelessWidget {
  final List<dynamic> results;
  final LatLng userLocation;
  final Function(Map<String, dynamic>) onStoreTap;

  const CompareMapView({
    super.key,
    required this.results,
    required this.userLocation,
    required this.onStoreTap,
  });

  @override
  Widget build(BuildContext context) {
    return FlutterMap(
      options: MapOptions(
        initialCenter: userLocation,
        initialZoom: 13.0,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.tripsave.app',
        ),
        MarkerLayer(
          markers: [
            // User Location Marker
            Marker(
              point: userLocation,
              width: 40,
              height: 40,
              child: Container(
                decoration: BoxDecoration(
                  color: AppTheme.primaryBlue.withOpacity(0.2),
                  shape: BoxShape.circle,
                  border: Border.all(color: AppTheme.primaryBlue, width: 2),
                ),
                child: const Center(
                  child: Icon(Icons.person_pin_circle, color: AppTheme.primaryBlue, size: 24),
                ),
              ),
            ),
            // Store Markers
            ...results.asMap().entries.map((entry) {
              final index = entry.key;
              final result = entry.value;
              final store = result['store'];
              final isCheapest = index == 0; // Results are sorted by backend
              
              final lat = double.tryParse(store['lat'].toString()) ?? 0;
              final lng = double.tryParse(store['lng'].toString()) ?? 0;

              // Skip invalid coordinates
              if (lat == 0 && lng == 0) return Marker(point: const LatLng(0, 0), child: const SizedBox());

              return Marker(
                point: LatLng(lat, lng),
                width: 140,
                height: 90,
                child: GestureDetector(
                  onTap: () => onStoreTap(result),
                  child: _buildStoreMarker(result, isCheapest),
                ),
              );
            }),
          ],
        ),
      ],
    );
  }

  Widget _buildStoreMarker(Map<String, dynamic> result, bool isCheapest) {
    final store = result['store'];
    final chain = store['chain'];
    final isGas = chain['type'] == 'gas';
    final primaryColor = isGas ? const Color(0xFF2563EB) : AppTheme.savingsGreen;
    final markerIcon = isGas ? Icons.local_gas_station : Icons.shopping_basket_outlined;

    return Column(
      children: [
        if (isCheapest)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            margin: const EdgeInsets.only(bottom: 2),
            decoration: BoxDecoration(
              color: AppTheme.primaryBlue,
              borderRadius: BorderRadius.circular(8),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 4)],
            ),
            child: const Text(
              'BEST VALUE',
              style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
            ),
          ),
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 6, spreadRadius: 1),
            ],
            border: Border.all(color: isCheapest ? AppTheme.primaryBlue : primaryColor.withOpacity(0.3), width: 1.5),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: primaryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(markerIcon, size: 14, color: primaryColor),
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      store['name'],
                      style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 10),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '\$${result['true_cost'] ?? '0.00'}',
                          style: TextStyle(
                            color: isCheapest ? AppTheme.primaryBlue : AppTheme.textDark,
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${result['driving_distance'] ?? '0'} mi',
                          style: const TextStyle(color: Colors.grey, fontSize: 9, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        // Pin tip
        Icon(Icons.arrow_drop_down, color: isCheapest ? AppTheme.primaryBlue : primaryColor.withOpacity(0.5), size: 16),
      ],
    );
  }
}
