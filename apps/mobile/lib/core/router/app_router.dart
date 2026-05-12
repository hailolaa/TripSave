import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../features/shell/presentation/main_wrapper.dart';
import '../../features/list/presentation/list_screen.dart';
import '../../features/compare/presentation/compare_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/savings/presentation/savings_screen.dart';
import '../../features/deals/presentation/deals_screen.dart';
import '../../features/compare/presentation/map_picker_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/home/presentation/category_detail_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/onboarding_screen.dart';
import '../../features/auth/referral_screen.dart';
import '../../features/auth/presentation/verification_screen.dart';
import '../../features/auth/payment_screen.dart';
import '../di/injection.dart';
import '../../features/auth/auth_repository.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final GlobalKey<NavigatorState> _shellNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'shell');

class RouterNotifier extends ChangeNotifier {
  final AuthRepository _repository;
  RouterNotifier(this._repository);

  void notify() => notifyListeners();
}

final RouterNotifier routerNotifier = RouterNotifier(getIt<AuthRepository>());

final GoRouter appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/home',
  refreshListenable: routerNotifier,
  redirect: (context, state) async {
    final storage = const FlutterSecureStorage();
    final token = await storage.read(key: 'jwt');
    final isLoggedIn = token != null && token.isNotEmpty;
    
    final isAuthRoute = state.matchedLocation == '/login' || 
                        state.matchedLocation == '/register' || 
                        state.matchedLocation == '/verify-email';
    
    if (!isLoggedIn) {
      return isAuthRoute ? null : '/login';
    }
    
    // If logged in, check onboarding status
    final onboardingCompleted = (await storage.read(key: 'onboarding_completed')) == 'true';
    final referralSource = await storage.read(key: 'referral_source');
    final subStatus = await storage.read(key: 'subscription_status');
    
    final isOnboardingRoute = state.matchedLocation == '/onboarding' || 
                              state.matchedLocation == '/referral' || 
                              state.matchedLocation == '/payment';

    if (!onboardingCompleted) {
      return state.matchedLocation == '/onboarding' ? null : '/onboarding';
    }
    
    if (referralSource == null || referralSource.isEmpty || referralSource == 'null') {
      return state.matchedLocation == '/referral' ? null : '/referral';
    }
    
    if (subStatus == 'none' || subStatus == 'null' || subStatus == null) {
      return state.matchedLocation == '/payment' ? null : '/payment';
    }

    if (isAuthRoute || isOnboardingRoute) {
      return '/home';
    }
    
    return null;
  },
  routes: [
    ShellRoute(
      navigatorKey: _shellNavigatorKey,
      builder: (context, state, child) {
        return MainWrapper(child: child);
      },
      routes: [
        GoRoute(
          path: '/home',
          builder: (context, state) => const HomeScreen(),
        ),
        GoRoute(
          path: '/category/:type',
          builder: (context, state) {
            final type = state.pathParameters['type'] ?? 'gas';
            return CategoryDetailScreen(categoryType: type);
          },
        ),
        GoRoute(
          path: '/compare',
          builder: (context, state) => const CompareScreen(),
        ),
        GoRoute(
          path: '/list',
          builder: (context, state) => const ListScreen(),
        ),
        GoRoute(
          path: '/savings',
          builder: (context, state) => const SavingsScreen(),
        ),
        GoRoute(
          path: '/deals',
          builder: (context, state) => const DealsScreen(),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileScreen(),
        ),
      ],
    ),
    GoRoute(
      path: '/map-picker',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const MapPickerScreen(),
    ),
    GoRoute(
      path: '/login',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/register',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/onboarding',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const OnboardingScreen(),
    ),
    GoRoute(
      path: '/referral',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const ReferralScreen(),
    ),
    GoRoute(
      path: '/payment',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const PaymentScreen(),
    ),
    GoRoute(
      path: '/verify-email',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) {
        final email = state.extra as String? ?? '';
        return VerificationScreen(email: email);
      },
    ),
  ],
);
