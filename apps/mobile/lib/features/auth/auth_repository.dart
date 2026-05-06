import '../../core/network/api_client.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthRepository {
  final ApiClient apiClient;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  AuthRepository(this.apiClient);

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await apiClient.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });

    final token = response.data['access_token'];
    await _storage.write(key: 'jwt', value: token);

    // Store user info locally
    final user = response.data['user'];
    if (user != null) {
      await _storage.write(key: 'user_name', value: user['name'] ?? '');
      await _storage.write(key: 'user_email', value: user['email'] ?? '');
      await _storage.write(key: 'user_id', value: user['id'] ?? '');
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

    final user = response.data['user'];
    if (user != null) {
      await _storage.write(key: 'user_name', value: user['name'] ?? name);
      await _storage.write(key: 'user_email', value: user['email'] ?? email);
      await _storage.write(key: 'user_id', value: user['id'] ?? '');
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
      return data;
    } catch (e) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> updateProfile(Map<String, dynamic> data) async {
    try {
      final response = await apiClient.dio.patch('/users/me', data: data);
      final updatedData = Map<String, dynamic>.from(response.data);
      // We don't necessarily need to store MPG locally if we always fetch it, 
      // but let's keep the user_name / email updated if they changed
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
}
