import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
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
import 'features/notifications/bloc/notification_cubit.dart';
import 'features/savings/bloc/savings_cubit.dart';
import 'features/savings/savings_repository.dart';
import 'features/deals/bloc/deals_cubit.dart';
import 'features/deals/deals_repository.dart';
import 'features/location/bloc/location_cubit.dart';

import 'package:flutter_stripe/flutter_stripe.dart';

import 'package:flutter/foundation.dart';
import 'package:google_fonts/google_fonts.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Prevent google_fonts from blocking startup with network requests.
  // Without this, the app hangs on a white screen if font servers are unreachable.
  GoogleFonts.config.allowRuntimeFetching = false;
  
  // Initialize Stripe
  const stripeKey = "pk_test_51TVzJnRX4uhAy7vXWJ9PkTXZ0bHpC0UYNSc6bUYD4SIkUKWZOOF8zEb2SGHG2mHrRhM0nfkvpd5GyyZGWZ92jGYO00RStIawoh";
  Stripe.publishableKey = stripeKey;
  if (!kIsWeb) {
    try {
      await Stripe.instance.applySettings();
    } catch (e) {
      debugPrint("Stripe error: $e");
    }
  }

  await setupDependencies();
  
  // Pre-warm auth cache so the first GoRouter redirect doesn't deadlock
  await syncAuthCache();
  
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        // --- Independent cubits first (no cross-cubit deps) ---
        BlocProvider<NotificationCubit>(
          create: (_) {
            debugPrint("[DEBUG] Creating NotificationCubit...");
            return getIt<NotificationCubit>();
          },
        ),
        BlocProvider<LocationCubit>(
          create: (_) {
            debugPrint("[DEBUG] Creating LocationCubit...");
            return LocationCubit(getIt<LocationService>())..init();
          },
        ),
        BlocProvider<ComparisonCubit>(
          create: (_) {
            debugPrint("[DEBUG] Creating ComparisonCubit...");
            return ComparisonCubit(
              getIt<ApiClient>(),
              getIt<LocationService>(),
            );
          },
        ),
        BlocProvider<ListCubit>(
          create: (_) {
            debugPrint("[DEBUG] Creating ListCubit...");
            return ListCubit(
              getIt<ListRepository>(),
              getIt<LocationService>(),
            );
          },
        ),
        BlocProvider<DealsCubit>(
          create: (_) {
            debugPrint("[DEBUG] Creating DealsCubit...");
            return DealsCubit(getIt<DealsRepository>());
          },
        ),
        BlocProvider<SavingsCubit>(
          create: (_) {
            debugPrint("[DEBUG] Creating SavingsCubit...");
            return SavingsCubit(getIt<SavingsRepository>());
          },
        ),
        // --- Cubits that depend on others above ---
        BlocProvider<HomeCubit>(
          create: (context) {
            debugPrint("[DEBUG] Creating HomeCubit...");
            return HomeCubit(
              listRepository: getIt<ListRepository>(),
              dealsRepository: getIt<DealsRepository>(),
              comparisonCubit: context.read<ComparisonCubit>(),
              locationService: getIt<LocationService>(),
              listCubit: context.read<ListCubit>(),
              locationCubit: context.read<LocationCubit>(),
            );
          },
        ),
        // --- AuthCubit LAST because onLogout references all cubits above ---
        BlocProvider<AuthCubit>(
          create: (context) {
            debugPrint("[DEBUG] Creating AuthCubit...");
            final cubit = AuthCubit(
              getIt<AuthRepository>(),
              getIt<SettingsService>(),
              onLogout: [
                () { try { context.read<ListCubit>().clear(); } catch (_) {} },
                () { try { context.read<HomeCubit>().clear(); } catch (_) {} },
                () { try { context.read<ComparisonCubit>().clear(); } catch (_) {} },
                () { try { context.read<DealsCubit>().clear(); } catch (_) {} },
                () { try { context.read<SavingsCubit>().clear(); } catch (_) {} },
              ],
              onLogin: [
                () { try { context.read<ListCubit>().fetchCart(); } catch (_) {} },
                () { try { context.read<DealsCubit>().fetchDeals(); } catch (_) {} },
                () { try { context.read<SavingsCubit>().loadSavings(); } catch (_) {} },
                // Note: HomeCubit.loadDashboard() will automatically fire because 
                // ListCubit emits ListLoaded after fetchCart() completes.
                // However, we explicitly call it here just in case the list was empty or failed.
                () { try { context.read<HomeCubit>().loadDashboard(); } catch (_) {} },
              ],
            );
            // Defer checkAuth so it doesn't block the first frame
            SchedulerBinding.instance.addPostFrameCallback((_) {
              cubit.checkAuth();
            });
            return cubit;
          },
        ),
      ],
      child: MaterialApp.router(
        title: 'Shop Save',
        theme: AppTheme.lightTheme,
        routerConfig: appRouter,
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
