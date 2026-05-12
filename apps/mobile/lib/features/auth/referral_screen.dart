import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'bloc/auth_cubit.dart';
import '../../core/theme/app_theme.dart';

class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key});

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> {
  String? _selectedSource;
  final List<Map<String, dynamic>> _sources = [
    {'title': 'App Store / Google Play', 'icon': Icons.storefront_rounded},
    {'title': 'Friend or Family', 'icon': Icons.people_outline_rounded},
    {'title': 'Social Media', 'icon': Icons.share_rounded},
    {'title': 'YouTube', 'icon': Icons.play_circle_outline_rounded},
    {'title': 'Other', 'icon': Icons.more_horiz_rounded},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: BlocListener<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state is AuthPaymentRequired) {
            context.go('/payment');
          } else if (state is AuthAuthenticated) {
            context.go('/home');
          } else if (state is AuthOnboardingRequired) {
            context.go('/onboarding');
          } else if (state is AuthError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: Colors.red),
            );
          }
        },
        child: Stack(
          children: [
            // Center Faint Blob behind the icon
            Positioned(
              top: 50,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  width: 300,
                  height: 300,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFF1F5F9).withValues(alpha: 0.6),
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Column(
                children: [
                  const SizedBox(height: 16),
                  // Stepper Indicator
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFF19409B), borderRadius: BorderRadius.circular(2))),
                      const SizedBox(width: 8),
                      Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2))),
                      const SizedBox(width: 8),
                      Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2))),
                    ],
                  ).animate().fadeIn(),
                  const SizedBox(height: 40),
                  // Megaphone Icon
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF19409B).withValues(alpha: 0.1),
                          blurRadius: 30,
                          spreadRadius: 10,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.campaign_rounded, color: Color(0xFF19409B), size: 40),
                  ).animate().scale(delay: 200.ms, curve: Curves.easeOutBack),
                  const SizedBox(height: 24),
                  const Text(
                    'How did you find us?',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 28,
                      color: Color(0xFF111827),
                      letterSpacing: -0.5,
                    ),
                  ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.1, end: 0),
                  const SizedBox(height: 8),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 40),
                    child: Text(
                      'This helps us improve and reach more savers like you.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color(0xFF6B7280),
                        fontSize: 15,
                        height: 1.4,
                      ),
                    ),
                  ).animate().fadeIn(delay: 400.ms),
                  const SizedBox(height: 32),
                  // List of Options
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      itemCount: _sources.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 16),
                      itemBuilder: (context, index) {
                        final sourceData = _sources[index];
                        final title = sourceData['title'] as String;
                        final icon = sourceData['icon'] as IconData;
                        final isSelected = _selectedSource == title;

                        return GestureDetector(
                          onTap: () => setState(() => _selectedSource = title),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                            decoration: BoxDecoration(
                              color: isSelected ? const Color(0xFFEFF6FF) : const Color(0xFFF9FAFB),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isSelected ? const Color(0xFF19409B).withValues(alpha: 0.3) : Colors.transparent,
                                width: 1.5,
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: isSelected ? const Color(0xFFDBEAFE) : Colors.transparent,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    icon,
                                    color: isSelected ? const Color(0xFF19409B) : const Color(0xFF9CA3AF),
                                    size: 24,
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Text(
                                    title,
                                    style: TextStyle(
                                      color: isSelected ? const Color(0xFF19409B) : const Color(0xFF111827),
                                      fontSize: 16,
                                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                                    ),
                                  ),
                                ),
                                Container(
                                  width: 24,
                                  height: 24,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: isSelected ? const Color(0xFF19409B) : Colors.transparent,
                                    border: Border.all(
                                      color: isSelected ? const Color(0xFF19409B) : const Color(0xFFD1D5DB),
                                      width: 2,
                                    ),
                                  ),
                                  child: isSelected
                                      ? const Icon(Icons.check_rounded, color: Colors.white, size: 16)
                                      : null,
                                ),
                              ],
                            ),
                          ),
                        ).animate().fadeIn(delay: (400 + (100 * index)).ms).slideX(begin: 0.1, end: 0);
                      },
                    ),
                  ),
                  // Bottom Button
                  Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: BlocBuilder<AuthCubit, AuthState>(
                      builder: (context, state) {
                        final isLoading = state is AuthLoading;
                        return SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed: (isLoading || _selectedSource == null) 
                              ? null 
                              : () => context.read<AuthCubit>().submitReferral(_selectedSource!),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF19409B),
                              disabledBackgroundColor: const Color(0xFF19409B).withValues(alpha: 0.5),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: isLoading
                              ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                              : const Text(
                                  'Continue',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 16,
                                  ),
                                ),
                          ),
                        );
                      },
                    ).animate().fadeIn(delay: 800.ms),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
