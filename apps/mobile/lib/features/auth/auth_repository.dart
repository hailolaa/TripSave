import '../../core/network/api_client.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthRepository {
  final ApiClient apiClient;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  AuthRepository(this.apiClient);

  Future<Map<String, dynamic>> login(String email, String password, {bool rememberMe = true}) async {
    final response = await apiClient.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });

    final token = response.data['access_token'];
    await _storage.write(key: 'jwt', value: token);
    await _storage.write(key: 'remember_me', value: rememberMe.toString());

    // Store user info locally
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

  Future<Map<String, dynamic>> register(String name, String email, String password) async {
    final response = await apiClient.dio.post('/auth/register', data: {
      'name': name,
      'email': email,
      'password': password,
    });

    final token = response.data['access_token'];
    await _storage.write(key: 'jwt', value: token);
    await _storage.write(key: 'remember_me', value: 'true'); // Default to true on register

    final user = response.data['user'];
    if (user != null) {
      await _storage.write(key: 'user_name', value: user['name'] ?? name);
      await _storage.write(key: 'user_email', value: user['email'] ?? email);
      await _storage.write(key: 'user_id', value: user['id'] ?? '');
      await _storage.write(key: 'onboarding_completed', value: 'false');
    } else {
      await _storage.write(key: 'user_name', value: name);
      await _storage.write(key: 'user_email', value: email);
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

  Future<void> saveReferral(String source) async {
    await apiClient.dio.post('/subscription/referral', data: {'source': source});
  }

  Future<String> createSetupIntent() async {
    final response = await apiClient.dio.post('/subscription/setup-intent');
    return response.data['clientSecret'];
  }

  Future<void> activateTrial(String paymentMethodId) async {
    await apiClient.dio.post('/subscription/activate-trial', data: {'paymentMethodId': paymentMethodId});
  }
}
