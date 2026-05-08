import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  late final Dio dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  static const String _fallbackProdBaseUrl = 'http://213.199.35.225/tripsave';
  static const String _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');

  static String _resolveBaseUrl() {
    // Allow override at build/run time:
    // flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001
    if (_configuredBaseUrl.isNotEmpty) {
      return _configuredBaseUrl;
    }

    if (kDebugMode) {
      // Android emulator loopback to host machine.
      return 'http://10.0.2.2:3001';
    }

    return _fallbackProdBaseUrl;
  }

  ApiClient() {
    dio = Dio(
      BaseOptions(
        baseUrl: _resolveBaseUrl(),
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(minutes: 2),
      ),
    );

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'jwt');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (e, handler) async {
        if (e.response?.statusCode == 401) {
          // Token is invalid or expired
          await _storage.delete(key: 'jwt');
          // You might want to use a global navigator or event bus to redirect
          // but deleting the token will trigger the GoRouter redirect on next navigation/refresh
        }
        return handler.next(e);
      },
    ));
  }
}
