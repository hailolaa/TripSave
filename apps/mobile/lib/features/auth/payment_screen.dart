import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'bloc/auth_cubit.dart';
import 'auth_repository.dart';
import '../../core/di/injection.dart';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  CardEditController controller = CardEditController();
  bool _isReady = false;
  bool _isProcessing = false;
  String? _clientSecret;

  @override
  void initState() {
    super.initState();
    _loadSetupIntent();
  }

  Future<void> _loadSetupIntent() async {
    try {
      final secret = await getIt<AuthRepository>().createSetupIntent();
      if (mounted) {
        setState(() {
          _clientSecret = secret;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to initialize payment system. Please try again.')),
        );
      }
    }
  }

  Future<void> _handlePayment() async {
    if (_clientSecret == null) return;

    setState(() => _isProcessing = true);

    try {
      final setupIntent = await Stripe.instance.confirmSetupIntent(
        paymentIntentClientSecret: _clientSecret!,
        params: const PaymentMethodParams.card(
          paymentMethodData: PaymentMethodData(),
        ),
      );

      if (setupIntent.status.toString() == PaymentIntentsStatus.Succeeded.toString()) {
        final paymentMethodId = setupIntent.paymentMethodId;
        if (mounted) {
          await context.read<AuthCubit>().submitPayment(paymentMethodId);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment failed: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: BlocListener<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state is AuthAuthenticated) {
            context.go('/home');
          } else if (state is AuthOnboardingRequired) {
            context.go('/onboarding');
          } else if (state is AuthError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: Colors.red),
            );
          }
        },
        child: BlocBuilder<AuthCubit, AuthState>(
          builder: (context, state) {
            if (state is AuthPaymentSuccess) {
              return _buildSuccessUI();
            }
            return Stack(
              children: [
                Positioned(
                  top: 50,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Container(
                      width: 350,
                      height: 350,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFFF1F5F9).withValues(alpha: 0.6),
                      ),
                    ),
                  ),
                ),
            SafeArea(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final isShort = constraints.maxHeight < 700;
                  return Column(
                    children: [
                      SizedBox(height: isShort ? 12 : 16),
                      // Stepper Indicator
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFF19409B), borderRadius: BorderRadius.circular(2))),
                          const SizedBox(width: 8),
                          Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFF19409B), borderRadius: BorderRadius.circular(2))),
                          const SizedBox(width: 8),
                          Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2))),
                        ],
                      ).animate().fadeIn(),
                      SizedBox(height: isShort ? 20 : 32),
                      Text(
                        '7-Day Free Trial',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: isShort ? 28 : 32,
                          color: const Color(0xFF111827),
                          letterSpacing: -0.5,
                        ),
                      ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1, end: 0),
                      SizedBox(height: isShort ? 8 : 12),
                      Text(
                        'Experience premium savings risk-free.\nThen just \$1.99/month.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: const Color(0xFF6B7280),
                          fontSize: isShort ? 14 : 16,
                          height: 1.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ).animate().fadeIn(delay: 300.ms),
                      SizedBox(height: isShort ? 20 : 32),
                      // Benefits Card
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Container(
                          width: double.infinity,
                          padding: EdgeInsets.all(isShort ? 16 : 24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.04),
                                blurRadius: 40,
                                offset: const Offset(0, 10),
                                spreadRadius: 0,
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _buildBenefitItem('Unlimited price comparisons', isShort),
                              SizedBox(height: isShort ? 12 : 16),
                              _buildBenefitItem('Smart shopping list optimization', isShort),
                              SizedBox(height: isShort ? 12 : 16),
                              _buildBenefitItem('Gas station route planning', isShort),
                              SizedBox(height: isShort ? 12 : 16),
                              _buildBenefitItem('Real-time savings dashboard', isShort),
                            ],
                          ),
                        ).animate().fadeIn(delay: 400.ms).slideY(begin: 0.1, end: 0),
                      ),
                      const Spacer(),
                      // Payment Info Section
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Payment Information',
                              style: TextStyle(
                                color: const Color(0xFF111827),
                                fontSize: isShort ? 16 : 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ).animate().fadeIn(delay: 500.ms),
                            SizedBox(height: isShort ? 12 : 16),
                            Container(
                              width: double.infinity,
                              padding: EdgeInsets.all(isShort ? 16 : 24),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF3F4F6),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: kIsWeb 
                                ? Column(
                                    children: [
                                      Text(
                                        'Card payments on Web are currently\nbeing optimized. Please use our Mobile\nApp for the best experience.',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          color: const Color(0xFF4B5563), 
                                          fontSize: isShort ? 12 : 14,
                                          fontWeight: FontWeight.w600,
                                          height: 1.5,
                                        ),
                                      ),
                                      const SizedBox(height: 16),
                                      TextButton(
                                        onPressed: () => context.read<AuthCubit>().submitPayment('pm_card_visa'),
                                        child: const Text('Bypass for Testing', style: TextStyle(fontWeight: FontWeight.bold)),
                                      ),
                                    ],
                                  )
                                : CardField(
                                    controller: controller,
                                    style: const TextStyle(color: Color(0xFF111827), fontSize: 16),
                                    decoration: InputDecoration(
                                      border: InputBorder.none,
                                      hintStyle: const TextStyle(color: Color(0xFF9CA3AF)),
                                    ),
                                    onCardChanged: (card) {
                                      setState(() {
                                        _isReady = card?.complete ?? false;
                                      });
                                    },
                                  ),
                            ).animate().fadeIn(delay: 600.ms),
                          ],
                        ),
                      ),
                      SizedBox(height: isShort ? 16 : 24),
                      // Bottom Button
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 24.0, vertical: isShort ? 8.0 : 12.0),
                        child: BlocBuilder<AuthCubit, AuthState>(
                          builder: (context, state) {
                            final isLoading = _isProcessing || state is AuthLoading;
                            final isEnabled = _isReady && !isLoading && _clientSecret != null;
                            return SizedBox(
                              width: double.infinity,
                              height: isShort ? 48 : 56,
                              child: ElevatedButton(
                                onPressed: isEnabled ? _handlePayment : null,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF19409B),
                                  disabledBackgroundColor: const Color(0xFFD1D5DB), // Matches the screenshot disabled gray
                                  disabledForegroundColor: Colors.white,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                ),
                                child: isLoading
                                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                  : Text(
                                      'Start My Free Trial',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: isShort ? 15 : 16,
                                      ),
                                    ),
                              ),
                            );
                          },
                        ).animate().fadeIn(delay: 800.ms),
                      ),
                      SizedBox(height: isShort ? 4 : 12),
                    ],
                  );
                },
              ),
            ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildSuccessUI() {
    return Container(
      width: double.infinity,
      color: Colors.white,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: const BoxDecoration(
              color: Color(0xFF10B981),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_rounded, color: Colors.white, size: 64),
          ).animate().scale(duration: 600.ms, curve: Curves.easeOutBack),
          const SizedBox(height: 32),
          const Text(
            'Trial Activated!',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Color(0xFF111827),
            ),
          ).animate().fadeIn(delay: 400.ms),
          const SizedBox(height: 16),
          const Text(
            'Welcome to TripSave Premium.\nYour 7-day free trial has started.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 16,
              color: Color(0xFF6B7280),
              height: 1.5,
            ),
          ).animate().fadeIn(delay: 600.ms),
          const SizedBox(height: 48),
          const CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF19409B)),
          ).animate().fadeIn(delay: 800.ms),
        ],
      ),
    );
  }

  Widget _buildBenefitItem(String text, bool isShort) {
    return Row(
      children: [
        Container(
          width: isShort ? 20 : 24,
          height: isShort ? 20 : 24,
          decoration: const BoxDecoration(
            color: Color(0xFF10B981), // Emerald green
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.check_rounded, color: Colors.white, size: isShort ? 14 : 16),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              color: const Color(0xFF111827),
              fontSize: isShort ? 14 : 15,
              fontWeight: FontWeight.w700, // Bold as in screenshot
            ),
          ),
        ),
      ],
    );
  }
}

