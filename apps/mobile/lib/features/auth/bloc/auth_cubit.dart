import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../auth_repository.dart';

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
class AuthUnauthenticated extends AuthState {}
class AuthError extends AuthState {
  final String message;
  AuthError(this.message);
  @override
  List<Object?> get props => [message];
}

class AuthCubit extends Cubit<AuthState> {
  final AuthRepository authRepository;

  AuthCubit(this.authRepository) : super(AuthInitial());

  Future<void> checkAuth() async {
    final isLoggedIn = await authRepository.isLoggedIn();
    if (!isLoggedIn) {
      emit(AuthUnauthenticated());
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
      emit(AuthUnauthenticated());
    }
  }

  void _resolveAuthState(Map<String, dynamic> profile) {
    final referralSource = profile['referral_source'];
    final subStatus = profile['subscription_status'];

    if (referralSource == null || (referralSource as String).isEmpty) {
      emit(AuthReferralRequired());
    } else if (subStatus == 'none') {
      emit(AuthPaymentRequired());
    } else {
      emit(AuthAuthenticated(userName: profile['name'] ?? ''));
    }
  }

  Future<void> login(String email, String password) async {
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
      final response = await authRepository.login(email, password);
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

  Future<void> register(String name, String email, String password, String confirmPassword) async {
    // Client-side validation
    if (name.isEmpty || email.isEmpty || password.isEmpty || confirmPassword.isEmpty) {
      emit(AuthError('Please fill in all fields'));
      return;
    }

    if (name.trim().length < 2) {
      emit(AuthError('Name must be at least 2 characters'));
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

    if (password != confirmPassword) {
      emit(AuthError('Passwords do not match'));
      return;
    }

    emit(AuthLoading());
    try {
      await authRepository.register(name, email, password);
      emit(AuthReferralRequired());
    } catch (e) {
      final msg = _parseError(e);
      emit(AuthError(msg));
    }
  }

  Future<void> logout() async {
    await authRepository.logout();
    emit(AuthUnauthenticated());
  }

  String _parseError(dynamic e) {
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

  Future<void> submitReferral(String source) async {
    emit(AuthLoading());
    try {
      await authRepository.saveReferral(source);
      emit(AuthPaymentRequired());
    } catch (e) {
      emit(AuthError('Failed to save referral source'));
    }
  }

  Future<void> submitPayment(String paymentMethodId) async {
    emit(AuthLoading());
    try {
      await authRepository.activateTrial(paymentMethodId);
      final profile = await authRepository.getProfile();
      if (profile != null) {
        _resolveAuthState(profile);
      }
    } catch (e) {
      emit(AuthError('Failed to activate trial. Please check your card info.'));
    }
  }
}


