import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  late final Dio dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  ApiClient() {
    dio = Dio(
      BaseOptions(
        baseUrl: 'http://213.199.35.225:3001',
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
