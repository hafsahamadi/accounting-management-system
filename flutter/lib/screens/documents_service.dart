// lib/services/document_service.dart
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:cross_file/cross_file.dart';
import 'package:open_filex/open_filex.dart';
import 'package:flutter/cupertino.dart';
import 'document_info.dart';

Future<String?> getAuthToken() async {
  return await const FlutterSecureStorage().read(key: 'token');
}
const String API_BASE_URL = "http://192.168.1.14:8000/api";


class DocumentService {
  final Dio _dio = Dio();

  // --- Couleurs (peuvent être passées en paramètre ou définies dans un thème) ---
  // Pour simplifier, je les laisse ici, mais une meilleure approche serait un ThemeService ou des constantes de thème.
  static const Color _primaryColor = Color(0xFF0D47A1);
  static const Color _accentColor = Color(0xFF1976D2);
  static const Color _successColor = Color(0xFF388E3C);
  static const Color _errorColor = Color(0xFFD32F2F);
  static const Color _warningColor = Color(0xFFFFA000);
  static const Color _neutralColor = Color(0xFF546E7A);
  static const Color _textColorPrimary = Color(0xFF263238);
  static const Color _textColorSecondary = Color(0xFF546E7A);
  static const Color _cardColor = Colors.white;
  static const Color _scaffoldBgColor = Color(0xFFF4F6F8);


