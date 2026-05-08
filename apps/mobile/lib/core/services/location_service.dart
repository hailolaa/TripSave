import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';

class LocationService {
  /// Default coordinates (Dallas, TX) to use as fallback.
  static const double defaultLat = 32.776664;
  static const double defaultLng = -96.796987;

  Position? _currentPosition;
  String? _currentCity;
  
  // Keep real-device location enabled by default in production builds.
  bool useMockLocation = false;

  Position? get currentPosition => _currentPosition;
  String? get currentCity => _currentCity;

  Future<Position> getCurrentLocation() async {
    if (useMockLocation) {
      return _getFallbackPosition();
    }
    bool serviceEnabled;
    LocationPermission permission;

    // Test if location services are enabled.
    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return _getFallbackPosition();
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return _getFallbackPosition();
      }
    }
    
    if (permission == LocationPermission.deniedForever) {
      return _getFallbackPosition();
    } 

    try {
      _currentPosition = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      
      // Try to get city name
      try {
        List<Placemark> placemarks = await placemarkFromCoordinates(
          _currentPosition!.latitude, 
          _currentPosition!.longitude
        );
        if (placemarks.isNotEmpty) {
          Placemark place = placemarks[0];
          _currentCity = "${place.locality}, ${place.administrativeArea}";
        }
      } catch (e) {
        _currentCity = "Dallas, TX";
      }
      
      return _currentPosition!;
    } catch (e) {
      return _getFallbackPosition();
    }
  }

  Future<String> getLocationName() async {
    if (_currentCity != null) return _currentCity!;
    await getCurrentLocation();
    return _currentCity ?? "Dallas, TX";
  }

  Position _getFallbackPosition() {
    _currentCity = "Dallas, TX";
    return Position(
      latitude: defaultLat,
      longitude: defaultLng,
      timestamp: DateTime.now(),
      accuracy: 0,
      altitude: 0,
      heading: 0,
      speed: 0,
      speedAccuracy: 0,
      altitudeAccuracy: 0,
      headingAccuracy: 0,
    );
  }
}
