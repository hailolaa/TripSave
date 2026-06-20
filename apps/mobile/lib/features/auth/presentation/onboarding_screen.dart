import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../bloc/auth_cubit.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  int _selectedRadius = 5;

  void _submit() {
    context.read<AuthCubit>().completeOnboarding(_selectedRadius);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: BlocListener<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state is AuthAuthenticated) {
            context.go('/home');
          } else if (state is AuthReferralRequired) {
            context.go('/referral');
          } else if (state is AuthPaymentRequired) {
            context.go('/payment');
          } else if (state is AuthError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: Colors.red),
            );
          }
        },
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight - 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back, color: AppTheme.textDark),
                        onPressed: () => context.read<AuthCubit>().logout(),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              color: AppTheme.savingsGreen.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Icon(Icons.route_outlined, size: 28, color: AppTheme.savingsGreen),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Search Distance',
                                  style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: AppTheme.textDark),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Start nearby. You can change this later.',
                                  style: TextStyle(fontSize: 14, color: Colors.grey, fontWeight: FontWeight.w500),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 28),
                      Text(
                        'How far should PricePilot search?',
                        style: TextStyle(fontSize: 16, color: Colors.grey.shade700, height: 1.35, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 18),
                      _buildRadiusCard(5, 'Nearby', 'Best for quick trips', recommended: true),
                      const SizedBox(height: 12),
                      _buildRadiusCard(10, 'Mid-range', 'Good for a short drive'),
                      const SizedBox(height: 12),
                      _buildRadiusCard(20, 'Maximum', 'Widest search area'),
                      const SizedBox(height: 28),
                      BlocBuilder<AuthCubit, AuthState>(
                        builder: (context, state) {
                          final isLoading = state is AuthLoading;
                          return SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: isLoading ? null : _submit,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.savingsGreen,
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                elevation: 0,
                              ),
                              child: isLoading
                                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                  : const Text('Continue', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 10),
                      Center(
                        child: TextButton(
                          onPressed: () {
                            context.read<AuthCubit>().completeOnboarding(5);
                          },
                          child: Text('Skip for now', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildRadiusCard(int miles, String label, String description, {bool recommended = false}) {
    final isSelected = _selectedRadius == miles;
    return GestureDetector(
      onTap: () => setState(() => _selectedRadius = miles),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.savingsGreen.withValues(alpha: 0.06) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppTheme.savingsGreen : Colors.grey.shade200,
            width: 2,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: isSelected ? AppTheme.savingsGreen : Colors.grey.shade200,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Center(
                child: Text(
                  '$miles',
                  style: TextStyle(
                    color: isSelected ? Colors.white : Colors.grey.shade700,
                    fontWeight: FontWeight.bold,
                    fontSize: 17,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: isSelected ? AppTheme.textDark : Colors.grey.shade800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ),
            if (recommended)
              Container(
                margin: const EdgeInsets.only(right: 10),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.savingsGreen.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text(
                  'Default',
                  style: TextStyle(color: AppTheme.savingsGreen, fontWeight: FontWeight.w800, fontSize: 11),
                ),
              ),
            if (isSelected)
              const Icon(Icons.check_circle, color: AppTheme.savingsGreen, size: 24),
          ],
        ),
      ),
    );
  }
}
