
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/cupertino.dart'; // Pour CupertinoIcons


Future<String?> getAuthToken() async {
  const storage = FlutterSecureStorage();
  return await storage.read(key: 'token');
}
const String API_BASE_URL = "http://192.168.1.14:8000/api";
// Clé de notification de bienvenue spécifique au profil (si besoin de la nettoyer ici)
const String WELCOME_NOTIFICATION_KEY_PROFILE = 'last_welcome_notification_time_profile';
// Clé de notification de bienvenue spécifique au dashboard (si besoin de la nettoyer ici)
const String WELCOME_NOTIFICATION_KEY_DASHBOARD = 'last_welcome_notification_time';
// --- FIN : Éléments globaux ---


class AuthService {
  static final Dio _dio = Dio(); // Créez une instance de Dio ici ou passez-la

  static Future<void> logout(BuildContext context, {List<String>? sharedPrefsKeysToClear}) async {
    print("AuthService.logout: Début");

    final token = await getAuthToken();
    print("AuthService.logout: Token obtenu: ${token != null ? 'Présent' : 'Null'}");

    if (token == null) {
      print("AuthService.logout: Token déjà null.");
      _navigateToLogin(context);
      return;
    }

    final bool confirmLogout = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(children: [Icon(CupertinoIcons.square_arrow_left, color: Colors.orange.shade700), SizedBox(width: 10), const Text('Déconnexion')]),
          content: const Text('Êtes-vous sûr de vouloir vous déconnecter ?'),
          actions: <Widget>[
            TextButton(
              child: const Text('Annuler', style: TextStyle(fontWeight: FontWeight.w500)),
              onPressed: () => Navigator.of(dialogContext).pop(false),
            ),
            TextButton(
              child: Text('Se déconnecter', style: TextStyle(color: Colors.red.shade700, fontWeight: FontWeight.bold)),
              onPressed: () => Navigator.of(dialogContext).pop(true),
            ),
          ],
        );
      },
    ) ?? false;

    print("AuthService.logout: Confirmation: $confirmLogout");
    if (!confirmLogout) return;

    // Afficher un indicateur de chargement (SnackBar)
    // Vérifier si le widget est toujours monté et si ScaffoldMessenger est disponible
    final scaffoldMessenger = ScaffoldMessenger.maybeOf(context);
    if (scaffoldMessenger != null) {
        print("AuthService.logout: Affichage du SnackBar de chargement");
        scaffoldMessenger.showSnackBar(
            SnackBar(
            content: Row(children: const [CircularProgressIndicator(valueColor: AlwaysStoppedAnimation(Colors.white)), SizedBox(width:15), Text("Déconnexion en cours...")]),
            backgroundColor: Theme.of(context).primaryColor,
            duration: const Duration(seconds: 5), // Assez long pour couvrir l'opération
            )
        );
    }


    // Tenter la déconnexion API
    try {
      print("AuthService.logout: Tentative d'appel API /logout");
      await _dio.post(
        '$API_BASE_URL/logout',
        options: Options(headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'}),
      );
      print("AuthService.logout: Appel API /logout terminé.");
    } catch (e) {
      print("AuthService.logout: Erreur lors de la déconnexion API: $e");
      // On continue malgré l'erreur API, car on veut nettoyer le stockage local
    }

    // Opérations de nettoyage locales
    print("AuthService.logout: Nettoyage du stockage local.");
    const storage = FlutterSecureStorage();
    try {
      await storage.delete(key: 'token');
      await storage.delete(key: 'userId'); // Si vous utilisez 'userId'
      print("AuthService.logout: Token (et userId) supprimé de FlutterSecureStorage.");

      final prefs = await SharedPreferences.getInstance();
      if (sharedPrefsKeysToClear != null) {
        for (String key in sharedPrefsKeysToClear) {
          await prefs.remove(key);
          print("AuthService.logout: Clé SharedPreferences '$key' nettoyée.");
        }
      }
      // Exemple: si vous avez une clé de notification de bienvenue que vous voulez toujours nettoyer au logout
      // await prefs.remove(WELCOME_NOTIFICATION_KEY_PROFILE); // Ou une autre clé globale
      // await prefs.remove(WELCOME_NOTIFICATION_KEY_DASHBOARD);


    } catch (e) {
      print("AuthService.logout: Erreur pendant le nettoyage du stockage: $e");
    }

    // Navigation finale
    if (scaffoldMessenger != null) {
        scaffoldMessenger.hideCurrentSnackBar();
    }
    _navigateToLogin(context);
  }

  static void _navigateToLogin(BuildContext context) {
    // Assurez-vous que le widget est toujours dans l'arbre avant de naviguer
    // `ModalRoute.of(context)?.isCurrent ?? false` est une bonne vérification
    // `Navigator.of(context).mounted` est une autre vérification utile
    if (Navigator.of(context).mounted) {
        print("AuthService._navigateToLogin: Tentative de navigation vers '/'.");
        Navigator.of(context, rootNavigator: true).pushNamedAndRemoveUntil(
        '/', // Votre route de connexion
        (Route<dynamic> route) => false, // Supprime toutes les routes précédentes
        );
        print("AuthService._navigateToLogin: Navigation vers '/' effectuée.");
    } else {
        print("AuthService._navigateToLogin: ERREUR - Le contexte n'est plus monté. Navigation annulée.");
    }
  }

  // Nouvelle fonction pour rediriger vers login si token est null (peut être appelée depuis initState)
  static void redirectToLoginIfNoToken(BuildContext context, String? token) {
    if (token == null) {
      print("AuthService.redirectToLoginIfNoToken: Token null détecté - Redirection vers login");
      // Utiliser Future.delayed pour éviter de naviguer pendant un setState ou un build
      Future.delayed(Duration.zero, () {
        if (Navigator.of(context).mounted) { // Vérifier à nouveau avant la navigation réelle
            _navigateToLogin(context);
        }
      });
    }
  }
}