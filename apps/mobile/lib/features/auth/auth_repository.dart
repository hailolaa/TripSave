import '../../core/network/api_client.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';

class AuthRepository {
  final ApiClient apiClient;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );

  AuthRepository(this.apiClient);

  Future<Map<String, dynamic>> login(String email, String password, {bool rememberMe = true}) async {
    final response = await apiClient.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });

    final user = response.data['user'];
    if (user != null && user['is_email_verified'] == true) {
      final token = response.data['access_token'];
      await _storage.write(key: 'jwt', value: token);
      await _storage.write(key: 'remember_me', value: rememberMe.toString());

      await _storage.write(key: 'user_name', value: user['name'] ?? '');
      await _storage.write(key: 'user_email', value: user['email'] ?? '');
      await _storage.write(key: 'user_id', value: user['id'] ?? '');
      await _storage.write(key: 'onboarding_completed', value: (user['onboarding_completed'] ?? false).toString());
      await _storage.write(key: 'referral_source', value: user['referral_source']?.toString() ?? '');
      await _storage.write(key: 'subscription_status', value: user['subscription_status']?.toString() ?? 'none');
      await _storage.write(key: 'vehicle_mpg', value: (user['vehicle_mpg'] ?? 25.0).toString());
      await _storage.write(key: 'default_gas_price', value: (user['default_gas_price'] ?? 3.50).toString());
    }

    return response.data;
  }

  Future<Map<String, dynamic>> register(String name, String email, String password) async {
    final response = await apiClient.dio.post('/auth/register', data: {
      'name': name,
      'email': email,
      'password': password,
    });

    final token = response.data['access_token'];
    if (token != null) {
      await _storage.write(key: 'jwt', value: token);
      await _storage.write(key: 'remember_me', value: 'true');
      
      await _storage.write(key: 'onboarding_completed', value: (user['onboarding_completed'] ?? false).toString());
      await _storage.write(key: 'referral_source', value: user['referral_source']?.toString() ?? '');
      await _storage.write(key: 'subscription_status', value: user['subscription_status']?.toString() ?? 'none');
      await _storage.write(key: 'vehicle_mpg', value: (user['vehicle_mpg'] ?? 25.0).toString());
      await _storage.write(key: 'default_gas_price', value: (user['default_gas_price'] ?? 3.50).toString());
    }

    return response.data;
  }

  Future<Map<String, dynamic>> verifyEmail(String email, String code) async {
    final response = await apiClient.dio.post('/auth/verify-email', data: {
      'email': email,
      'code': code,
    });

    final token = response.data['access_token'];
    await _storage.write(key: 'jwt', value: token);
    await _storage.write(key: 'remember_me', value: 'true');

    final user = response.data['user'];
    if (user != null) {
      await _storage.write(key: 'user_name', value: user['name'] ?? '');
      await _storage.write(key: 'user_email', value: user['email'] ?? '');
      await _storage.write(key: 'user_id', value: user['id'] ?? '');
      await _storage.write(key: 'onboarding_completed', value: (user['onboarding_completed'] ?? false).toString());
    }

    return response.data;
  }

  Future<Map<String, dynamic>> signInWithGoogle() async {
    final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
    if (googleUser == null) throw Exception('Google sign-in cancelled');

    final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
    final String? idToken = googleAuth.idToken;

    if (idToken == null) throw Exception('Failed to get Google ID token');

    final response = await apiClient.dio.post('/auth/google', data: {
      'idToken': idToken,
    });

    final token = response.data['access_token'];
    await _storage.write(key: 'jwt', value: token);
    await _storage.write(key: 'remember_me', value: 'true');

    final user = response.data['user'];
    if (user != null) {
      await _storage.write(key: 'user_name', value: user['name'] ?? '');
      await _storage.write(key: 'user_email', value: user['email'] ?? '');
      await _storage.write(key: 'user_id', value: user['id'] ?? '');
      await _storage.write(key: 'onboarding_completed', value: (user['onboarding_completed'] ?? false).toString());
      await _storage.write(key: 'vehicle_mpg', value: (user['vehicle_mpg'] ?? 25.0).toString());
      await _storage.write(key: 'default_gas_price', value: (user['default_gas_price'] ?? 3.50).toString());
    }

    return response.data;
  }

  Future<Map<String, dynamic>?> getProfile() async {
    try {
      final response = await apiClient.dio.get('/auth/me');
      final data = Map<String, dynamic>.from(response.data);
      // Update stored user info
      await _storage.write(key: 'user_name', value: data['name'] ?? '');
      await _storage.write(key: 'user_email', value: data['email'] ?? '');
      await _storage.write(key: 'user_id', value: data['id'] ?? '');
      await _storage.write(key: 'onboarding_completed', value: (data['onboarding_completed'] ?? false).toString());
      await _storage.write(key: 'referral_source', value: data['referral_source']?.toString() ?? '');
      await _storage.write(key: 'subscription_status', value: data['subscription_status']?.toString() ?? 'none');
      await _storage.write(key: 'vehicle_mpg', value: (data['vehicle_mpg'] ?? 25.0).toString());
      await _storage.write(key: 'default_gas_price', value: (data['default_gas_price'] ?? 3.50).toString());
      return data;
    } catch (e) {
      return null;
    }
  }

  Future<void> completeOnboarding() async {
    await apiClient.dio.patch('/users/me', data: {'onboarding_completed': true});
    await _storage.write(key: 'onboarding_completed', value: 'true');
  }

  Future<bool> isOnboardingCompleted() async {
    final val = await _storage.read(key: 'onboarding_completed');
    return val == 'true';
  }

  Future<bool> isRememberMeEnabled() async {
    final val = await _storage.read(key: 'remember_me');
    return val != 'false'; // Default to true
  }

  Future<Map<String, dynamic>?> updateProfile(Map<String, dynamic> data) async {
    try {
      final response = await apiClient.dio.patch('/users/me', data: data);
      final updatedData = Map<String, dynamic>.from(response.data);
      if (updatedData.containsKey('name')) {
        await _storage.write(key: 'user_name', value: updatedData['name']);
      }
      return updatedData;
    } catch (e) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> geocode(String query) async {
    try {
      final response = await apiClient.dio.get('/users/geocode', queryParameters: {'q': query});
      return response.data != null ? Map<String, dynamic>.from(response.data) : null;
    } catch (e) {
      return null;
    }
  }

  Future<void> logout() async {
    await _storage.delete(key: 'jwt');
    await _storage.delete(key: 'user_name');
    await _storage.delete(key: 'user_email');
    await _storage.delete(key: 'user_id');
    await _storage.delete(key: 'onboarding_completed');
    await _storage.delete(key: 'referral_source');
    await _storage.delete(key: 'subscription_status');
    await _storage.delete(key: 'remember_me');
    await _storage.delete(key: 'vehicle_mpg');
    await _storage.delete(key: 'default_gas_price');
  }

  Future<bool> isLoggedIn() async {
    final token = await _storage.read(key: 'jwt');
    return token != null && token.isNotEmpty;
  }

  Future<String?> getUserName() async {
    return await _storage.read(key: 'user_name');
  }

  Future<String?> getUserEmail() async {
    return await _storage.read(key: 'user_email');
  }

  Future<void> saveReferral(String source, [String? referrerName]) async {
    await apiClient.dio.post('/subscription/referral', data: {
      'source': source,
      'referrer_name': referrerName,
    });
  }

  Future<String> createSetupIntent() async {
    final response = await apiClient.dio.post('/subscription/setup-intent');
    return response.data['clientSecret'];
  }

  Future<void> activateTrial(String paymentMethodId) async {
    await apiClient.dio.post('/subscription/activate-trial', data: {'paymentMethodId': paymentMethodId});
  }

  Future<void> cancelSubscription() async {
    await apiClient.dio.post('/subscription/cancel');
  }

  Future<Map<String, dynamic>?> getPaymentMethod() async {
    final response = await apiClient.dio.get('/subscription/payment-method');
    return response.data;
  }
}
