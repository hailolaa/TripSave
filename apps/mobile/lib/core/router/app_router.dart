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
import '../../features/notifications/presentation/notification_screen.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final GlobalKey<NavigatorState> _shellNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'shell');

class RouterNotifier extends ChangeNotifier {
  void notify() => notifyListeners();
}

final RouterNotifier routerNotifier = RouterNotifier();

/// Cached auth state to avoid async deadlock in redirect.
/// Updated by _syncAuthCache() and by AuthCubit via routerNotifier.
String? _cachedToken;
String? _cachedOnboarding;
String? _cachedReferral;
String? _cachedSubStatus;

Future<void> syncAuthCache() async {
  const storage = FlutterSecureStorage();
  _cachedToken = await storage.read(key: 'jwt');
  _cachedOnboarding = await storage.read(key: 'onboarding_completed');
  _cachedReferral = await storage.read(key: 'referral_source');
  _cachedSubStatus = await storage.read(key: 'subscription_status');
}

final GoRouter appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/home',
  refreshListenable: routerNotifier,
  redirect: (context, state) async {
    // Sync cache on every redirect (fast — just SharedPrefs reads)
    await syncAuthCache();

    final isLoggedIn = _cachedToken != null && _cachedToken!.isNotEmpty;
    
    final isAuthRoute = state.matchedLocation == '/login' || 
                        state.matchedLocation == '/register' || 
                        state.matchedLocation == '/verify-email';
    
    if (!isLoggedIn) {
      return isAuthRoute ? null : '/login';
    }
    
    // If logged in, check onboarding status
    final onboardingCompleted = _cachedOnboarding == 'true';
    final referralSource = _cachedReferral;
    final subStatus = _cachedSubStatus;
    
    final isOnboardingRoute = state.matchedLocation == '/onboarding' || 
                              state.matchedLocation == '/referral' || 
                              state.matchedLocation == '/payment';

    if (!onboardingCompleted) {
      if (state.matchedLocation == '/onboarding') return null;
      return '/onboarding';
    }
    
    if (referralSource == null || referralSource.isEmpty || referralSource == 'null') {
      if (state.matchedLocation == '/onboarding' || state.matchedLocation == '/referral') return null;
      return '/referral';
    }
    
    if (subStatus == 'none' || subStatus == 'null' || subStatus == null) {
      if (state.matchedLocation == '/onboarding' || state.matchedLocation == '/referral' || state.matchedLocation == '/payment') return null;
      return '/payment';
    }

    // Allow /payment?isUpdating=true for authenticated users updating their card
    final isUpdatingPayment = state.matchedLocation == '/payment' &&
        state.uri.queryParameters['isUpdating'] == 'true';

    if ((isAuthRoute || isOnboardingRoute) && !isUpdatingPayment) {
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
        GoRoute(
          path: '/notifications',
          builder: (context, state) => const NotificationScreen(),
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
      builder: (context, state) {
        final isUpdating = state.uri.queryParameters['isUpdating'] == 'true';
        return PaymentScreen(isUpdating: isUpdating);
      },
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
