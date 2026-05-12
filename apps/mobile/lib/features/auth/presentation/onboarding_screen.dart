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
  final _mpgController = TextEditingController(text: '25');
  final _gasPriceController = TextEditingController(text: '3.50');

  String? _mpgError;
  String? _gasPriceError;

  @override
  void dispose() {
    _mpgController.dispose();
    _gasPriceController.dispose();
    super.dispose();
  }

  bool _validate() {
    bool isValid = true;
    setState(() {
      _mpgError = null;
      _gasPriceError = null;

      final mpg = double.tryParse(_mpgController.text);
      if (mpg == null || mpg <= 0) {
        _mpgError = 'Please enter a valid MPG (e.g. 25)';
        isValid = false;
      }

      final gasPrice = double.tryParse(_gasPriceController.text.replaceAll('\$', ''));
      if (gasPrice == null || gasPrice <= 0) {
        _gasPriceError = 'Please enter a valid price (e.g. 3.50)';
        isValid = false;
      }
    });
    return isValid;
  }

  void _submit() {
    if (_validate()) {
      final mpg = double.parse(_mpgController.text);
      final gasPrice = double.parse(_gasPriceController.text.replaceAll('\$', ''));
      context.read<AuthCubit>().completeOnboarding(mpg, gasPrice);
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
          child: Padding(
            padding: const EdgeInsets.all(28.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 40),
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppTheme.savingsGreen.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.directions_car, size: 60, color: AppTheme.savingsGreen),
                  ),
                ),
                const SizedBox(height: 32),
                const Center(
                  child: Text(
                    'Set Up Your Vehicle',
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppTheme.textDark),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: Text(
                    'We need this to accurately calculate your true cost and savings for every trip.',
                    style: TextStyle(fontSize: 16, color: Colors.grey.shade600, height: 1.4),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 48),
                _buildLabel('Average Fuel Economy (MPG)'),
                const SizedBox(height: 8),
                _buildTextField(
                  controller: _mpgController,
                  hint: '25',
                  icon: Icons.local_gas_station_outlined,
                  errorText: _mpgError,
                  suffix: const Text('MPG', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                ),
                const SizedBox(height: 24),
                _buildLabel('Default Gas Price'),
                const SizedBox(height: 8),
                _buildTextField(
                  controller: _gasPriceController,
                  hint: '3.50',
                  icon: Icons.attach_money,
                  errorText: _gasPriceError,
                  prefix: const Text('\$ ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                ),
                const Spacer(),
                BlocBuilder<AuthCubit, AuthState>(
                  builder: (context, state) {
                    final isLoading = state is AuthLoading;
                    return SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: isLoading ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.savingsGreen,
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: isLoading
                            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('Complete Setup', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 16),
                Center(
                  child: TextButton(
                    onPressed: () {
                      // Skip with defaults
                      context.read<AuthCubit>().completeOnboarding(25.0, 3.50);
                    },
                    child: Text('Skip for now', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(text, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Colors.grey.shade800));
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    String? errorText,
    Widget? prefix,
    Widget? suffix,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: errorText != null ? Colors.red.shade300 : Colors.transparent),
          ),
          child: TextField(
            controller: controller,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              hintText: hint,
              prefixIcon: Icon(icon, color: Colors.grey.shade600),
              prefix: prefix,
              suffix: suffix,
              suffixIconConstraints: const BoxConstraints(minWidth: 60),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
            ),
          ),
        ),
        if (errorText != null) ...[
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: Text(errorText, style: TextStyle(color: Colors.red.shade600, fontSize: 12, fontWeight: FontWeight.w500)),
          ),
        ],
      ],
    );
  }
}
