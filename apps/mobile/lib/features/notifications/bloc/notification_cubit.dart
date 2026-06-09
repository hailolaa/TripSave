import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../models/notification_model.dart';
import 'dart:async';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/services/local_notification_service.dart';
import '../../../core/services/settings_service.dart';

abstract class NotificationState extends Equatable {
  @override
  List<Object?> get props => [];
}

class NotificationInitial extends NotificationState {}

class NotificationLoaded extends NotificationState {
  final List<AppNotification> notifications;
  final int unreadCount;

  NotificationLoaded({
    required this.notifications,
    required this.unreadCount,
  });

  @override
  List<Object?> get props => [notifications, unreadCount];
}

class NotificationCubit extends Cubit<NotificationState> {
  final LocalNotificationService _notificationService;
  final SettingsService _settingsService;

  NotificationCubit(this._notificationService, this._settingsService) : super(NotificationInitial()) {
    if (_settingsService.notificationsEnabled) {
      _notificationService.requestPermission();
    }
    // Initialize with empty list or load from storage
    _loadNotifications();
  }

  List<AppNotification> _notifications = [];

  void _loadNotifications() {
    // In a real app, load from local storage or API
    // For now, we'll start with empty and add a welcome notification
    addNotification(
      title: 'Welcome to PricePilot!',
      message: 'Start saving money on every trip with our smart comparison tool.',
      type: NotificationType.general,
    );
    _emitLoaded();
  }

  void addNotification({
    required String title,
    required String message,
    required NotificationType type,
    Map<String, dynamic>? data,
  }) {
    // Check if duplicate (simple check for title/message)
    if (_notifications.any((n) => n.title == title && n.message == message)) return;

    final notification = AppNotification(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      title: title,
      message: message,
      type: type,
      timestamp: DateTime.now(),
      data: data,
    );

    _notifications = [notification, ..._notifications];
    _emitLoaded();

    if (_settingsService.notificationsEnabled) {
      _notificationService.showNotification(
        id: notification.id.hashCode,
        title: title,
        body: message,
      );
    }
  }

  void markAsRead(String id) {
    _notifications = _notifications.map((n) {
      if (n.id == id) return n.copyWith(isRead: true);
      return n;
    }).toList();
    _emitLoaded();
  }

  void markAllAsRead() {
    _notifications = _notifications.map((n) => n.copyWith(isRead: true)).toList();
    _emitLoaded();
  }

  void deleteNotification(String id) {
    _notifications = _notifications.where((n) => n.id != id).toList();
    _emitLoaded();
  }

  void _emitLoaded() {
    final unreadCount = _notifications.where((n) => !n.isRead).length;
    emit(NotificationLoaded(
      notifications: List.unmodifiable(_notifications),
      unreadCount: unreadCount,
    ));
  }

  void checkSubscriptionStatus(Map<String, dynamic> profile) {
    final trialEndDateStr = profile['trial_end_date'];
    final subStatus = profile['subscription_status']?.toString().toLowerCase() ?? 'none';

    if (trialEndDateStr != null) {
      final trialEnd = DateTime.parse(trialEndDateStr);
      final now = DateTime.now();
      final difference = trialEnd.difference(now).inDays;

      if (difference <= 3 && difference > 0 && subStatus == 'trialing') {
        addNotification(
          title: 'Trial Ending Soon',
          message: 'Your free trial ends in $difference days. Continue to enjoy premium features!',
          type: NotificationType.trialEnding,
        );
      } else if (difference <= 0 && subStatus == 'trialing') {
        addNotification(
          title: 'Trial Ended',
          message: 'Your free trial has ended. Please renew to keep your premium access.',
          type: NotificationType.trialEnded,
        );
      }
    }
  }

  Future<void> requestPermission() async {
    await _notificationService.requestPermission();
    final status = await Permission.notification.request();
    if (status.isPermanentlyDenied) {
      // In a real app, maybe show a dialog to go to settings
      openAppSettings();
    }
  }
}
