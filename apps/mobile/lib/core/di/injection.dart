import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../network/api_client.dart';
import '../../features/auth/auth_repository.dart';
import '../../features/list/list_repository.dart';
import '../../features/savings/savings_repository.dart';
import '../../features/deals/deals_repository.dart';
import '../services/settings_service.dart';
import '../services/location_service.dart';
import '../services/favorite_store_service.dart';

final getIt = GetIt.instance;

Future<void> setupDependencies() async {
  // Shared Preferences
  final sharedPreferences = await SharedPreferences.getInstance();
  getIt.registerLazySingleton(() => sharedPreferences);
  
  // Services
  getIt.registerLazySingleton(() => SettingsService(getIt<SharedPreferences>()));
  getIt.registerLazySingleton(() => LocationService());
  getIt.registerLazySingleton(() => FavoriteStoreService(getIt<SharedPreferences>()));

  // Network
  getIt.registerLazySingleton(() => ApiClient());

  // Repositories
  getIt.registerLazySingleton(() => AuthRepository(getIt<ApiClient>()));
  getIt.registerLazySingleton(() => ListRepository(getIt<ApiClient>()));
  getIt.registerLazySingleton(() => SavingsRepository(getIt<SharedPreferences>()));
  getIt.registerLazySingleton(() => DealsRepository(getIt<ApiClient>()));
}
