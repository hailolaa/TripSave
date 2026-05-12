import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/widgets/shopsave_logo.dart';
import '../bloc/auth_cubit.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

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
          } else if (state is AuthEmailVerificationRequired) {
            context.push('/verify-email', extra: state.email);
          } else if (state is AuthReferralRequired) {
            context.go('/referral');
          } else if (state is AuthPaymentRequired) {
            context.go('/payment');
          } else if (state is AuthError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: Colors.red,
              ),
            );
          }
        },
        child: Stack(
          children: [
            // Top Left Blob
            Positioned(
              top: -150,
              left: -200,
              child: Container(
                width: 400,
                height: 400,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFF1F5F9).withValues(alpha: 0.7),
                ),
              ),
            ),
            // Bottom Blob
            Positioned(
              bottom: -200,
              left: 50,
              right: 0,
              child: Container(
                width: 500,
                height: 500,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFF1F5F9).withValues(alpha: 0.5),
                ),
              ),
            ),
            SafeArea(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final bool isSmall = constraints.maxHeight < 700;
                  return Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Spacer(flex: isSmall ? 1 : 3),
                      ShopSaveLogo(textSize: isSmall ? 24 : 28, iconSize: isSmall ? 40 : 48)
                          .animate()
                          .fadeIn(duration: 800.ms)
                          .slideY(begin: -0.1, end: 0),
                      Spacer(flex: isSmall ? 1 : 2),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24.0),
                        child: Container(
                          width: double.infinity,
                          padding: EdgeInsets.symmetric(horizontal: 24, vertical: isSmall ? 20 : 32),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(32),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.03),
                                blurRadius: 40,
                                offset: const Offset(0, 10),
                                spreadRadius: 0,
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Text(
                                'Create Account',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: isSmall ? 22 : 24,
                                  color: const Color(0xFF111827),
                                  letterSpacing: -0.5,
                                ),
                              ),
                              SizedBox(height: isSmall ? 20 : 32),
                              _buildTextField(
                                controller: _nameController,
                                hint: 'Full Name',
                                icon: Icons.person_outline_rounded,
                                errorText: _nameError,
                                isSmall: isSmall,
                                onChanged: (_) => _clearFieldErrors(),
                              ),
                              SizedBox(height: isSmall ? 10 : 14),
                              _buildTextField(
                                controller: _emailController,
                                hint: 'Email Address',
                                icon: Icons.alternate_email_rounded,
                                keyboardType: TextInputType.emailAddress,
                                errorText: _emailError,
                                isSmall: isSmall,
                                onChanged: (_) => _clearFieldErrors(),
                              ),
                              SizedBox(height: isSmall ? 10 : 14),
                              _buildTextField(
                                controller: _passwordController,
                                hint: 'Password',
                                icon: Icons.lock_outline_rounded,
                                isPassword: true,
                                obscure: _obscurePassword,
                                errorText: _passwordError,
                                isSmall: isSmall,
                                onToggleObscure: () => setState(() => _obscurePassword = !_obscurePassword),
                                onChanged: (_) => _clearFieldErrors(),
                              ),
                              SizedBox(height: isSmall ? 10 : 14),
                              _buildTextField(
                                controller: _confirmPasswordController,
                                hint: 'Confirm Password',
                                icon: Icons.lock_outline_rounded,
                                isPassword: true,
                                obscure: _obscureConfirm,
                                errorText: _confirmError,
                                isSmall: isSmall,
                                onToggleObscure: () => setState(() => _obscureConfirm = !_obscureConfirm),
                                onChanged: (_) => _clearFieldErrors(),
                              ),
                              SizedBox(height: isSmall ? 24 : 32),
                              BlocBuilder<AuthCubit, AuthState>(
                                builder: (context, state) {
                                  final isLoading = state is AuthLoading;
                                  return SizedBox(
                                    width: double.infinity,
                                    height: isSmall ? 48 : 52,
                                    child: ElevatedButton(
                                      onPressed: isLoading ? null : () {
                                        if (_validateLocally()) {
                                          context.read<AuthCubit>().register(
                                            _nameController.text.trim(),
                                            _emailController.text.trim(),
                                            _passwordController.text,
                                            _confirmPasswordController.text,
                                          );
                                        }
                                      },
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF19409B),
                                        foregroundColor: Colors.white,
                                        elevation: 0,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(16),
                                        ),
                                      ),
                                      child: isLoading
                                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                        : const Text(
                                            'Create Account',
                                            style: TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 16,
                                            ),
                                          ),
                                    ),
                                  );
                                },
                              ),
                              const SizedBox(height: 20),
                              Row(
                                children: [
                                  Expanded(child: Divider(color: Colors.grey.shade200)),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 16),
                                    child: Text('OR', style: TextStyle(color: Colors.grey.shade400, fontWeight: FontWeight.w600, fontSize: 12)),
                                  ),
                                  Expanded(child: Divider(color: Colors.grey.shade200)),
                                ],
                              ),
                              const SizedBox(height: 20),
                              BlocBuilder<AuthCubit, AuthState>(
                                builder: (context, state) {
                                  final isLoading = state is AuthLoading;
                                  return SizedBox(
                                    width: double.infinity,
                                    height: 52,
                                    child: OutlinedButton(
                                      onPressed: isLoading ? null : () => context.read<AuthCubit>().signInWithGoogle(),
                                      style: OutlinedButton.styleFrom(
                                        side: BorderSide(color: Colors.grey.shade300),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                      ),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          const Icon(Icons.login, size: 20, color: Color(0xFF374151)), // Placeholder for Google Icon
                                          const SizedBox(width: 12),
                                          const Text(
                                            'Sign up with Google',
                                            style: TextStyle(color: Color(0xFF374151), fontWeight: FontWeight.w600, fontSize: 15),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1, end: 0),
                      ),
                      Spacer(flex: isSmall ? 2 : 3),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text(
                            'Already have an account? ',
                            style: TextStyle(color: Color(0xFF6B7280), fontSize: 14, fontWeight: FontWeight.w500),
                          ),
                          GestureDetector(
                            onTap: () => context.pop(),
                            child: const Text(
                              'Sign In',
                              style: TextStyle(
                                color: Color(0xFF19409B),
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ],
                      ).animate(delay: 400.ms).fadeIn(),
                      Spacer(flex: isSmall ? 1 : 2),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    bool isPassword = false,
    bool obscure = false,
    String? errorText,
    bool isSmall = false,
    VoidCallback? onToggleObscure,
    ValueChanged<String>? onChanged,
  }) {
    final hasError = errorText != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: isSmall ? 48 : 52,
          decoration: BoxDecoration(
            color: const Color(0xFFF3F4F6),
            borderRadius: BorderRadius.circular(16),
            border: hasError ? Border.all(color: Colors.red.shade300, width: 1.5) : null,
          ),
          child: Center(
            child: TextField(
              controller: controller,
              keyboardType: keyboardType,
              obscureText: isPassword ? obscure : false,
              onChanged: onChanged,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: Color(0xFF111827)),
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontWeight: FontWeight.w500, fontSize: 15),
                prefixIcon: Icon(icon, color: const Color(0xFF9CA3AF), size: 20),
                suffixIcon: isPassword
                  ? GestureDetector(
                      onTap: onToggleObscure,
                      child: Icon(obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: const Color(0xFF9CA3AF), size: 20),
                    )
                  : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.only(left: 12),
            child: Text(
              errorText,
              style: const TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ],
    );
  }
}

