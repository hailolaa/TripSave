import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/di/injection.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'features/compare/bloc/comparison_cubit.dart';
import 'features/auth/bloc/auth_cubit.dart';
import 'features/auth/auth_repository.dart';
import 'core/network/api_client.dart';
import 'core/services/settings_service.dart';
import 'core/services/location_service.dart';
import 'features/list/bloc/list_cubit.dart';
import 'features/list/list_repository.dart';
import 'features/home/bloc/home_cubit.dart';
import 'features/savings/bloc/savings_cubit.dart';
import 'features/savings/savings_repository.dart';
import 'features/deals/bloc/deals_cubit.dart';
import 'features/deals/deals_repository.dart';
import 'features/location/bloc/location_cubit.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await setupDependencies();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<LocationCubit>(
          create: (_) => LocationCubit(getIt<LocationService>())..init(),
        ),
        BlocProvider<ComparisonCubit>(
          create: (_) => ComparisonCubit(
            getIt<ApiClient>(), 
            getIt<SettingsService>(),
            getIt<LocationService>(),
          ),
        ),
        BlocProvider<AuthCubit>(
          create: (_) => AuthCubit(getIt<AuthRepository>()),
        ),
        BlocProvider<ListCubit>(
          create: (_) => ListCubit(
            getIt<ListRepository>(), 
            getIt<SettingsService>(),
            getIt<LocationService>(),
          )..fetchCart(),
        ),
        BlocProvider<DealsCubit>(
          create: (_) => DealsCubit(getIt<DealsRepository>())..fetchDeals(),
        ),
        BlocProvider<HomeCubit>(
          create: (context) => HomeCubit(
            listRepository: getIt<ListRepository>(),
            dealsRepository: getIt<DealsRepository>(),
            comparisonCubit: context.read<ComparisonCubit>(),
            locationService: getIt<LocationService>(),
            listCubit: context.read<ListCubit>(),
            locationCubit: context.read<LocationCubit>(),
          )..loadDashboard(),
        ),
        BlocProvider<SavingsCubit>(
          create: (_) => SavingsCubit(getIt<SavingsRepository>())..loadSavings(),
        ),
      ],
      child: MaterialApp.router(
        title: 'TripSave',
        theme: AppTheme.lightTheme,
        routerConfig: appRouter,
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
