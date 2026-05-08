import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/shopsave_logo.dart';
import '../bloc/auth_cubit.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  String? _emailError;
  String? _passwordError;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _clearFieldErrors() {
    if (_emailError != null || _passwordError != null) {
      setState(() {
        _emailError = null;
        _passwordError = null;
      });
    }
  }

  bool _validateLocally() {
    bool valid = true;
    setState(() {
      _emailError = null;
      _passwordError = null;

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
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: const ShopSaveLogo(textSize: 30, iconSize: 52)
                      .animate()
                      .fadeIn(duration: 420.ms)
                      .slideY(begin: -0.2, end: 0, curve: Curves.easeOutCubic),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Welcome back',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 31,
                    color: AppTheme.textDark,
                    letterSpacing: -0.5,
                  ),
                ).animate(delay: 100.ms).fadeIn(),
                const SizedBox(height: 6),
                Text(
                  'Sign in to continue saving on every trip',
                  style: GoogleFonts.outfit(
                    color: Colors.grey.shade500,
                    fontSize: 15,
                    height: 1.35,
                  ),
                ).animate(delay: 180.ms).fadeIn().slideX(begin: -0.08),
                const SizedBox(height: 22),
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
                const SizedBox(height: 20),
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
                  onChanged: (_) => _clearFieldErrors(),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () {},
                    child: const Text(
                      'Forgot Password?',
                      style: TextStyle(
                        color: AppTheme.primaryBlue,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                // Sign In Button
                BlocBuilder<AuthCubit, AuthState>(
                  builder: (context, state) {
                    final isLoading = state is AuthLoading;
                    return GestureDetector(
                      onTap: isLoading ? null : () {
                        if (_validateLocally()) {
                          context.read<AuthCubit>().login(
                            _emailController.text.trim(),
                            _passwordController.text,
                          );
                        }
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: isLoading
                              ? [AppTheme.primaryBlue.withValues(alpha: 0.6), const Color(0xFF1E40AF).withValues(alpha: 0.6)]
                              : [AppTheme.primaryBlue, const Color(0xFF1E40AF)],
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [BoxShadow(color: AppTheme.primaryBlue.withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 6))],
                        ),
                        child: Center(
                          child: isLoading
                            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                            : const Text('Sign In', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17, letterSpacing: 0.3)),
                        ),
                      ),
                    );
                  },
                ),
                const Spacer(),
                Center(
                  child: GestureDetector(
                    onTap: () => context.push('/register'),
                    child: RichText(
                      text: TextSpan(
                        text: "Don't have an account? ",
                        style: GoogleFonts.outfit(
                          color: Colors.grey.shade500,
                          fontSize: 15,
                        ),
                        children: [
                          TextSpan(
                            text: 'Sign Up',
                            style: GoogleFonts.outfit(
                              color: AppTheme.primaryBlue,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ).animate(delay: 400.ms).fadeIn(),
                const SizedBox(height: 4),
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
