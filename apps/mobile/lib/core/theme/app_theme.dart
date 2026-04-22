import 'package:flutter/material.dart';

class AppTheme {
  // Brand Colors from Design
  static const Color primaryBlue = Color(0xFF1E60E8);
  static const Color savingsGreen = Color(0xFF1A9246);
  static const Color lightGreenBg = Color(0xFFE5F6E8);
  static const Color backgroundLight = Color(0xFFF4F7F9);
  static const Color textDark = Color(0xFF1A1A1A);
  static const Color textBody = Color(0xFF6B7280);

  static final ThemeData lightTheme = ThemeData(
    scaffoldBackgroundColor: backgroundLight,
    primaryColor: primaryBlue,
    useMaterial3: true,
    fontFamily: 'SF Pro Display', // Assume standard SF or Inter
    appBarTheme: const AppBarTheme(
      backgroundColor: backgroundLight,
      elevation: 0,
      iconTheme: IconThemeData(color: textDark),
      titleTextStyle: TextStyle(
        color: textDark, 
        fontSize: 18, 
        fontWeight: FontWeight.w600
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primaryBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
        ),
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
    ),
  );
}
