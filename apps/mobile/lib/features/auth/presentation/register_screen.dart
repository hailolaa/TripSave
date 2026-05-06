import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../bloc/auth_cubit.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({Key? key}) : super(key: key);

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirm = true;

  String? _nameError;
  String? _emailError;
  String? _passwordError;
  String? _confirmError;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _clearFieldErrors() {
    if (_nameError != null || _emailError != null || _passwordError != null || _confirmError != null) {
      setState(() {
        _nameError = null;
        _emailError = null;
        _passwordError = null;
        _confirmError = null;
      });
    }
  }

  bool _validateLocally() {
    bool valid = true;
    setState(() {
      _nameError = null;
      _emailError = null;
      _passwordError = null;
      _confirmError = null;

      if (_nameController.text.trim().isEmpty) {
        _nameError = 'Name is required';
        valid = false;
      } else if (_nameController.text.trim().length < 2) {
        _nameError = 'Name must be at least 2 characters';
        valid = false;
      }

      if (_emailController.text.trim().isEmpty) {
        _emailError = 'Email is required';
        valid = false;
      } else if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(_emailController.text.trim())) {
        _emailError = 'Enter a valid email address';
        valid = false;
      }

      if (_passwordController.text.isEmpty) {
        _passwordError = 'Password is required';
        valid = false;
      } else if (_passwordController.text.length < 6) {
        _passwordError = 'Must be at least 6 characters';
        valid = false;
      }

      if (_confirmPasswordController.text.isEmpty) {
        _confirmError = 'Please confirm your password';
        valid = false;
      } else if (_passwordController.text != _confirmPasswordController.text) {
        _confirmError = 'Passwords do not match';
        valid = false;
      }
    });
    return valid;
  }

  // Password strength calculation
  double get _passwordStrength {
    final password = _passwordController.text;
    if (password.isEmpty) return 0;
    double strength = 0;
    if (password.length >= 6) strength += 0.25;
    if (password.length >= 10) strength += 0.25;
    if (RegExp(r'[A-Z]').hasMatch(password)) strength += 0.25;
    if (RegExp(r'[0-9!@#$%^&*(),.?":{}|<>]').hasMatch(password)) strength += 0.25;
    return strength;
  }

  String get _strengthLabel {
    if (_passwordStrength <= 0) return '';
    if (_passwordStrength <= 0.25) return 'Weak';
    if (_passwordStrength <= 0.5) return 'Fair';
    if (_passwordStrength <= 0.75) return 'Good';
    return 'Strong';
  }

  Color get _strengthColor {
    if (_passwordStrength <= 0.25) return const Color(0xFFDC2626);
    if (_passwordStrength <= 0.5) return const Color(0xFFF59E0B);
    if (_passwordStrength <= 0.75) return const Color(0xFF3B82F6);
    return AppTheme.savingsGreen;
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
              SnackBar(
                content: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.white, size: 20),
                    const SizedBox(width: 12),
                    Expanded(child: Text(state.message, style: const TextStyle(fontWeight: FontWeight.w600))),
                  ],
                ),
                backgroundColor: const Color(0xFFDC2626),
                behavior: SnackBarBehavior.floating,
                margin: const EdgeInsets.all(16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                duration: const Duration(seconds: 4),
              ),
            );
          }
        },
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 20),
                // Back Button
                GestureDetector(
                  onTap: () => context.pop(),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: const Color(0xFFF8F9FA), borderRadius: BorderRadius.circular(12)),
                    child: const Icon(Icons.arrow_back, color: AppTheme.textDark, size: 20),
                  ),
                ),
                const SizedBox(height: 28),
                // Header
                const Text('Create Account', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 28, color: AppTheme.textDark, letterSpacing: -0.5)),
                const SizedBox(height: 8),
                Text('Start saving on every shopping trip', style: TextStyle(color: Colors.grey.shade500, fontSize: 16, height: 1.4)),
                const SizedBox(height: 32),
                // Name Field
                _buildLabel('Full Name'),
                const SizedBox(height: 8),
                _buildTextField(
                  controller: _nameController,
                  hint: 'John Doe',
                  icon: Icons.person_outline,
                  errorText: _nameError,
                  onChanged: (_) => _clearFieldErrors(),
                ),
                const SizedBox(height: 18),
                // Email Field
                _buildLabel('Email'),
                const SizedBox(height: 8),
                _buildTextField(
                  controller: _emailController,
                  hint: 'you@example.com',
                  icon: Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress,
                  errorText: _emailError,
                  onChanged: (_) => _clearFieldErrors(),
                ),
                const SizedBox(height: 18),
                // Password Field
                _buildLabel('Password'),
                const SizedBox(height: 8),
                _buildTextField(
                  controller: _passwordController,
                  hint: '••••••••',
                  icon: Icons.lock_outline,
                  isPassword: true,
                  obscure: _obscurePassword,
                  errorText: _passwordError,
                  onToggleObscure: () => setState(() => _obscurePassword = !_obscurePassword),
                  onChanged: (_) {
                    _clearFieldErrors();
                    setState(() {});
                  },
                ),
                // Password Strength Indicator
                if (_passwordController.text.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: _passwordStrength,
                            backgroundColor: Colors.grey.shade200,
                            color: _strengthColor,
                            minHeight: 4,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(_strengthLabel, style: TextStyle(color: _strengthColor, fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ],
                const SizedBox(height: 18),
                // Confirm Password Field
                _buildLabel('Confirm Password'),
                const SizedBox(height: 8),
                _buildTextField(
                  controller: _confirmPasswordController,
                  hint: '••••••••',
                  icon: Icons.lock_outline,
                  isPassword: true,
                  obscure: _obscureConfirm,
                  errorText: _confirmError,
                  onToggleObscure: () => setState(() => _obscureConfirm = !_obscureConfirm),
                  onChanged: (_) => _clearFieldErrors(),
                ),
                const SizedBox(height: 24),
                // Vehicle Info Banner
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.savingsGreen.withOpacity(0.06),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.savingsGreen.withOpacity(0.15)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppTheme.savingsGreen.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.directions_car_outlined, color: AppTheme.savingsGreen, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text("You'll set up your vehicle details after sign up to calculate true trip costs!", style: TextStyle(color: Colors.grey.shade700, fontSize: 13, height: 1.4)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),
                // Create Account Button
                BlocBuilder<AuthCubit, AuthState>(
                  builder: (context, state) {
                    final isLoading = state is AuthLoading;
                    return GestureDetector(
                      onTap: isLoading ? null : () {
                        if (_validateLocally()) {
                          context.read<AuthCubit>().register(
                            _nameController.text.trim(),
                            _emailController.text.trim(),
                            _passwordController.text,
                            _confirmPasswordController.text,
                          );
                        }
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: isLoading
                              ? [AppTheme.savingsGreen.withOpacity(0.6), const Color(0xFF059669).withOpacity(0.6)]
                              : [AppTheme.savingsGreen, const Color(0xFF059669)],
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [BoxShadow(color: AppTheme.savingsGreen.withOpacity(0.3), blurRadius: 16, offset: const Offset(0, 6))],
                        ),
                        child: Center(
                          child: isLoading
                            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                            : const Text('Create Account', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17, letterSpacing: 0.3)),
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 20),
                // Terms
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: RichText(
                      textAlign: TextAlign.center,
                      text: TextSpan(
                        text: 'By creating an account, you agree to our ',
                        style: TextStyle(color: Colors.grey.shade400, fontSize: 12, height: 1.5),
                        children: [
                          TextSpan(text: 'Terms of Service', style: TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.w600)),
                          TextSpan(text: ' and ', style: TextStyle(color: Colors.grey.shade400)),
                          TextSpan(text: 'Privacy Policy', style: TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                // Sign In Link
                Center(
                  child: GestureDetector(
                    onTap: () => context.pop(),
                    child: RichText(
                      text: TextSpan(
                        text: 'Already have an account? ',
                        style: TextStyle(color: Colors.grey.shade500, fontSize: 15),
                        children: const [
                          TextSpan(text: 'Sign In', style: TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(text, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Colors.grey.shade700));
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    bool isPassword = false,
    bool obscure = false,
    String? errorText,
    VoidCallback? onToggleObscure,
    ValueChanged<String>? onChanged,
  }) {
    final hasError = errorText != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            color: hasError ? const Color(0xFFFEF2F2) : const Color(0xFFF8F9FA),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: hasError ? const Color(0xFFFCA5A5) : Colors.grey.shade200, width: hasError ? 1.5 : 1),
          ),
          child: TextField(
            controller: controller,
            keyboardType: keyboardType,
            obscureText: isPassword ? obscure : false,
            onChanged: onChanged,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: TextStyle(color: Colors.grey.shade400),
              prefixIcon: Icon(icon, color: hasError ? const Color(0xFFDC2626) : Colors.grey.shade400, size: 20),
              suffixIcon: isPassword
                ? GestureDetector(
                    onTap: onToggleObscure,
                    child: Icon(obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: Colors.grey.shade400, size: 20),
                  )
                : null,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
            ),
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: Row(
              children: [
                const Icon(Icons.error_outline, size: 14, color: Color(0xFFDC2626)),
                const SizedBox(width: 6),
                Text(errorText, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
