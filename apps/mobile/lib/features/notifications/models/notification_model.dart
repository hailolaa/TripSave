import 'package:equatable/equatable.dart';

enum NotificationType {
  trialEnding,
  trialEnded,
  subscriptionUpdate,
  general
}

class AppNotification extends Equatable {
  final String id;
  final String title;
  final String message;
  final NotificationType type;
  final DateTime timestamp;
  final bool isRead;
  final Map<String, dynamic>? data;

  const AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.timestamp,
    this.isRead = false,
    this.data,
  });

  AppNotification copyWith({
    bool? isRead,
  }) {
    return AppNotification(
      id: id,
      title: title,
      message: message,
      type: type,
      timestamp: timestamp,
      isRead: isRead ?? this.isRead,
      data: data,
    );
  }

  @override
  List<Object?> get props => [id, title, message, type, timestamp, isRead, data];
}
