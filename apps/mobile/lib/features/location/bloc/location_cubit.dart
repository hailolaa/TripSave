import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:geolocator/geolocator.dart';
import '../../../core/services/location_service.dart';

abstract class LocationState extends Equatable {
  @override
  List<Object?> get props => [];
}

class LocationInitial extends LocationState {}
class LocationLoading extends LocationState {}
class LocationLoaded extends LocationState {
  final double lat;
  final double lng;
  final String cityName;
  final bool isOverridden;

  LocationLoaded({
    required this.lat,
    required this.lng,
    required this.cityName,
    this.isOverridden = false,
  });

  @override
  List<Object?> get props => [lat, lng, cityName, isOverridden];
}
class LocationError extends LocationState {
  final String message;
  LocationError(this.message);
  @override
  List<Object?> get props => [message];
}

class LocationCubit extends Cubit<LocationState> {
  final LocationService locationService;

  LocationCubit(this.locationService) : super(LocationInitial());

  Future<void> init() async {
    emit(LocationLoading());
    try {
      final position = await locationService.getCurrentLocation();
      final name = await locationService.getLocationName();
      emit(LocationLoaded(
        lat: position.latitude,
        lng: position.longitude,
        cityName: name,
        isOverridden: locationService.isOverridden,
      ));
    } catch (e) {
      emit(LocationError('Failed to detect location. Using Dallas, TX as fallback.'));
      // Fallback to Dallas
      emit(LocationLoaded(
        lat: 32.776664,
        lng: -96.796987,
        cityName: 'Dallas, TX',
      ));
    }
  }

  void updateLocation(String cityName, {double? lat, double? lng}) {
    locationService.setLocation(cityName, lat: lat, lng: lng);
    final pos = locationService.currentPosition;
    if (pos != null) {
      emit(LocationLoaded(
        lat: pos.latitude,
        lng: pos.longitude,
        cityName: cityName,
        isOverridden: true,
      ));
    }
  }

  Future<void> resetToAuto() async {
    locationService.resetToAutoDetected();
    await init();
  }
}
