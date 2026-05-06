import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/location_service.dart';
import '../../compare/bloc/comparison_cubit.dart';
import '../../list/list_repository.dart';
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
  List<dynamic> _results = [];
  bool _isLoading = true;
  String? _error;
  String _searchQuery = '';
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
      final position = await locationService.getCurrentLocation();
      final lat = position.latitude;
      final lng = position.longitude;

      if (isGas) {
        // Flow 2: Gas True Cost — calls dedicated endpoint
        final response = await listRepo.apiClient.dio.get('/comparison/gas', queryParameters: {
          'lat': lat,
          'lng': lng,
          'gallons': 15,
          'fuelType': 'regular',
        });
        final results = List<dynamic>.from(response.data);
        setState(() {
          _results = results;
          _isLoading = false;
        });
      } else {
        // Flow 3: Pharmacy — search common OTC items across pharmacy stores
        final response = await listRepo.apiClient.dio.get('/comparison/compare', queryParameters: {
          'item': _searchQuery.isNotEmpty ? _searchQuery : 'tylenol',
          'lat': lat,
          'lng': lng,
          'storeType': 'pharmacy',
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
    final title = isGas ? 'Gas Stations' : 'Pharmacies';

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
                    // Pharmacy search bar
                    if (isPharmacy) Container(
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
                          hintText: 'Search pharmacy items (Tylenol, vitamins...)',
                          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                          prefixIcon: const Icon(Icons.search, color: Color(0xFF6A3CE2)),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                    if (_results.isNotEmpty) _buildHeroCard(_results.first, primaryColor),
                    const SizedBox(height: 32),
                    Text(isGas ? 'All Nearby Stations' : 'All Nearby Pharmacies', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: AppTheme.textDark, letterSpacing: -0.5)),
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

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: primaryColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [BoxShadow(color: primaryColor.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(isGas ? 'BEST GAS DEAL NEARBY' : 'BEST PHARMACY NEARBY', 
                    style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 11, letterSpacing: 0.5)),
              ),
              if (savings > 0) Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(12)),
                child: Text('Save \$${savings.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Icon(isGas ? Icons.local_gas_station_outlined : Icons.local_pharmacy_outlined, color: Colors.white, size: 24),
              const SizedBox(width: 8),
              Flexible(child: Text(store['name'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 24), overflow: TextOverflow.ellipsis)),
            ],
          ),
          const SizedBox(height: 16),
          if (isGas) ...[
            // Gas: show price/gal prominently
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('\$${data['price_per_gallon'] ?? data['products'][0]['price']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 44, letterSpacing: -1)),
                const Padding(
                  padding: EdgeInsets.only(bottom: 8),
                  child: Text('/gal', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 24)),
                ),
                const Spacer(),
              ],
            ),
            const SizedBox(height: 16),
            // Gas fill-up breakdown
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(16)),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildBreakdownCol('Fill-up', '\$${data['fill_up_cost'] ?? data['item_total']}', '${data['gallons'] ?? 15} gal'),
                  Container(height: 30, width: 1, color: Colors.white30),
                  _buildBreakdownCol('Drive', '\$${data['driving_cost']}', '${(data['driving_distance'] / 2).toStringAsFixed(1)} mi'),
                  Container(height: 30, width: 1, color: Colors.white30),
                  _buildBreakdownCol('True Cost', '\$${data['true_cost']}', 'total'),
                ],
              ),
            ),
          ],
          if (!isGas) ...[
            const Text('True Total', style: TextStyle(color: Colors.white70, fontSize: 13)),
            Text('\$${data['true_cost']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 44, letterSpacing: -1)),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                child: Row(
                  children: [
                    const Icon(Icons.location_on_outlined, color: Colors.white, size: 14),
                    const SizedBox(width: 6),
                    Text('${(data['driving_distance'] / 2).toStringAsFixed(1)} mi away', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 12)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                child: Row(
                  children: [
                    Icon(Icons.directions_car_outlined, color: Colors.white.withOpacity(0.8), size: 14),
                    const SizedBox(width: 6),
                    Text('\$${data['driving_cost']} fuel', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 12)),
                  ],
                ),
              ),
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
    final bgColor = isGas ? const Color(0xFFEFF6FF) : const Color(0xFFF3E8FF);
    final iconColor = isGas ? const Color(0xFF2563EB) : const Color(0xFF6A3CE2);
    final price = isGas ? (data['price_per_gallon'] ?? data['products'][0]['price']) : data['true_cost'];
    
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(16)),
            child: Icon(isGas ? Icons.local_gas_station_outlined : Icons.local_pharmacy_outlined, color: iconColor, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(child: Text(store['name'], style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18), overflow: TextOverflow.ellipsis)),
                    if (isBest) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: AppTheme.savingsGreen.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                        child: const Text('Best', style: TextStyle(color: AppTheme.savingsGreen, fontWeight: FontWeight.bold, fontSize: 10)),
                      )
                    ]
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 12, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text('${(data['driving_distance'] / 2).toStringAsFixed(1)} mi \u00B7 \$${data['driving_cost']} trip', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                  ],
                ),
                if (isGas) ...[
                   const SizedBox(height: 4),
                   Text('Fill-up total: \$${data['true_cost']}', style: TextStyle(color: AppTheme.savingsGreen, fontWeight: FontWeight.bold, fontSize: 12)),
                ]
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('\$$price', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22, color: AppTheme.textDark)),
              Text(isGas ? '/gal' : 'total', style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          )
        ],
      ),
    );
  }
}
