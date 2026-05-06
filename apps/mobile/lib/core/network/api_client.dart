import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';

class ApiClient {
  late final Dio dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  ApiClient() {
    dio = Dio(
      BaseOptions(
        baseUrl: kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000', 
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 150),
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
