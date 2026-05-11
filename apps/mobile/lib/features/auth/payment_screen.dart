import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:flutter/foundation.dart';
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
      // 1. Confirm the setup intent on the client side
      final setupIntent = await Stripe.instance.confirmSetupIntent(
        paymentIntentClientSecret: _clientSecret!,
        params: PaymentMethodParams.card(
          paymentMethodData: PaymentMethodData(),
        ),
      );

      if (setupIntent.status == PaymentIntentsStatus.Succeeded) {
        final paymentMethodId = setupIntent.paymentMethodId;
        if (paymentMethodId != null) {
          // 2. Send the payment method ID to our backend to start the trial
          if (mounted) {
            await context.read<AuthCubit>().submitPayment(paymentMethodId);
          }
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
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Payment Information', style: TextStyle(color: Colors.white)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.lock_outline, color: Colors.blue, size: 48),
              const SizedBox(height: 24),
              Text(
                'Start your 7-day free trial',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Add a payment method to unlock TripSave. You will not be charged today. Billing starts automatically after 7 days.',
                style: TextStyle(color: Colors.white70, fontSize: 16),
              ),
              const SizedBox(height: 40),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white12),
                ),
                child: kIsWeb 
                  ? Column(
                      children: [
                        const Icon(Icons.computer, color: Colors.amber, size: 48),
                        const SizedBox(height: 16),
                        const Text(
                          'Stripe Card Form is mobile-only',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'For security, the custom card field is only available on Android and iOS apps. On Web, please use the "Test Bypass" below to continue development.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        const SizedBox(height: 16),
                        TextButton(
                          onPressed: () => context.read<AuthCubit>().submitPayment('pm_card_visa'),
                          child: const Text('Bypass Payment (Test Mode)'),
                        ),
                      ],
                    )
                  : Column(
                      children: [
                        CardField(
                          controller: controller,
                          style: const TextStyle(color: Colors.white, fontSize: 16),
                          onCardChanged: (card) {
                            setState(() {
                              _isReady = card?.complete ?? false;
                            });
                          },
                        ),
                      ],
                    ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  const Icon(Icons.security, color: Colors.green, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    'Secured by Stripe',
                    style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 60),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: (_isReady && !_isProcessing && _clientSecret != null)
                      ? _handlePayment
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    disabledBackgroundColor: Colors.white10,
                  ),
                  child: _isProcessing
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text(
                          'Start Free Trial',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
              const SizedBox(height: 20),
              const Center(
                child: Text(
                  'Cancel anytime in Profile settings.',
                  style: TextStyle(color: Colors.white38, fontSize: 14),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
