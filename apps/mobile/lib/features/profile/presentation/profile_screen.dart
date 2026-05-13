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
import '../../../core/services/location_service.dart';
import '../../notifications/bloc/notification_cubit.dart';

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
  String _currentLocationName = 'Detecting...';
  Map<String, dynamic>? _paymentMethod;
  final SettingsService _settingsService = getIt<SettingsService>();
  final FavoriteStoreService _favoriteStoreService = getIt<FavoriteStoreService>();
  final LocationService _locationService = getIt<LocationService>();

  @override
  void initState() {
    super.initState();
    _loadUserData();
    _loadLocation();
  }

  Future<void> _loadLocation() async {
    final name = await _locationService.getLocationName();
    if (mounted) {
      setState(() {
        _currentLocationName = name;
      });
    }
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
      _loadPaymentMethod();
    }
  }

  Future<void> _loadPaymentMethod() async {
    final repo = getIt<AuthRepository>();
    final pm = await repo.getPaymentMethod();
    if (mounted) {
      setState(() {
        _paymentMethod = pm;
      });
    }
  }

  Future<void> _syncSettingsFromProfile() async {
    if (_profile == null) return;
    final radius = int.tryParse(_profile?['preferred_radius']?.toString() ?? '20') ?? 20;
    await _settingsService.setPreferredRadius(radius);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Profile', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 32, color: AppTheme.textDark, letterSpacing: -0.5)),
            Text('Account & app settings', style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
          ],
        ),
        titleSpacing: 20,
        toolbarHeight: 90,
      ),
      body: Stack(
        children: [
          // Background Blobs
          Positioned(
            top: -40,
            right: -20,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                color: AppTheme.primaryBlue.withValues(alpha: 0.04),
                shape: BoxShape.circle,
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
             .moveX(begin: 0, end: -15, duration: 10.seconds, curve: Curves.easeInOut)
             .moveY(begin: 0, end: 25, duration: 12.seconds, curve: Curves.easeInOut),
          ),
          Positioned(
            bottom: 120,
            left: -40,
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                color: const Color(0xFF6366F1).withValues(alpha: 0.03),
                shape: BoxShape.circle,
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
             .moveX(begin: 0, end: 20, duration: 8.seconds, curve: Curves.easeInOut)
             .moveY(begin: 0, end: -15, duration: 10.seconds, curve: Curves.easeInOut),
          ),

          BlocListener<AuthCubit, AuthState>(
            listener: (context, state) {
          if (state is AuthUnauthenticated) {
            context.go('/login');
          } else if (state is AuthError) {
             ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: Colors.red),
            );
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
            ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.1)
             .animate(onPlay: (c) => c.repeat(reverse: true))
             .moveY(begin: 0, end: -4, duration: 5.seconds, curve: Curves.easeInOut),
            const SizedBox(height: 28).animate(delay: 200.ms).fadeIn(),
            Text('SEARCH SETTINGS', style: GoogleFonts.outfit(color: Colors.grey.shade500, fontWeight: FontWeight.w700, letterSpacing: 1.2, fontSize: 12)).animate(delay: 300.ms).fadeIn().slideX(begin: 0.1),
            const SizedBox(height: 12),
            _buildSettingsCard([
              _buildSettingRow(
                Icons.map_outlined, const Color(0xFFD6F3E9), 'Search Radius', '${_profile?['preferred_radius'] ?? 20} miles',
                onTap: _showRadiusDialog,
              ),
              const Divider(height: 1),
              _buildSettingRow(
                Icons.attach_money, const Color(0xFFE0E7FF), 'Drive Cost Rate', '\$0.72/mile',
                subtitle: 'Fixed rate for accurate calculations',
                onTap: () => _showInfoDialog('Drive Cost', 'TripSave uses a fixed rate of \$0.72 per mile to calculate your driving costs. This includes fuel, maintenance, and vehicle wear.'),
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
                  if (val) {
                    context.read<NotificationCubit>().requestPermission();
                  }
                },
              ),
              const Divider(height: 1),
              _buildSettingRow(
                Icons.location_on_outlined, const Color(0xFFD6F3E9), 'Location Access', null, 
                subtitle: _currentLocationName, 
                hasSwitch: true, 
                switchVal: _locationAccessEnabled,
                onSwitchChanged: (val) {
                  HapticFeedback.lightImpact();
                  setState(() => _locationAccessEnabled = val);
                },
              ),
            ]).animate(delay: 600.ms).fadeIn().slideX(begin: 0.1),
            const SizedBox(height: 24),
            Text('SUBSCRIPTION', style: GoogleFonts.outfit(color: Colors.grey.shade500, fontWeight: FontWeight.w700, letterSpacing: 1.2, fontSize: 12)).animate(delay: 650.ms).fadeIn().slideX(begin: 0.1),
            const SizedBox(height: 12),
            _buildSettingsCard([
              _buildSettingRow(
                Icons.credit_card, const Color(0xFFE0E7FF), 
                _paymentMethod != null ? '${_paymentMethod!['brand'].toString().toUpperCase()} •••• ${_paymentMethod!['last4']}' : 'Payment Method', 
                _profile?['subscription_status'] == 'trialing' ? 'Free Trial' : 'Active',
                onTap: () => context.push('/payment?isUpdating=true'),
              ),
              if (_profile?['subscription_status'] != 'none' && _profile?['subscription_status'] != 'canceled')
                const Divider(height: 1),
              if (_profile?['subscription_status'] != 'none' && _profile?['subscription_status'] != 'canceled')
                _buildSettingRow(
                  Icons.cancel_outlined, const Color(0xFFFEF2F2), 'Stop Subscription', null,
                  onTap: _showStopSubscriptionDialog,
                ),
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: Colors.blue, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _profile?['subscription_status'] == 'canceled' 
                          ? 'Your subscription has been canceled.'
                          : _profile?['trial_end_date'] != null 
                            ? 'Your free trial ends on ${DateTime.parse(_profile!['trial_end_date']).toLocal().toString().split(' ')[0]}' 
                            : 'Subscription is active.',
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ]).animate(delay: 700.ms).fadeIn().slideX(begin: 0.1),
            const SizedBox(height: 24),
            Text('ABOUT', style: GoogleFonts.outfit(color: Colors.grey.shade500, fontWeight: FontWeight.w700, letterSpacing: 1.2, fontSize: 12)).animate(delay: 750.ms).fadeIn().slideX(begin: 0.1),
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
    ],
  ),
);
}

  void _showRadiusDialog() {
    HapticFeedback.mediumImpact();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text('Search Radius', style: GoogleFonts.outfit(fontWeight: FontWeight.w900)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [5, 10, 20].map((radius) {
            final isSelected = (_profile?['preferred_radius'] ?? 20) == radius;
            return ListTile(
              title: Text('$radius Miles', style: GoogleFonts.outfit(fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
              trailing: isSelected ? const Icon(Icons.check_circle, color: AppTheme.savingsGreen) : null,
              onTap: () async {
                final repo = getIt<AuthRepository>();
                await repo.updateProfile({'preferred_radius': radius});
                await _loadUserData();
                await _syncSettingsFromProfile();
                if (!mounted) return;
                if (!ctx.mounted) return;
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Radius updated to $radius miles!'), behavior: SnackBarBehavior.floating),
                );
              },
            );
          }).toList(),
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

  void _showStopSubscriptionDialog() {
    HapticFeedback.heavyImpact();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Stop Subscription', style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('Stopping your subscription will cancel all premium features. You will be signed out automatically.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Keep it')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<AuthCubit>().cancelSubscription();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
            child: const Text('Stop & Sign Out'),
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
