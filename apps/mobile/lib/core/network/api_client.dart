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

  static String parseError(dynamic e) {
    if (e is DioException) {
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.sendTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        return 'Connection timeout. Please check your network stability and try again.';
      }
      if (e.type == DioExceptionType.connectionError) {
        return 'Network connection error. Please make sure you are connected to the internet.';
      }
      
      final response = e.response;
      if (response != null) {
        final statusCode = response.statusCode;
        if (statusCode == 429) {
          return 'Too many requests. Please slow down and try again in a few seconds.';
        }
        if (statusCode == 401) {
          return 'Unauthorized. Please sign in again.';
        }
        if (statusCode == 403) {
          return 'Access forbidden. Please contact support if this persists.';
        }
        if (statusCode == 404) {
          return 'Requested product or service not found.';
        }
        if (statusCode != null && statusCode >= 500) {
          return 'Server error. We are experiencing high load or technical issues. Please try again later.';
        }
        
        // Check if backend returned a validation/message structure
        final data = response.data;
        if (data is Map && data['message'] != null) {
          final msg = data['message'];
          if (msg is String) return msg;
          if (msg is List && msg.isNotEmpty) return msg.first.toString();
        }
      }
    }
    
    final str = e.toString().toLowerCase();
    if (str.contains('connection refused') || str.contains('socketexception') || str.contains('network_unreachable')) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }
    if (str.contains('429')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    
    return 'Something went wrong. Please check your network and try again.';
  }
}
