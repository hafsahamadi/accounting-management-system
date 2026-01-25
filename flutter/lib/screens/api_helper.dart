import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Configuration class for API endpoints
class ApiConfig {
  static const String baseUrl = "http://192.168.1.14:8000/api";

  static String getBaseUrl() {
    return baseUrl;
  }

  static Uri getLoginUrl() {
    return Uri.parse('${getBaseUrl()}/entreprise/login');
  }
  
  static Uri getValidateTokenUrl() {
    return Uri.parse('${getBaseUrl()}/validate-token');
  }
  
  static Uri getLogoutUrl() {
    return Uri.parse('${getBaseUrl()}/logout');
  }

  // Nouvelle URL pour l'abonnement
  static Uri getSubscriptionRequestUrl() {
    return Uri.parse('${getBaseUrl()}/abonnements/demande');
  }
}

/// Authentication service for managing user sessions
class AuthService {
  static final storage = FlutterSecureStorage();

  /// Login method for enterprise users
  static Future<Map<String, dynamic>> loginEntreprise(String nomUtilisateur, String motDePasse) async {
    try {
      final url = ApiConfig.getLoginUrl();
      print('🔵 Sending login request to $url');

      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'nom_utilisateur': nomUtilisateur,
          'mot_de_passe': motDePasse,
        }),
      );

      print('🟡 Status Code: ${response.statusCode}');
      print('🟡 Response: ${response.body}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        if (data.containsKey('token')) {
          final token = data['token'];
          await storage.write(key: 'token', value: token);
          
          final prefs = await SharedPreferences.getInstance();
          await prefs.setBool('isLoggedIn', true);
          await prefs.setString('username', nomUtilisateur);

          String entrepriseIdStr = '';
          String entrepriseNom = '';
          bool hasActiveSubscription = false;
          String entrepriseStatus = '';

          // Stocker les informations de l'entreprise si présentes
          if (data.containsKey('entreprise')) {
            final entreprise = data['entreprise'];
            entrepriseIdStr = entreprise['id']?.toString() ?? '';
            entrepriseNom = entreprise['nom'] ?? '';
            hasActiveSubscription = entreprise['has_active_subscription'] ?? false;
            entrepriseStatus = entreprise['statut'] ?? '';

            await prefs.setString('entreprise_id', entrepriseIdStr);
            await prefs.setString('entreprise_nom', entrepriseNom);
            await prefs.setBool('has_active_subscription', hasActiveSubscription);
            await prefs.setString('entreprise_status', entrepriseStatus);
          }

          print('🟢 Login successful — token stored.');

          return {
            'success': true,
            'hasActiveSubscription': hasActiveSubscription,
            'entrepriseId': entrepriseIdStr,
            'entrepriseNom': entrepriseNom,
            'entrepriseStatus': entrepriseStatus,
          };
        } else {
          print('🔴 Token missing in response: $data');
          return {'success': false, 'error': 'Token manquant'};
        }
      } else {
        print('🔴 HTTP Error: ${response.statusCode} => ${response.body}');
        return {'success': false, 'error': 'Erreur de connexion'};
      }
    } catch (e) {
      print('🔴 Exception during login: $e');
      return {'success': false, 'error': 'Erreur réseau: $e'};
    }
  }

  /// Check if user has active subscription
  static Future<bool> hasActiveSubscription() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool('has_active_subscription') ?? false;
    } catch (e) {
      return false;
    }
  }

  /// Get entreprise ID
  static Future<String?> getEntrepriseId() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString('entreprise_id');
    } catch (e) {
      return null;
    }
  }

  /// Check if user is currently logged in
  static Future<bool> isLoggedIn() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final isLoggedIn = prefs.getBool('isLoggedIn') ?? false;
      
      final token = await storage.read(key: 'token');
      
      if (!isLoggedIn || token == null || token.isEmpty) {
        return false;
      }
      
      try {
        final response = await http.get(
          ApiConfig.getValidateTokenUrl(),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
        );
        
        if (response.statusCode != 200) {
          await logout();
          return false;
        }
      } catch (e) {
        print('🟠 Error validating token: $e');
      }
      
      return true;
    } catch (e) {
      print('🔴 Error checking login status: $e');
      return false;
    }
  }

  /// Get the authentication token
  static Future<String?> getToken() async {
    return await storage.read(key: 'token');
  }

  /// Logout user and clear stored credentials
  static Future<bool> logout() async {
    try {
      final token = await getToken();
      
      if (token != null && token.isNotEmpty) {
        try {
          await http.post(
            ApiConfig.getLogoutUrl(),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
          );
        } catch (e) {
          print('🟠 Error during server-side logout: $e');
        }
      }
      
      await storage.delete(key: 'token');
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('isLoggedIn', false);
      await prefs.remove('username');
      await prefs.remove('entreprise_id');
      await prefs.remove('entreprise_nom');
      await prefs.remove('has_active_subscription');
      await prefs.remove('entreprise_status');
      
      print('🟢 Logout successful');
      return true;
    } catch (e) {
      print('🔴 Error during logout: $e');
      return false;
    }
  }
  
  /// Get the current username
  static Future<String?> getUsername() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString('username');
    } catch (e) {
      return null;
    }
  }

  /// Submit subscription request
  static Future<bool> submitSubscriptionRequest(String planId, String entrepriseId, String filePath) async {
    try {
      final token = await getToken();
      if (token == null) return false;

      var request = http.MultipartRequest(
        'POST',
        ApiConfig.getSubscriptionRequestUrl(),
      );

      request.headers['Authorization'] = 'Bearer $token';
      request.fields['plan_id'] = planId;
      request.fields['entreprise_id'] = entrepriseId;

      request.files.add(
        await http.MultipartFile.fromPath('file', filePath),
      );

      var response = await request.send();
      return response.statusCode == 200;
    } catch (e) {
      print('🔴 Error submitting subscription request: $e');
      return false;
    }
  }
  
}
