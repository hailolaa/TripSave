import '../../core/network/api_client.dart';

class ListRepository {
  final ApiClient apiClient;

  ListRepository(this.apiClient);

  Future<List<Map<String, dynamic>>> getCart() async {
    final response = await apiClient.dio.get('/users/me/cart');
    return List<Map<String, dynamic>>.from(response.data);
  }

  Future<Map<String, dynamic>> addToCart(String productId, int quantity) async {
    final response = await apiClient.dio.post(
      '/users/me/cart',
      data: {'productId': productId, 'quantity': quantity},
    );
    return response.data;
  }

  Future<Map<String, dynamic>> updateCartItem(String itemId, int quantity) async {
    final response = await apiClient.dio.patch(
      '/users/me/cart/$itemId',
      data: {'quantity': quantity},
    );
    return response.data;
  }

  Future<void> removeFromCart(String itemId) async {
    await apiClient.dio.delete('/users/me/cart/$itemId');
  }

  Future<List<Map<String, dynamic>>> searchProducts(String query) async {
    final response = await apiClient.dio.get('/products/search', queryParameters: {'q': query});
    return List<Map<String, dynamic>>.from(response.data);
  }

  Future<Map<String, dynamic>?> getCartSummary({
    required double lat,
    required double lng,
    required double mpg,
    required double gasPrice,
  }) async {
    // We'll use the existing compare/cart endpoint to get the best store
    final response = await apiClient.dio.post(
      '/comparison/cart/compare',
      data: {
        'userLat': lat,
        'userLng': lng,
        'userMpg': mpg,
        'gasPrice': gasPrice,
        'productIds': [], // Backend will pull from current user's cart if empty
      },
    );
    final results = List<Map<String, dynamic>>.from(response.data);
    return results.isNotEmpty ? results.first : null;
  }
}
