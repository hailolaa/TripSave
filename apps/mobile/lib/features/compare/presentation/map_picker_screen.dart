import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/di/injection.dart';
import '../../../core/network/api_client.dart';
import '../../../core/services/location_service.dart';
import '../../../core/theme/app_theme.dart';

class MapPickerScreen extends StatefulWidget {
  const MapPickerScreen({super.key});

  @override
  State<MapPickerScreen> createState() => _MapPickerScreenState();
}

class _MapPickerScreenState extends State<MapPickerScreen> {
  final MapController _mapController = MapController();
  LatLng _selectedPosition = const LatLng(32.7767, -96.7970); // Dallas Default
  List<dynamic> _nearbyStores = [];
  bool _isLoadingStores = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _useCurrentLocation();
    });
  }

  Future<void> _useCurrentLocation() async {
    try {
      final position = await getIt<LocationService>().getCurrentLocation();
      final currentPosition = LatLng(position.latitude, position.longitude);
      if (!mounted) return;
      setState(() {
        _selectedPosition = currentPosition;
      });
      await _fetchNearbyStores(currentPosition);
    } catch (_) {
      await _fetchNearbyStores(_selectedPosition);
    }
  }

  Future<void> _fetchNearbyStores(LatLng center) async {
    setState(() => _isLoadingStores = true);
    try {
      final response = await getIt<ApiClient>().dio.get(
        '/stores',
        queryParameters: {
          'lat': center.latitude,
          'lng': center.longitude,
          'radius': 10,
        },
      );
      if (!mounted) return;
      final stores = response.data is List ? List<dynamic>.from(response.data as List) : <dynamic>[];
      setState(() {
        _nearbyStores = stores.where((item) => _storeLocation(item) != null).toList();
        _isLoadingStores = false;
      });
      _fitMapToStores();
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoadingStores = false);
    }
  }

  LatLng? _storeLocation(dynamic item) {
    final store = item is Map ? item['store'] : null;
    if (store is! Map) return null;
    final lat = double.tryParse(store['lat']?.toString() ?? '');
    final lng = double.tryParse(store['lng']?.toString() ?? '');
    if (lat == null || lng == null) return null;
    if (lat == 0 && lng == 0) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return LatLng(lat, lng);
  }

  void _fitMapToStores() {
    final points = [
      _selectedPosition,
      ..._nearbyStores.map(_storeLocation).whereType<LatLng>(),
    ];

    if (points.length <= 1) {
      _mapController.move(_selectedPosition, 13);
      return;
    }

    _mapController.fitCamera(
      CameraFit.bounds(
        bounds: LatLngBounds.fromPoints(points),
        padding: const EdgeInsets.all(60),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Select Location', style: TextStyle(color: AppTheme.textDark, fontSize: 16)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textDark),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _selectedPosition,
              initialZoom: 13.0,
              onTap: (tapPosition, point) {
                setState(() {
                  _selectedPosition = point;
                });
                _fetchNearbyStores(point);
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.tripsave',
              ),
              MarkerLayer(
                markers: [
                  Marker(
                    point: _selectedPosition,
                    width: 40,
                    height: 40,
                    child: const Icon(Icons.location_on, color: AppTheme.primaryBlue, size: 40),
                  ),
                  ..._nearbyStores.map((item) {
                    final location = _storeLocation(item);
                    final store = item is Map ? item['store'] : null;
                    final name = store is Map ? (store['name']?.toString() ?? '') : '';
                    if (location == null || name.isEmpty) return null;
                    return _buildStorePin(location, name);
                  }).whereType<Marker>(),
                ],
              ),
            ],
          ),
          if (_isLoadingStores)
            Positioned(
              top: 20,
              left: 20,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 8)],
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                    SizedBox(width: 8),
                    Text('Loading nearby stores', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                  ],
                ),
              ),
            ),
          Positioned(
            top: 20,
            right: 20,
            child: FloatingActionButton(
              heroTag: 'my_location',
              backgroundColor: Colors.white,
              mini: true,
              onPressed: _useCurrentLocation,
              child: const Icon(Icons.my_location, color: AppTheme.primaryBlue),
            ),
          ),
          Positioned(
            bottom: 30,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 10, spreadRadius: 1)
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Selected map position', style: TextStyle(color: Colors.grey, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text('${_selectedPosition.latitude.toStringAsFixed(4)}, ${_selectedPosition.longitude.toStringAsFixed(4)}', 
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _useCurrentLocation,
                          icon: const Icon(Icons.my_location, size: 16, color: AppTheme.primaryBlue),
                          label: const Text('Use current', style: TextStyle(color: AppTheme.primaryBlue)),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.grey),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => Navigator.pop(context, _selectedPosition),
                          icon: const Icon(Icons.check, size: 16),
                          label: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primaryBlue,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ],
                  )
                ],
              ),
            ),
          )
        ],
      ),
    );
  }

  Marker _buildStorePin(LatLng position, String name) {
    return Marker(
      point: position,
      width: 80,
      height: 40,
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 4)],
        ),
        child: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 10)),
      ),
    );
  }
}