  void _showCustomSnackBar({
    required BuildContext context,
    required String message,
    required Color backgroundColor,
    required IconData icon,
    Duration duration = const Duration(seconds: 4),
  }) {
    // Vérifier si le contexte est toujours valide pour ScaffoldMessenger
    if (!Navigator.of(context).mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(icon, color: Colors.white, size: 22),
            const SizedBox(width: 12),
            Expanded(child: Text(message, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500, fontSize: 14.5))),
          ],
        ),
        backgroundColor: backgroundColor,
        behavior: SnackBarBehavior.floating,
        elevation: 4.0,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: duration,
      ),
    );
  }

  Future<String?> _downloadFileToTemp(BuildContext context, DocumentInfo doc) async {
    _showCustomSnackBar(
      context: context,
      message: 'Téléchargement de "${doc.fileName}"...',
      backgroundColor: _accentColor,
      icon: CupertinoIcons.cloud_download_fill,
      duration: const Duration(seconds: 60) // Longue durée pour le téléchargement
    );

    String? token = await getAuthToken();
    if (token == null || token.isEmpty) {
      _showCustomSnackBar(context: context, message: "Token d'authentification manquant.", backgroundColor: _errorColor, icon: CupertinoIcons.xmark_octagon_fill);
      return null;
    }

    final url = '$API_BASE_URL/documents/${doc.id}/download';
    try {
      final response = await _dio.get(url, options: Options(headers: {'Authorization': 'Bearer $token', 'Accept': 'application/octet-stream'}, responseType: ResponseType.bytes));
      if (!Navigator.of(context).mounted) return null; // Vérifier avant de cacher SnackBar
      ScaffoldMessenger.of(context).hideCurrentSnackBar(); // Cacher le SnackBar de "téléchargement en cours"

      if (response.statusCode == 200 && response.data != null) {
        final directory = await getTemporaryDirectory();
        final localFilePath = '${directory.path}/${doc.fileName}'; // Utiliser le nom de fichier original
        await File(localFilePath).writeAsBytes(response.data);
        return localFilePath;
      } else {
        _showCustomSnackBar(context: context, message: 'Échec du téléchargement: ${response.statusCode}', backgroundColor: _errorColor, icon: CupertinoIcons.exclamationmark_triangle_fill);
        return null;
      }
    } on DioException catch (e) {
      if (!Navigator.of(context).mounted) return null;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      String errorMessage = "Erreur réseau.";
      if (e.response != null) {
        if (e.response?.statusCode == 401) errorMessage = "Session expirée. Veuillez vous reconnecter.";
        else if (e.response?.statusCode == 403) errorMessage = "Accès non autorisé à ce document.";
        else if (e.response?.statusCode == 404) errorMessage = "Document non trouvé sur le serveur.";
        else errorMessage = "Erreur serveur (${e.response?.statusCode}).";
      }
      _showCustomSnackBar(context: context, message: errorMessage, backgroundColor: _errorColor, icon: CupertinoIcons.wifi_slash);
      return null;
    } catch (e) {
      if (!Navigator.of(context).mounted) return null;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      _showCustomSnackBar(context: context, message: 'Erreur inconnue lors du téléchargement.', backgroundColor: _errorColor, icon: CupertinoIcons.question_circle_fill);
      return null;
    }
  }

  Future<void> viewDocument(BuildContext context, DocumentInfo doc) async {
    // _showCustomSnackBar(context: context, message: 'Ouverture de "${doc.fileName}"...', backgroundColor: _accentColor, icon: CupertinoIcons.doc_text_search, duration: const Duration(seconds: 2));
    final String? localFilePath = await _downloadFileToTemp(context, doc);
    if (!Navigator.of(context).mounted || localFilePath == null) return;

    try {
      final result = await OpenFilex.open(localFilePath);
      if (result.type != ResultType.done) {
         _showCustomSnackBar(context: context, message: 'Impossible d\'ouvrir: ${result.message}', backgroundColor: _warningColor, icon: CupertinoIcons.exclamationmark_bubble_fill);
      }
    } catch (e) {
      _showCustomSnackBar(context: context, message: 'Erreur d\'ouverture du fichier.', backgroundColor: _errorColor, icon: CupertinoIcons.xmark_octagon_fill);
    }
  }

  Future<void> downloadDocumentForUser(BuildContext context, DocumentInfo doc) async {
    final String? localFilePath = await _downloadFileToTemp(context, doc);
    if (!Navigator.of(context).mounted || localFilePath == null) return;

    // Le fichier est déjà dans temp. On peut afficher un message de succès.
    // L'utilisateur devra le trouver dans ses fichiers temporaires ou on pourrait implémenter un "Enregistrer sous".
    // Pour l'instant, un simple message suffit.
    _showCustomSnackBar(context: context, message: '"${doc.fileName}" téléchargé dans le cache temporaire.', backgroundColor: _successColor, icon: CupertinoIcons.check_mark_circled_solid);
    // Pour un vrai "Enregistrer sous", il faudrait utiliser file_saver ou une logique de permission de stockage.
  }

  Future<Map<String, dynamic>?> _renameDocumentApi({required int documentId, required String nouveauNomFichier}) async {
    String? token = await getAuthToken();
    if (token == null || token.isEmpty) {
      throw Exception("Token d'authentification manquant.");
    }
    final url = '$API_BASE_URL/documents/$documentId/rename';
    try {
      final response = await _dio.patch(
        url,
        data: {'nouveau_nom_fichier': nouveauNomFichier},
        options: Options(
          headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
          receiveTimeout: const Duration(seconds: 30),
          sendTimeout: const Duration(seconds: 30),
        )
      );
      if (response.statusCode == 200 && response.data != null) {
        return response.data as Map<String, dynamic>;
      } else {
        String? apiMessage = response.data?['message'];
        return {'message': apiMessage ?? 'Échec du renommage: ${response.statusCode}'};
      }
    } on DioException catch (e) {
      String errorMessage = 'Erreur réseau.';
      if (e.response?.statusCode == 401) errorMessage = 'Session expirée.';
      else if (e.response?.statusCode == 403) errorMessage = 'Non autorisé.';
      else if (e.response?.data != null && e.response!.data['message'] != null) errorMessage = e.response!.data['message'];
      else if (e.response?.statusCode != null) errorMessage = "Erreur serveur (${e.response?.statusCode})";
      return {'message': errorMessage};
    } catch (e) {
      return {'message': 'Erreur inconnue: $e'};
    }
  }

  Future<bool> showRenameDialog(BuildContext context, DocumentInfo doc, Function onDocumentUpdated) async {
    final TextEditingController renameController = TextEditingController(text: doc.fileName);
    final formKey = GlobalKey<FormState>();
    bool success = false;

    String? newName = await showDialog<String>(
      context: context,
      builder: (BuildContext dialogContext) {
        // ... (Code du AlertDialog de renommage, identique à celui dans UploadHistoryPage) ...
        // Assurez-vous d'utiliser les couleurs statiques de DocumentService ici
        return AlertDialog(
          backgroundColor: _cardColor,
          elevation: 8,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          title: Row(
            children: [
              Icon(CupertinoIcons.pencil_ellipsis_rectangle, color: _primaryColor, size: 26),
              const SizedBox(width: 12),
              Text('Renommer', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w600, color: _textColorPrimary))
            ]
          ),
          content: Form(
            key: formKey,
            child: TextFormField(
              controller: renameController,
              autofocus: true,
              style: TextStyle(fontSize: 15, color: _textColorPrimary),
              decoration: InputDecoration(
                hintText: "Nouveau nom du fichier",
                hintStyle: TextStyle(color: _textColorSecondary.withOpacity(0.6)),
                filled: true,
                fillColor: _scaffoldBgColor, // Utiliser une couleur de service ou passée en paramètre
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade300, width: 1)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade300, width: 1)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _primaryColor, width: 1.5)),
                prefixIcon: Icon(CupertinoIcons.doc_on_clipboard, color: _textColorSecondary, size: 20),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
              ),
              validator: (v) => (v==null||v.trim().isEmpty)?'Nom requis.':(!v.contains('.'))?'Extension requise.':null
            ),
          ),
          actions: <Widget>[
            TextButton(
              child: Text('Annuler', style: TextStyle(fontWeight: FontWeight.w600, color: _neutralColor, fontSize: 14.5)),
              onPressed: () => Navigator.of(dialogContext).pop(),
            ),
            ElevatedButton.icon(
              icon: const Icon(CupertinoIcons.check_mark_circled, size: 18),
              label: const Text('Renommer', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5)),
              style: ElevatedButton.styleFrom(backgroundColor: _primaryColor, foregroundColor: Colors.white),
              onPressed: () { if (formKey.currentState!.validate()) Navigator.of(dialogContext).pop(renameController.text.trim()); }
            )
          ],
        );
      },
    );
    if (!Navigator.of(context).mounted || newName == null || newName.trim().isEmpty) return false;
    if (newName.trim() == doc.fileName) {
      _showCustomSnackBar(context: context, message: 'Le nouveau nom est identique.', backgroundColor: _warningColor, icon: CupertinoIcons.info_circle_fill);
      return false;
    }
    _showCustomSnackBar(context: context, message: 'Renommage en cours...', backgroundColor: _accentColor, icon: CupertinoIcons.time, duration: const Duration(seconds: 30));
    try {
      final result = await _renameDocumentApi(documentId: doc.id, nouveauNomFichier: newName.trim());
      if (!Navigator.of(context).mounted) return false;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      if (result != null && result.containsKey('document')) {
         _showCustomSnackBar(context: context, message: 'Renommé avec succès !', backgroundColor: _successColor, icon: CupertinoIcons.check_mark_circled_solid);
        onDocumentUpdated(); // Appeler le callback pour rafraîchir la liste
        success = true;
      } else {
         _showCustomSnackBar(context: context, message: result?['message'] as String? ?? 'Échec du renommage.', backgroundColor: _errorColor, icon: CupertinoIcons.xmark_octagon_fill);
      }
    } catch (e) {
      if (!Navigator.of(context).mounted) return false;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      _showCustomSnackBar(context: context, message: 'Erreur: ${e.toString().replaceFirst("Exception: ", "")}', backgroundColor: _errorColor, icon: CupertinoIcons.xmark_octagon_fill);
    }
    return success;
  }

  Future<void> shareDocument(BuildContext context, DocumentInfo doc) async {
    // _showCustomSnackBar(context: context, message: 'Préparation du partage...', backgroundColor: _accentColor, icon: CupertinoIcons.share_up, duration: const Duration(seconds: 2));
    final String? localFilePath = await _downloadFileToTemp(context, doc);
    if (!Navigator.of(context).mounted || localFilePath == null) return;

    try {
      final xfile = XFile(localFilePath);
      await Share.shareXFiles([xfile], text: "Document: ${doc.fileName}", subject: 'Document: ${doc.fileName}');
    } catch (e) {
      _showCustomSnackBar(context: context, message: 'Erreur de partage.', backgroundColor: _errorColor, icon: CupertinoIcons.xmark_octagon_fill);
    }
  }

  Future<bool> _deleteDocumentApi(int documentId) async {
    String? token = await getAuthToken();
    if (token == null || token.isEmpty) throw Exception("Token manquant.");
    final url = '$API_BASE_URL/documents/$documentId';
    try {
      final response = await _dio.delete(url, options: Options(headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'}));
      return response.statusCode == 200 || response.statusCode == 204;
    } catch (e) {
      print("Erreur API suppression: $e"); // Log plus détaillé
      throw Exception("Échec suppression du document.");
    }
  }

  Future<bool> deleteDocument(BuildContext context, DocumentInfo doc, Function onDocumentUpdated) async {
    bool success = false;
    bool? confirmDelete = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) {
        // ... (Code du AlertDialog de suppression, identique à celui dans UploadHistoryPage) ...
        // Assurez-vous d'utiliser les couleurs statiques de DocumentService ici
        return AlertDialog(
          backgroundColor: _cardColor, elevation: 8, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(children: [Icon(CupertinoIcons.trash_fill, color: _errorColor, size: 26), const SizedBox(width:12), Text('Supprimer', style: TextStyle(color: _textColorPrimary, fontWeight: FontWeight.w600, fontSize: 19))]),
          content: Text('Voulez-vous vraiment supprimer "${doc.fileName}" ?', style: TextStyle(color: _textColorSecondary, fontSize: 15)),
          actions: <Widget>[
            TextButton(child: Text('Annuler', style: TextStyle(fontWeight: FontWeight.w600, color: _neutralColor, fontSize: 14.5)), onPressed: () => Navigator.of(dialogContext).pop(false)),
            TextButton(child: Text('Supprimer', style: TextStyle(color: _errorColor, fontWeight: FontWeight.w600, fontSize: 14.5)), onPressed: () => Navigator.of(dialogContext).pop(true), style: TextButton.styleFrom(backgroundColor: _errorColor.withOpacity(0.1))),
          ]
        );
      },
    );
    if (confirmDelete != true || !Navigator.of(context).mounted) return false;
    _showCustomSnackBar(context: context, message: 'Suppression en cours...', backgroundColor: _accentColor, icon: CupertinoIcons.time, duration: const Duration(seconds: 30));
    try {
      bool apiSuccess = await _deleteDocumentApi(doc.id);
      if (!Navigator.of(context).mounted) return false;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      if (apiSuccess) {
        _showCustomSnackBar(context: context, message: '"${doc.fileName}" supprimé.', backgroundColor: _successColor, icon: CupertinoIcons.check_mark_circled_solid);
        onDocumentUpdated(); // Appeler le callback pour rafraîchir la liste
        success = true;
      } else {
        _showCustomSnackBar(context: context, message: 'Échec de la suppression.', backgroundColor: _errorColor, icon: CupertinoIcons.xmark_octagon_fill);
      }
    } catch (e) {
      if (!Navigator.of(context).mounted) return false;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      _showCustomSnackBar(context: context, message: 'Erreur: ${e.toString().replaceFirst("Exception: ", "")}', backgroundColor: _errorColor, icon: CupertinoIcons.xmark_octagon_fill);
    }
    return success;
  }
}