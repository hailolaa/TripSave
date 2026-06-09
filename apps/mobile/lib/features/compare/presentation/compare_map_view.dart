import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/routing_service.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/widgets/store_logo.dart';

class CompareMapView extends StatefulWidget {
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
  State<CompareMapView> createState() => _CompareMapViewState();
}

class _CompareMapViewState extends State<CompareMapView> with TickerProviderStateMixin {
  final MapController _mapController = MapController();
  List<LatLng> _routePoints = [];
  int? _selectedStoreIndex;
  bool _isLoadingRoute = false;
  RouteResult? _currentRoute;

  @override
  void initState() {
    super.initState();
    // Auto-select the best store (index 0) and show its route
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.results.isNotEmpty) {
        _selectStore(0);
      }
    });
  }

  Future<void> _selectStore(int index) async {
    final result = widget.results[index];
    final store = result['store'];
    final lat = double.tryParse(store['lat'].toString()) ?? 0;
    final lng = double.tryParse(store['lng'].toString()) ?? 0;

    if (lat == 0 && lng == 0) return;

    setState(() {
      _selectedStoreIndex = index;
      _isLoadingRoute = true;
    });

    final route = await RoutingService.getRoute(
      widget.userLocation,
      LatLng(lat, lng),
    );

    if (mounted) {
      setState(() {
        _isLoadingRoute = false;
        _currentRoute = route;
        _routePoints = route?.points ?? [];
      });

      // Fit the map to show the entire route
      if (_routePoints.isNotEmpty) {
        final bounds = LatLngBounds.fromPoints([
          widget.userLocation,
          LatLng(lat, lng),
          ..._routePoints,
        ]);
        _mapController.fitCamera(
          CameraFit.bounds(
            bounds: bounds,
            padding: const EdgeInsets.all(60),
          ),
        );
      }
    }
  }

  Future<void> _launchNavigation(Map<String, dynamic> result) async {
    final store = result['store'];
    final lat = double.tryParse(store['lat'].toString()) ?? 0;
    final lng = double.tryParse(store['lng'].toString()) ?? 0;

    if (lat == 0 && lng == 0) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Start Navigation?', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text('PricePilot will take you to ${store['name']}. Confirm to start route in your maps app.', 
          style: GoogleFonts.outfit()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: TextStyle(color: Colors.grey.shade600)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryBlue,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final googleMapsUrl = Uri.parse('google.navigation:q=$lat,$lng');
      final appleMapsUrl = Uri.parse('http://maps.apple.com/?daddr=$lat,$lng');

      if (await canLaunchUrl(googleMapsUrl)) {
        await launchUrl(googleMapsUrl);
      } else if (await canLaunchUrl(appleMapsUrl)) {
        await launchUrl(appleMapsUrl);
      } else {
        final browserUrl = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');
        await launchUrl(browserUrl);
      }
      
      // Also trigger the parent callback if needed (e.g. to save trip in DB)
      widget.onStoreTap(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Map
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: widget.userLocation,
            initialZoom: 13.0,
          ),
          children: [
            // Map tiles
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.tripsave.app',
            ),

            // Route polyline
            if (_routePoints.isNotEmpty)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: _routePoints,
                    color: AppTheme.primaryBlue,
                    strokeWidth: 5.0,
                    borderColor: AppTheme.primaryBlue.withValues(alpha: 0.3),
                    borderStrokeWidth: 2.0,
                  ),
                ],
              ),

            // Markers
            MarkerLayer(
              markers: [
                // User Location Marker
                Marker(
                  point: widget.userLocation,
                  width: 48,
                  height: 48,
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppTheme.primaryBlue.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                      border: Border.all(color: AppTheme.primaryBlue, width: 3),
                    ),
                    child: const Center(
                      child: Icon(Icons.my_location, color: AppTheme.primaryBlue, size: 22),
                    ),
                  ),
                ),
                // Store Markers
                ...widget.results.asMap().entries.map((entry) {
                  final index = entry.key;
                  final result = entry.value;
                  final store = result['store'];
                  final isSelected = index == _selectedStoreIndex;
                  final isCheapest = index == 0;

                  final lat = double.tryParse(store['lat'].toString()) ?? 0;
                  final lng = double.tryParse(store['lng'].toString()) ?? 0;

                  if (lat == 0 && lng == 0) return null;

                  return Marker(
                    point: LatLng(lat, lng),
                    width: isSelected ? 160 : 140,
                    height: isSelected ? 100 : 90,
                    child: GestureDetector(
                      onTap: () {
                        _selectStore(index);
                        widget.onStoreTap(result);
                      },
                      child: _buildStoreMarker(result, index, isCheapest, isSelected),
                    ),
                  );
                }).whereType<Marker>(),
              ],
            ),
          ],
        ),

        // Route info card (bottom)
        if (_currentRoute != null && _selectedStoreIndex != null)
          Positioned(
            bottom: 16,
            left: 16,
            right: 16,
            child: _buildRouteInfoCard(),
          ),

        // Loading indicator
        if (_isLoadingRoute)
          Positioned(
            top: 16,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 8),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primaryBlue),
                    ),
                    const SizedBox(width: 8),
                    Text('Finding route...', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildStoreMarker(Map<String, dynamic> result, int index, bool isCheapest, bool isSelected) {
    final store = result['store'];
    final chain = store['chain'];
    final isGas = chain?['type'] == 'gas';
    final primaryColor = isSelected
        ? AppTheme.primaryBlue
        : isCheapest
            ? AppTheme.savingsGreen
            : (isGas ? const Color(0xFF2563EB) : AppTheme.savingsGreen);

    final oneWayDistance = ((double.tryParse(result['driving_distance'].toString()) ?? 0) / 2).toStringAsFixed(1);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (isCheapest && !isSelected)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            margin: const EdgeInsets.only(bottom: 2),
            decoration: BoxDecoration(
              color: AppTheme.savingsGreen,
              borderRadius: BorderRadius.circular(8),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 4)],
            ),
            child: Text(
              'BEST VALUE',
              style: GoogleFonts.outfit(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
            ),
          ),
        if (isSelected)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            margin: const EdgeInsets.only(bottom: 2),
            decoration: BoxDecoration(
              color: AppTheme.primaryBlue,
              borderRadius: BorderRadius.circular(8),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 4)],
            ),
            child: Text(
              'ROUTE',
              style: GoogleFonts.outfit(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
            ),
          ),
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.primaryBlue.withValues(alpha: 0.05) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: isSelected
                    ? AppTheme.primaryBlue.withValues(alpha: 0.3)
                    : Colors.black.withValues(alpha: 0.15),
                blurRadius: isSelected ? 10 : 6,
                spreadRadius: isSelected ? 2 : 1,
              ),
            ],
            border: Border.all(
              color: isSelected ? AppTheme.primaryBlue : primaryColor.withValues(alpha: 0.3),
              width: isSelected ? 2.5 : 1.5,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Store Logo
              SizedBox(
                width: 28,
                height: 28,
                child: StoreLogo(chain: chain, size: 28, padding: 2),
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      store['name'] ?? '',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 10),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                    Text(
                      isGas
                          ? '\$${result['price_per_gallon'] ?? (result['products'] != null && result['products'] is List && (result['products'] as List).isNotEmpty ? result['products'][0]['price'] : '0.00')}/g'
                          : '\$${result['item_total'] ?? '0.00'}',
                      style: TextStyle(
                        color: isSelected ? AppTheme.primaryBlue : AppTheme.textDark,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                        const SizedBox(width: 4),
                        Text(
                          '$oneWayDistance mi',
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
        Icon(
          Icons.arrow_drop_down,
          color: isSelected ? AppTheme.primaryBlue : primaryColor.withValues(alpha: 0.5),
          size: 16,
        ),
      ],
    );
  }

  Widget _buildRouteInfoCard() {
    final result = widget.results[_selectedStoreIndex!];
    final store = result['store'];
    final chain = store['chain'];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 12, spreadRadius: 2),
        ],
      ),
      child: Row(
        children: [
          // Store logo
          StoreLogo(chain: chain, size: 48, padding: 8),
          const SizedBox(width: 12),
          // Store info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  store['name'] ?? '',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.directions_car, size: 14, color: Colors.grey.shade600),
                    const SizedBox(width: 4),
                    Text(
                      _currentRoute!.distanceText,
                      style: GoogleFonts.outfit(fontSize: 13, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(width: 12),
                    Icon(Icons.access_time, size: 14, color: Colors.grey.shade600),
                    const SizedBox(width: 4),
                    Text(
                      _currentRoute!.durationText,
                      style: GoogleFonts.outfit(fontSize: 13, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Navigate button
          Container(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppTheme.primaryBlue, Color(0xFF1E40AF)],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => _launchNavigation(result),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.navigation, color: Colors.white, size: 16),
                      const SizedBox(width: 4),
                      Text('Go', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
