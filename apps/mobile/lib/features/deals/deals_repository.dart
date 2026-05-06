import '../../core/network/api_client.dart';

class DealsRepository {
  final ApiClient apiClient;

  DealsRepository(this.apiClient);

  Future<List<Map<String, dynamic>>> getDeals({String? zip}) async {
    final response = await apiClient.dio.get(
      '/products/deals',
      queryParameters: zip != null ? {'zip': zip} : {},
    );
    return List<Map<String, dynamic>>.from(response.data);
  }
}
