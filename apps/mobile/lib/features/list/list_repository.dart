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
    final response = await apiClient.dio.get(
      '/products/suggestions',
      queryParameters: {
        'q': query,
        'limit': 10,
      },
    );
    return List<Map<String, dynamic>>.from(response.data);
  }

  Future<Map<String, dynamic>> resolveProductForList(String query) async {
    final response = await apiClient.dio.get('/products/search', queryParameters: {'q': query});
    final products = List<Map<String, dynamic>>.from(response.data);
    if (products.isEmpty) {
      throw StateError('No product found for $query');
    }
    return products.first;
  }

  Future<Map<String, dynamic>?> getCartSummary({
    required double lat,
    required double lng,
    required List<dynamic> items,
  }) async {
    final response = await apiClient.dio.post(
      '/comparison/cart/compare',
      data: {
        'userLat': lat,
        'userLng': lng,
        'items': items.map((i) => {
          'productId': i['product_id'],
          'quantity': i['quantity'] ?? 1,
        }).toList(),
        'sortBy': 'item_total',
      },
    );
    final results = List<Map<String, dynamic>>.from(response.data);
    return results.isNotEmpty ? results.first : null;
  }
}
