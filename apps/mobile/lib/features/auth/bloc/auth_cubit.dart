import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../auth_repository.dart';
import '../../../core/services/settings_service.dart';
import '../../../core/router/app_router.dart';

abstract class AuthState extends Equatable {
  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {}
class AuthLoading extends AuthState {}
class AuthAuthenticated extends AuthState {
  final String userName;
  AuthAuthenticated({this.userName = ''});
  @override
  List<Object?> get props => [userName];
}
class AuthOnboardingRequired extends AuthState {}
class AuthReferralRequired extends AuthState {}
class AuthPaymentRequired extends AuthState {}
class AuthEmailVerificationRequired extends AuthState {
  final String email;
  AuthEmailVerificationRequired(this.email);
  @override
  List<Object?> get props => [email];
}
class AuthPaymentSuccess extends AuthState {}
class AuthUnauthenticated extends AuthState {}
class AuthError extends AuthState {
  final String message;
  AuthError(this.message);
  @override
  List<Object?> get props => [message];
}

class AuthCubit extends Cubit<AuthState> {
  final AuthRepository authRepository;
  final SettingsService settingsService;
  final List<void Function()>? onLogout;

  AuthCubit(this.authRepository, this.settingsService, {this.onLogout}) : super(AuthInitial()) {
    stream.listen((state) {
      if (state is AuthAuthenticated || 
          state is AuthUnauthenticated || 
          state is AuthOnboardingRequired || 
          state is AuthReferralRequired || 
          state is AuthPaymentRequired) {
        routerNotifier.notify();
      }
    });
  }

  Future<void> checkAuth() async {
    final isLoggedIn = await authRepository.isLoggedIn();
    if (!isLoggedIn) {
      emit(AuthUnauthenticated());
      return;
    }

    // Check if remember me is enabled. If not, treat as unauthenticated 
    // (though in a real app you might clear token on close instead).
    final rememberMe = await authRepository.isRememberMeEnabled();
    if (!rememberMe) {
      await logout();
      return;
    }

    try {
      final profile = await authRepository.getProfile();
      if (profile == null) {
        emit(AuthUnauthenticated());
        return;
      }

      _resolveAuthState(profile);
    } catch (e) {
      emit(AuthError('Session expired. Please sign in again.'));
      emit(AuthUnauthenticated());
    }
  }

  void _resolveAuthState(Map<String, dynamic> profile) {
    // Sync settings locally
    final mpg = double.tryParse(profile['vehicle_mpg']?.toString() ?? '');
    final gasPrice = double.tryParse(profile['default_gas_price']?.toString() ?? '');
    
    if (mpg != null && mpg > 0) {
      settingsService.setMpg(mpg);
    }
    if (gasPrice != null && gasPrice > 0) {
      settingsService.setGasPrice(gasPrice);
    }

    final referralSource = profile['referral_source'];
    final subStatus = profile['subscription_status']?.toString().toLowerCase() ?? 'none';
    
    // Robust boolean parsing
    final rawOnboarding = profile['onboarding_completed'];
    final onboardingCompleted = rawOnboarding == true || 
                                rawOnboarding.toString() == 'true' || 
                                rawOnboarding.toString() == '1' ||
                                rawOnboarding.toString() == 'yes';

    if (!onboardingCompleted) {
      emit(AuthOnboardingRequired());
    } else if (referralSource == null || referralSource.toString().isEmpty || referralSource.toString() == 'null') {
      emit(AuthReferralRequired());
    } else if (subStatus == 'none' || subStatus == 'null') {
      emit(AuthPaymentRequired());
    } else {
      emit(AuthAuthenticated(userName: profile['name'] ?? ''));
    }
  }

  Future<void> login(String email, String password, {bool rememberMe = true}) async {
    // Client-side validation
    if (email.isEmpty || password.isEmpty) {
      emit(AuthError('Please fill in all fields'));
      return;
    }

    final emailRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    if (!emailRegex.hasMatch(email)) {
      emit(AuthError('Please enter a valid email address'));
      return;
    }

    if (password.length < 6) {
      emit(AuthError('Password must be at least 6 characters'));
      return;
    }
    emit(AuthLoading());
    try {
      final response = await authRepository.login(email, password, rememberMe: rememberMe);
      final user = response['user'];
      if (user != null) {
        _resolveAuthState(user);
      } else {
        emit(AuthAuthenticated());
      }
    } catch (e) {
      final msg = _parseError(e);
      emit(AuthError(msg));
    }
  }

