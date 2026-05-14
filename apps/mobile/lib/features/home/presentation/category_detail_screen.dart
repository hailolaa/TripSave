import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/store_logo.dart';
import '../../../core/services/location_service.dart';
import '../../list/list_repository.dart';
import '../../../core/services/settings_service.dart';
import '../../../core/di/injection.dart';

class CategoryDetailScreen extends StatefulWidget {
  final String categoryType;
  
  const CategoryDetailScreen({super.key, required this.categoryType});

  @override
  State<CategoryDetailScreen> createState() => _CategoryDetailScreenState();
}

class _CategoryDetailScreenState extends State<CategoryDetailScreen> {
  bool get isGas => widget.categoryType == 'gas';
  bool get isPharmacy => widget.categoryType == 'pharmacy';
  bool get isGrocery => widget.categoryType == 'grocery';
  List<dynamic> _results = [];
  bool _isLoading = true;
  String? _error;
  String _searchQuery = '';
  final String _selectedFuelType = 'regular';
  final int _gallons = 15;
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final listRepo = getIt<ListRepository>();
      final locationService = getIt<LocationService>();
      final settings = getIt<SettingsService>();
      final position = await locationService.getCurrentLocation();
      final lat = position.latitude;
      final lng = position.longitude;

      if (isGas) {
        // Flow 2: Gas True Cost — calls dedicated endpoint
        final response = await listRepo.apiClient.dio.get('/comparison/gas', queryParameters: {
          'lat': lat,
          'lng': lng,
          'gallons': _gallons,
          'fuelType': _selectedFuelType,
          'sortBy': 'true_cost',
          'isRoundTrip': 'true',
          'locationName': await locationService.getLocationName(),
          'preferredRadius': settings.preferredRadius,
        });
        final results = List<dynamic>.from(response.data);
        setState(() {
          _results = results;
          _isLoading = false;
        });
      } else {
        final storeType = isPharmacy ? 'pharmacy' : 'grocery';
        final defaultQuery = isPharmacy ? 'tylenol' : 'milk';
        // Flow 1 + 3: Grocery / Pharmacy search and true-cost compare
        final response = await listRepo.apiClient.dio.get('/comparison/compare', queryParameters: {
          'item': _searchQuery.isNotEmpty ? _searchQuery : defaultQuery,
          'lat': lat,
          'lng': lng,
          'storeType': storeType,
          'sortBy': 'true_cost',
          'isRoundTrip': 'true',
        });
        final results = List<dynamic>.from(response.data);
        setState(() {
          _results = results;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final primaryColor = isGas ? const Color(0xFF2563EB) : const Color(0xFF6A3CE2);
    final title = isGas ? 'Gas Stations' : (isPharmacy ? 'Pharmacies' : 'Grocery Stores');

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        title: Text(title, style: const TextStyle(color: AppTheme.textDark, fontWeight: FontWeight.w900, fontSize: 18)),
        leading: Padding(
          padding: const EdgeInsets.only(left: 16.0, top: 8, bottom: 8),
          child: GestureDetector(
            onTap: () => context.pop(),
            child: Container(
              decoration: BoxDecoration(color: const Color(0xFFF8F9FA), borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.arrow_back, color: AppTheme.textDark, size: 20),
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: _isLoading 
          ? const Center(child: CircularProgressIndicator())
          : _error != null
            ? Center(child: Text(_error!))
            : RefreshIndicator(
                onRefresh: _fetchData,
                child: ListView(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  children: [
                    // Grocery/Pharmacy search bar
                    if (!isGas) Container(
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: TextField(
                        controller: _searchController,
                        onSubmitted: (value) {
                          _searchQuery = value;
                          _fetchData();
                        },
                        decoration: InputDecoration(
                          hintText: isPharmacy
                              ? 'Search pharmacy items (Tylenol, vitamins...)'
                              : 'Search grocery items (milk, eggs, bread...)',
                          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                          prefixIcon: const Icon(Icons.search, color: Color(0xFF6A3CE2)),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                    if (_results.isNotEmpty) _buildHeroCard(_results.first, primaryColor),
                    if (_results.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 48),
                        child: Center(
                          child: Text(
                            'No nearby ${isGas ? 'stations' : (isPharmacy ? 'pharmacies' : 'grocery stores')} found.',
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
                          ),
                        ),
                      ),
                    const SizedBox(height: 32),
                    Text(
                      isGas ? 'All Nearby Stations' : (isPharmacy ? 'All Nearby Pharmacies' : 'All Nearby Grocery Stores'),
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: AppTheme.textDark, letterSpacing: -0.5),
                    ),
                    const SizedBox(height: 16),
                    ..._results.map((item) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _buildListItem(item, isBest: item == _results.first),
                    )),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildHeroCard(Map<String, dynamic> data, Color primaryColor) {
    final store = data['store'];
    final savings = data['savings'] ?? 0;
    final products = (data['products'] as List?) ?? const [];
    final fallbackFuelPrice = products.isNotEmpty ? products.first['price'] : '0.00';
    final distance = (data['driving_distance'] / 2).toStringAsFixed(1);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isPharmacy ? const Color(0xFF6A3CE2) : const Color(0xFF2563EB),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: (isPharmacy ? const Color(0xFF6A3CE2) : const Color(0xFF2563EB)).withValues(alpha: 0.3), 
            blurRadius: 30, 
            offset: const Offset(0, 15)
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(20)),
                child: Text(
                  isGas ? 'BEST DEAL' : 'TOP RATED',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 10, letterSpacing: 0.5),
                ),
              ),
              if (savings > 0) Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                child: Text(
                  'Save \$${savings.toStringAsFixed(2)}',
                  style: TextStyle(color: isPharmacy ? const Color(0xFF6A3CE2) : const Color(0xFF2563EB), fontWeight: FontWeight.bold, fontSize: 11),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            store['name'],
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22, letterSpacing: -0.5),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                isGas ? '\$${data['price_per_gallon'] ?? fallbackFuelPrice}' : '\$${data['true_cost']}',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 48, letterSpacing: -1.5),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 10, left: 4),
                child: Text(
                  isGas ? '/gal' : 'total',
                  style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 20),
                ),
              ),
            ],
          ),
          if (isGas) ...[
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(16)),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildBreakdownCol('Fill-up', '\$${data['fill_up_cost'] ?? data['item_total']}', '${data['gallons'] ?? 15} gal'),
                  Container(height: 32, width: 1, color: Colors.white24),
                  _buildBreakdownCol('Driving', '\$${data['driving_cost']}', '$distance mi'),
                  Container(height: 32, width: 1, color: Colors.white24),
                  _buildBreakdownCol('True Cost', '\$${data['true_cost']}', 'total'),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
          Row(
            children: [
              const Icon(Icons.location_on, color: Colors.white70, size: 16),
              const SizedBox(width: 4),
              Text('$distance miles away', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
              const Spacer(),
              const Icon(Icons.check_circle, color: Colors.white, size: 20),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildBreakdownCol(String label, String value, String subtitle) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w900)),
        Text(subtitle, style: const TextStyle(color: Colors.white54, fontSize: 10)),
      ],
    );
  }

  Widget _buildListItem(Map<String, dynamic> data, {bool isBest = false}) {
    final store = data['store'];
    final price = isGas ? (data['price_per_gallon'] ?? data['products'][0]['price']) : data['true_cost'];
    final distance = (data['driving_distance'] / 2).toStringAsFixed(1);
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.5),
      ),
      child: Row(
        children: [
          StoreLogo(chain: store['chain'], size: 44, padding: 10),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  store['name'],
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppTheme.textDark),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 12, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text('$distance mi \u00B7 \$${data['driving_cost']} trip', style: const TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w500)),
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('\$$price', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppTheme.textDark)),
              Text(isGas ? '/gal' : 'total', style: const TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold)),
            ],
          )
        ],
      ),
    );
  }
}
