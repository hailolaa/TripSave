import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';

class LocationService {
  /// Default coordinates (Dallas, TX) to use as fallback.
  static const double defaultLat = 32.776664;
  static const double defaultLng = -96.796987;

  Position? _currentPosition;
  String? _currentCity;
  
  /// User-overridden location (from home screen dropdown).
  String? _overriddenCity;
  Position? _overriddenPosition;
  
  // Keep real-device location enabled by default in production builds.
  bool useMockLocation = false;

  /// Listeners that get called when location changes.
  final List<void Function(String)> _listeners = [];

  Position? get currentPosition => _overriddenPosition ?? _currentPosition;
  String? get currentCity => _overriddenCity ?? _currentCity;

  /// Whether the user has manually overridden the location.
  bool get isOverridden => _overriddenCity != null;

  void addListener(void Function(String) listener) {
    _listeners.add(listener);
  }

  void removeListener(void Function(String) listener) {
    _listeners.remove(listener);
  }

  void _notifyListeners(String city) {
    for (final listener in _listeners) {
      listener(city);
    }
  }

  /// Override the current location with a custom city name and coordinates.
  void setLocation(String cityName, {double? lat, double? lng}) {
    _overriddenCity = cityName;
    if (lat != null && lng != null) {
      _overriddenPosition = Position(
        latitude: lat,
        longitude: lng,
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
    _notifyListeners(cityName);
  }

  /// Reset to auto-detected location.
  void resetToAutoDetected() {
    _overriddenCity = null;
    _overriddenPosition = null;
    final city = _currentCity ?? 'Dallas, TX';
    _notifyListeners(city);
  }

  Future<Position> getCurrentLocation() async {
    // If user has overridden, return that
    if (_overriddenPosition != null) {
      return _overriddenPosition!;
    }

    if (useMockLocation) {
      return _getFallbackPosition();
    }

    try {
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
          // Handle cases where locality is empty but subAdministrativeArea exists
          String city = place.locality ?? place.subAdministrativeArea ?? '';
          String state = place.administrativeArea ?? '';
          if (city.isNotEmpty && state.isNotEmpty) {
             _currentCity = "$city, $state";
          } else if (city.isNotEmpty) {
             _currentCity = city;
          } else {
             _currentCity = place.country ?? "Dallas, TX";
          }
        }
      } catch (e) {
        // If geocoding fails but we have GPS, we just leave it or fetch it later
        _currentCity = "Dallas, TX";
      }
      
      return _currentPosition!;
    } catch (e) {
      // If GPS throws an error (very common on Desktop platforms), fallback to Dallas
      return _getFallbackPosition();
    }
  }

  Future<String> getLocationName() async {
    if (_overriddenCity != null) return _overriddenCity!;
    if (_currentCity != null) return _currentCity!;
    await getCurrentLocation();
    return _currentCity ?? "Dallas, TX";
  }

  /// Get the auto-detected city (ignoring any override).
  String get autoDetectedCity => _currentCity ?? "Dallas, TX";

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
