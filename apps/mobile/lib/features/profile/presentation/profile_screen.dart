import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/bloc/auth_cubit.dart';
import '../../auth/auth_repository.dart';
import '../../../core/di/injection.dart';
import '../../../core/services/settings_service.dart';
import '../../../core/services/favorite_store_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _userName = '';
  String _userEmail = '';
  Map<String, dynamic>? _profile;
  bool _notificationsEnabled = true;
  bool _locationAccessEnabled = true;
  final SettingsService _settingsService = getIt<SettingsService>();
  final FavoriteStoreService _favoriteStoreService = getIt<FavoriteStoreService>();

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final repo = getIt<AuthRepository>();
    final name = await repo.getUserName();
    final email = await repo.getUserEmail();
    final profile = await repo.getProfile();
    if (mounted) {
      setState(() {
        _userName = name ?? '';
        _userEmail = email ?? '';
        _profile = profile;
      });
      await _syncSettingsFromProfile();
    }
  }

  Future<void> _syncSettingsFromProfile() async {
    if (_profile == null) return;
    final mpg = double.tryParse(_profile?['vehicle_mpg']?.toString() ?? '');
    final gasCostPerMile = double.tryParse(_profile?['gas_cost_per_mile']?.toString() ?? '');
    if (mpg != null && mpg > 0) {
      await _settingsService.setMpg(mpg);
    }
    if (gasCostPerMile != null && gasCostPerMile > 0) {
      await _settingsService.setGasCostPerMile(gasCostPerMile);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('PROFILE', style: GoogleFonts.outfit(color: AppTheme.primaryBlue, fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 1)),
            Text('Settings', style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 24, color: AppTheme.textDark)),
          ],
        ),
        titleSpacing: 20,
        toolbarHeight: 90,
      ),
      body: BlocListener<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state is AuthUnauthenticated) {
            context.go('/login');
          }
        },
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // User Info Card
            GestureDetector(
              onTap: () => _showEditDialog('Name', 'name', '', isText: true),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppTheme.primaryBlue, const Color(0xFF1E40AF)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primaryBlue.withValues(alpha: 0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 64, height: 64,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Center(
                        child: Text(
                          _userName.isNotEmpty ? _userName[0].toUpperCase() : '?',
                          style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 28),
                        ),
                      ),
                    ),
                    const SizedBox(width: 20),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  _userName.isNotEmpty ? _userName : 'Loading...',
                                  style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Icon(Icons.edit_outlined, color: Colors.white.withValues(alpha: 0.6), size: 16),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _userEmail.isNotEmpty ? _userEmail : '',
                            style: GoogleFonts.outfit(color: Colors.white.withValues(alpha: 0.7), fontSize: 14, fontWeight: FontWeight.w500),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ).animate().fadeIn().slideY(begin: 0.1),
            const SizedBox(height: 28).animate(delay: 200.ms).fadeIn(),
            Text('VEHICLE', style: GoogleFonts.outfit(color: Colors.grey.shade500, fontWeight: FontWeight.w700, letterSpacing: 1.2, fontSize: 12)).animate(delay: 300.ms).fadeIn().slideX(begin: 0.1),
            const SizedBox(height: 12),
            _buildSettingsCard([
              _buildSettingRow(
                Icons.directions_car, const Color(0xFFFDECB5), 'Fuel Economy', '${_profile?['vehicle_mpg'] ?? 25} MPG',
                onTap: () => _showEditDialog('Fuel Economy', 'vehicle_mpg', 'MPG'),
              ),
              const Divider(height: 1),
              _buildSettingRow(
                Icons.local_gas_station, const Color(0xFFFDECB5), 'Gas Cost per Mile', '\$${_profile?['gas_cost_per_mile'] ?? '0.10'}',
                onTap: () => _showEditDialog('Gas Cost per Mile', 'gas_cost_per_mile', '\$'),
              ),
            ]).animate(delay: 400.ms).fadeIn().slideX(begin: 0.1),
            const SizedBox(height: 24),
            Text('PREFERENCES', style: GoogleFonts.outfit(color: Colors.grey.shade500, fontWeight: FontWeight.w700, letterSpacing: 1.2, fontSize: 12)).animate(delay: 500.ms).fadeIn().slideX(begin: 0.1),
            const SizedBox(height: 12),
            _buildSettingsCard([
              _buildSettingRow(Icons.favorite_border, const Color(0xFFFFE0E5), 'Favorite Stores', '', onTap: _showFavoriteStoresDialog),
              const Divider(height: 1),
              _buildSettingRow(
                Icons.notifications_none, const Color(0xFFE8DEF8), 'Push Notifications', null, 
                hasSwitch: true, 
                switchVal: _notificationsEnabled,
                onSwitchChanged: (val) {
                  HapticFeedback.lightImpact();
                  setState(() => _notificationsEnabled = val);
                },
              ),
              const Divider(height: 1),
              _buildSettingRow(
                Icons.location_on_outlined, const Color(0xFFD6F3E9), 'Location Access', null, 
                subtitle: _profile?['location_name'] ?? 'Dallas, TX', 
                hasSwitch: true, 
                switchVal: _locationAccessEnabled,
                onSwitchChanged: (val) {
                  HapticFeedback.lightImpact();
                  setState(() => _locationAccessEnabled = val);
                },
              ),
            ]).animate(delay: 600.ms).fadeIn().slideX(begin: 0.1),
            const SizedBox(height: 24),
            Text('ABOUT', style: GoogleFonts.outfit(color: Colors.grey.shade500, fontWeight: FontWeight.w700, letterSpacing: 1.2, fontSize: 12)).animate(delay: 700.ms).fadeIn().slideX(begin: 0.1),
            const SizedBox(height: 12),
            _buildSettingsCard([
              _buildSettingRow(Icons.lock_outline, Colors.grey.shade200, 'Privacy Policy', '', onTap: () => _showInfoDialog('Privacy Policy', 'We value your privacy. Your data is encrypted and never sold.')),
              const Divider(height: 1),
              _buildSettingRow(Icons.description_outlined, Colors.grey.shade200, 'Terms of Service', '', onTap: () => _showInfoDialog('Terms of Service', 'By using TripSave, you agree to save money on every trip!')),
              const Divider(height: 1),
              _buildSettingRow(Icons.info_outline, Colors.grey.shade200, 'Version', '1.0.0', onTap: () => HapticFeedback.vibrate()),
            ]).animate(delay: 800.ms).fadeIn().slideX(begin: 0.1),
            const SizedBox(height: 32),
            // Logout Button
            GestureDetector(
              onTap: () {
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w900)),
                    content: const Text('Are you sure you want to sign out?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        child: Text('Cancel', style: TextStyle(color: Colors.grey.shade600)),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.of(ctx).pop();
                          context.read<AuthCubit>().logout();
                        },
                        child: const Text('Sign Out', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ),
                );
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFCA5A5)),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.logout, color: Color(0xFFDC2626), size: 20),
                    SizedBox(width: 8),
                    Text('Sign Out', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w700, fontSize: 16)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  void _showEditDialog(String title, String key, String suffix, {bool isText = false}) {
    HapticFeedback.mediumImpact();
    final controller = TextEditingController(
      text: key == 'name' ? _userName : (_profile?[key]?.toString() ?? ''),
    );
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Edit $title', style: GoogleFonts.outfit(fontWeight: FontWeight.w900)),
        content: TextField(
          controller: controller,
          keyboardType: isText ? TextInputType.text : TextInputType.number,
          autofocus: true,
          decoration: InputDecoration(
            suffixText: suffix,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final repo = getIt<AuthRepository>();
              final val = isText ? controller.text : (double.tryParse(controller.text) ?? 0.0);
              
              await repo.updateProfile({key: val});
              await _loadUserData();
              await _syncSettingsFromProfile();
              if (!mounted) return;
              if (!ctx.mounted) return;
              Navigator.pop(ctx);
              HapticFeedback.mediumImpact();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('$title updated!'), behavior: SnackBarBehavior.floating),
              );
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showInfoDialog(String title, String message) {
    HapticFeedback.lightImpact();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.w900)),
        content: Text(message, style: GoogleFonts.outfit(fontSize: 16)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Close', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: AppTheme.primaryBlue)),
          ),
        ],
      ),
    );
  }

  void _showFavoriteStoresDialog() {
    final favorites = _favoriteStoreService.getFavoriteStoreNames();
    final prettyFavorites = favorites.map(
      (store) => store
          .split(' ')
          .map((word) => word.isEmpty ? '' : '${word[0].toUpperCase()}${word.substring(1)}')
          .join(' '),
    );

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Favorite Stores', style: GoogleFonts.outfit(fontWeight: FontWeight.w900)),
        content: favorites.isEmpty
            ? const Text('No favorite stores yet. Add favorites from Compare screen.')
            : SizedBox(
                width: double.maxFinite,
                child: ListView(
                  shrinkWrap: true,
                  children: prettyFavorites
                      .map(
                        (store) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              const Icon(Icons.favorite, color: AppTheme.savingsGreen, size: 18),
                              const SizedBox(width: 10),
                              Expanded(child: Text(store)),
                            ],
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Close', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: AppTheme.primaryBlue)),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsCard(List<Widget> children) {
    return Card(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Column(children: children),
    );
  }

  Widget _buildSettingRow(IconData icon, Color iconBg, String title, String? trailingText, {bool hasSwitch = false, bool switchVal = false, ValueChanged<bool>? onSwitchChanged, String? subtitle, VoidCallback? onTap}) {
    return InkWell(
      onTap: () {
        if (!hasSwitch) HapticFeedback.lightImpact();
        if (onTap != null) onTap();
      },
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: Colors.black87, size: 22),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 16, color: AppTheme.textDark)),
                  if (subtitle != null)
                    Text(subtitle, style: GoogleFonts.outfit(fontSize: 13, color: Colors.grey.shade500)),
                ],
              ),
            ),
            if (hasSwitch)
              Switch.adaptive(
                value: switchVal, 
                onChanged: onSwitchChanged, 
                activeThumbColor: AppTheme.primaryBlue,
              )
            else if (trailingText != null && trailingText.isNotEmpty)
              Row(
                children: [
                  Text(trailingText, style: GoogleFonts.outfit(color: Colors.grey.shade600, fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(width: 8),
                  Icon(Icons.chevron_right_rounded, color: Colors.grey.shade400),
                ],
              )
            else
              Icon(Icons.chevron_right_rounded, color: Colors.grey.shade400),
          ],
        ),
      ),
    );
  }
}
