import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand Colors from Design
  static const Color primaryBlue = Color(0xFF0047AB); // Deeper Corporate Blue
  static const Color savingsGreen = Color(0xFF10B981); // Emerald
  static const Color lightGreenBg = Color(0xFFECFDF5);
  static const Color backgroundLight = Colors.white;
  static const Color textDark = Color(0xFF0F172A); // Slate 900
  static const Color textBody = Color(0xFF475569); // Slate 600
  static const Color surfaceWhite = Colors.white;

  static final ThemeData lightTheme = ThemeData(
    scaffoldBackgroundColor: Colors.white,
    primaryColor: primaryBlue,
    useMaterial3: true,
    textTheme: GoogleFonts.outfitTextTheme().copyWith(
      displayLarge: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: textDark),
      displayMedium: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: textDark),
      displaySmall: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: textDark),
      headlineMedium: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: textDark),
      titleLarge: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: textDark),
      bodyLarge: GoogleFonts.outfit(color: textBody),
      bodyMedium: GoogleFonts.outfit(color: textBody),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: backgroundLight,
      elevation: 0,
      centerTitle: false,
      iconTheme: const IconThemeData(color: textDark),
      titleTextStyle: GoogleFonts.outfit(
        color: textDark, 
        fontSize: 20, 
        fontWeight: FontWeight.w600
      ),
    ),
    cardTheme: CardThemeData(
      color: surfaceWhite,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: Colors.grey.withValues(alpha: 0.05)),
      ),
    ),
    dividerTheme: DividerThemeData(
      color: Colors.grey.withValues(alpha: 0.1),
      thickness: 1,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primaryBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 28),
        textStyle: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
  );
}
