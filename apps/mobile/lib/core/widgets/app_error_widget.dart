import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

class AppErrorWidget extends StatefulWidget {
  final String message;
  final VoidCallback? onRetry;
  final bool isFullPage;
  final IconData? icon;
  final String? title;

  const AppErrorWidget({
    super.key,
    required this.message,
    this.onRetry,
    this.isFullPage = true,
    this.icon,
    this.title,
  });

  @override
  State<AppErrorWidget> createState() => _AppErrorWidgetState();
}

class _AppErrorWidgetState extends State<AppErrorWidget> with SingleTickerProviderStateMixin {
  bool _showDetails = false;
  late AnimationController _fadeController;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isOffline = widget.message.toLowerCase().contains('connection') || 
                      widget.message.toLowerCase().contains('internet') || 
                      widget.message.toLowerCase().contains('offline');
                      
    final isServerError = widget.message.toLowerCase().contains('server error') || 
                          widget.message.toLowerCase().contains('500') ||
                          widget.message.toLowerCase().contains('unable to connect');

    IconData errorIcon = widget.icon ?? (
      isOffline 
        ? Icons.wifi_off_rounded 
        : isServerError 
          ? Icons.dns_rounded 
          : Icons.error_outline_rounded
    );

    String errorTitle = widget.title ?? (
      isOffline 
        ? 'Connection Lost' 
        : isServerError 
          ? 'Server Maintenance' 
          : 'Something went wrong'
    );

    Widget content = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32.0, vertical: 24.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisSize: widget.isFullPage ? MainAxisSize.max : MainAxisSize.min,
        children: [
          // Visual glowing icon
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: isOffline 
                ? const Color(0xFFEFF6FF) 
                : isServerError 
                  ? const Color(0xFFFFF1F2) 
                  : const Color(0xFFFEF3C7),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: (isOffline 
                    ? AppTheme.primaryBlue 
                    : isServerError 
                      ? Colors.red 
                      : Colors.orange).withValues(alpha: 0.15),
                  blurRadius: 30,
                  spreadRadius: 10,
                )
              ],
            ),
            child: Icon(
              errorIcon, 
              size: 56, 
              color: isOffline 
                ? AppTheme.primaryBlue 
                : isServerError 
                  ? Colors.red.shade600 
                  : Colors.orange.shade700,
            ),
          ),
          const SizedBox(height: 32),
          // Heading
          Text(
            errorTitle,
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(
              fontWeight: FontWeight.w900,
              fontSize: 24,
              color: AppTheme.textDark,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 12),
          // User friendly copy
          Text(
            widget.message,
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(
              color: Colors.grey.shade600,
              fontSize: 15,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 32),
          // Retry button
          if (widget.onRetry != null)
            ElevatedButton.icon(
              onPressed: () {
                HapticFeedback.mediumImpact();
                widget.onRetry!();
              },
              icon: const Icon(Icons.refresh_rounded, size: 20),
              label: Text(
                'Try Again',
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryBlue,
                foregroundColor: Colors.white,
                elevation: 4,
                shadowColor: AppTheme.primaryBlue.withValues(alpha: 0.3),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          const SizedBox(height: 16),
          // Expandable diagnostics
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              title: Center(
                child: Text(
                  _showDetails ? 'Hide details' : 'Show details',
                  style: GoogleFonts.outfit(
                    color: Colors.grey.shade400,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ),
              trailing: const SizedBox.shrink(),
              onExpansionChanged: (expanded) {
                setState(() {
                  _showDetails = expanded;
                });
              },
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(top: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8F9FA),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Text(
                    'Error diagnostics:\n${widget.message}\nPath: ${Uri.base.path}',
                    style: GoogleFonts.firaCode(
                      color: Colors.grey.shade700,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    if (widget.isFullPage) {
      return Center(
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: FadeTransition(
            opacity: _fadeController,
            child: content,
          ),
        ),
      );
    }

    return FadeTransition(
      opacity: _fadeController,
      child: content,
    );
  }
}