  Future<void> signInWithGoogle() async {
    emit(AuthLoading());
    try {
      final response = await authRepository.signInWithGoogle();
      final user = response['user'];
      if (user != null) {
        _resolveAuthState(user);
      }
    } catch (e) {
      if (e.toString().contains('cancelled')) {
        emit(AuthUnauthenticated());
      } else {
        emit(AuthError('Google Sign-In failed'));
      }
    }
  }

  Future<void> verifyEmail(String email, String code) async {
    emit(AuthLoading());
    try {
      final response = await authRepository.verifyEmail(email, code);
      final user = response['user'];
      if (user != null) {
        _resolveAuthState(user);
      }
    } catch (e) {
      emit(AuthError('Invalid verification code'));
    }
  }

  Future<void> completeOnboarding(double mpg, double gasPrice) async {
    emit(AuthLoading());
    try {
      await authRepository.updateProfile({
        'vehicle_mpg': mpg,
        'default_gas_price': gasPrice,
        'onboarding_completed': true,
      });
      await authRepository.completeOnboarding(); // This sets the local flag too
      final profile = await authRepository.getProfile();
      if (profile != null) {
        _resolveAuthState(profile);
      }
    } catch (e) {
      emit(AuthError('Failed to save onboarding details'));
    }
  }

  Future<void> register(String name, String email, String password, String confirmPassword) async {
    // ... (rest of registration stays same but resolve state will check onboarding)
    if (name.isEmpty || email.isEmpty || password.isEmpty || confirmPassword.isEmpty) {
      emit(AuthError('Please fill in all fields'));
      return;
    }
    // ... validation logic ...
    emit(AuthLoading());
    try {
      final response = await authRepository.register(name, email, password);
      final user = response['user'];
      if (user != null) {
        _resolveAuthState(user);
      } else {
        emit(AuthOnboardingRequired());
      }
    } catch (e) {
      final msg = _parseError(e);
      emit(AuthError(msg));
    }
  }

  Future<void> logout() async {
    await authRepository.logout();
    await settingsService.clear();
    if (onLogout != null) {
      for (var clearFn in onLogout!) {
        clearFn();
      }
    }
    emit(AuthUnauthenticated());
  }

  String _parseError(dynamic e) {
    // ... (rest of error parsing stays same)
    final str = e.toString();
    if (str.contains('409') || str.contains('already exists') || str.contains('ConflictException')) {
      return 'An account with this email already exists';
    } else if (str.contains('401') || str.contains('Unauthorized') || str.contains('Invalid')) {
      return 'Invalid email or password';
    } else if (str.contains('400')) {
      return 'Please check your input and try again';
    } else if (str.contains('Connection refused') || str.contains('SocketException')) {
      return 'Unable to connect to server. Please try again later.';
    }
    return 'Something went wrong. Please try again.';
  }

  Future<void> updateVehicleInfo(double mpg, double gasPrice) async {
    emit(AuthLoading());
    try {
      await authRepository.updateProfile({
        'vehicle_mpg': mpg,
        'default_gas_price': gasPrice,
      });
      final profile = await authRepository.getProfile();
      if (profile != null) {
        _resolveAuthState(profile);
      }
    } catch (e) {
      emit(AuthError('Failed to save vehicle details'));
    }
  }

  Future<void> submitReferral(String source, [String? referrerName]) async {
    emit(AuthLoading());
    try {
      await authRepository.saveReferral(source, referrerName);
      final profile = await authRepository.getProfile();
      if (profile != null) {
        _resolveAuthState(profile);
      }
    } catch (e) {
      emit(AuthError('Failed to save referral source'));
    }
  }

  Future<void> submitPayment(String paymentMethodId) async {
    emit(AuthLoading());
    try {
      await authRepository.activateTrial(paymentMethodId);
      emit(AuthPaymentSuccess());
      // Wait a bit to show success before going home
      await Future.delayed(const Duration(seconds: 2));
      final profile = await authRepository.getProfile();
      if (profile != null) {
        _resolveAuthState(profile);
      }
    } catch (e) {
      emit(AuthError('Failed to activate trial. Please check your card info.'));
    }
  }
}


