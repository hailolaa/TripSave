import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../bloc/notification_cubit.dart';
import '../models/notification_model.dart';
import '../../auth/bloc/auth_cubit.dart';

class NotificationScreen extends StatelessWidget {
  const NotificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Text('Notifications', 
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 24, color: AppTheme.textDark)
        ),
        actions: [
          TextButton(
            onPressed: () => context.read<NotificationCubit>().markAllAsRead(),
            child: Text('Mark all as read', style: GoogleFonts.outfit(color: AppTheme.primaryBlue, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: BlocBuilder<NotificationCubit, NotificationState>(
        builder: (context, state) {
          if (state is! NotificationLoaded || state.notifications.isEmpty) {
            return _buildEmptyState();
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: state.notifications.length,
            itemBuilder: (context, index) {
              final notification = state.notifications[index];
              return _buildNotificationCard(context, notification);
            },
          );
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.notifications_none, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text('No notifications yet', 
            style: GoogleFonts.outfit(fontSize: 18, color: Colors.grey.shade500, fontWeight: FontWeight.w500)
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationCard(BuildContext context, AppNotification notification) {
    IconData icon;
    Color iconColor;
    Color bgColor;

    switch (notification.type) {
      case NotificationType.trialEnding:
        icon = Icons.timer_outlined;
        iconColor = Colors.orange;
        bgColor = Colors.orange.shade50;
        break;
      case NotificationType.trialEnded:
        icon = Icons.warning_amber_rounded;
        iconColor = Colors.red;
        bgColor = Colors.red.shade50;
        break;
      case NotificationType.subscriptionUpdate:
        icon = Icons.credit_card;
        iconColor = AppTheme.primaryBlue;
        bgColor = Colors.blue.shade50;
        break;
      case NotificationType.general:
        icon = Icons.notifications_none;
        iconColor = Colors.grey.shade600;
        bgColor = Colors.grey.shade100;
        break;
    }

    return Dismissible(
      key: Key(notification.id),
      onDismissed: (_) => context.read<NotificationCubit>().deleteNotification(notification.id),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: Colors.red.shade400,
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      child: GestureDetector(
        onTap: () {
          context.read<NotificationCubit>().markAsRead(notification.id);
          _handleNotificationTap(context, notification);
        },
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: notification.isRead ? Colors.white : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: notification.isRead ? Colors.grey.shade200 : AppTheme.primaryBlue.withValues(alpha: 0.3),
              width: notification.isRead ? 1 : 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, color: iconColor, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(notification.title, 
                            style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.textDark)
                          ),
                        ),
                        Text(DateFormat('MMM d').format(notification.timestamp), 
                          style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey.shade500)
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(notification.message, 
                      style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade600, height: 1.4)
                    ),
                    if (!notification.isRead)
                      Container(
                        margin: const EdgeInsets.only(top: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryBlue.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text('NEW', style: GoogleFonts.outfit(color: AppTheme.primaryBlue, fontWeight: FontWeight.bold, fontSize: 10)),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _handleNotificationTap(BuildContext context, AppNotification notification) {
    if (notification.type == NotificationType.trialEnded) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text('Subscription Ended', style: GoogleFonts.outfit(fontWeight: FontWeight.w900)),
          content: const Text('Your trial has ended. Would you like to continue with a monthly subscription?'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                context.read<AuthCubit>().logout();
              },
              child: Text('End & Sign Out', style: TextStyle(color: Colors.red.shade700)),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                // In a real app, take them to billing or reactivate
              },
              child: const Text('Continue'),
            ),
          ],
        ),
      );
    }
  }
}
