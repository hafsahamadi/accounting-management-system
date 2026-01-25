import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:math' as math;
import 'document_info.dart';
import 'auth_service.dart';
import 'documents_service.dart';


Future<String?> getAuthToken() async {
  const storage = FlutterSecureStorage();
  return await storage.read(key: 'token');
}

const String API_BASE_URL = "http://192.168.1.14:8000/api";
const String BASE_STORAGE_URL = "http://192.168.1.14:8000/storage/";
const String WELCOME_NOTIFICATION_KEY = 'last_welcome_notification_time';

class DocumentItem {
  final int id;
  final String? filePath;
  final String title;
  final String time;
  final String fileTypeForDisplay;
  final Color typeColorForDisplay;
  final String? originalApiType;
  final String? apiStatus;

  DocumentItem({
    required this.id,
    this.filePath,
    required this.title,
    required this.time,
    required this.fileTypeForDisplay,
    required this.typeColorForDisplay,
    this.originalApiType,
    this.apiStatus,
  });

  DocumentInfo toDocumentInfo() {
    return DocumentInfo(
      id: id,
      fileName: title,
      type: originalApiType ?? 'unknown',
      uploadedAt: DateTime.tryParse(time) ?? DateTime.now(),
      status: apiStatus ?? 'unknown',
      filePath: filePath,
      entrepriseNom: null,
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  _DashboardScreenState createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  Map<String, int> documentStatuses = {};
  List<DocumentItem> recentDocuments = [];

  late AnimationController _animationController;
  late Animation<double> _animation;

  bool _isLoadingRecent = true;
  bool _isLoadingStatus = true;
  bool _showNotification = false;
  String? _errorMessageRecent;
  String? _errorMessageStatus;
  String userName = "";

  final Dio _dio = Dio();
  bool _showDialog = false;

  final DocumentService _documentService = DocumentService();

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _animation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOutQuart,
    );
    _checkTokenAndLoadInitialData();
    _checkWelcomeNotification();
    Future.delayed(const Duration(milliseconds: 800), () {
      if (mounted) _animationController.forward();
    });
  }

  Future<void> _checkTokenAndLoadInitialData() async {
    if (!mounted) return;
    final token = await getAuthToken();
    AuthService.redirectToLoginIfNoToken(context, token);
    if (token == null) {
      if (mounted) {
        setState(() {
          _isLoadingRecent = false;
          _isLoadingStatus = false;
          _errorMessageRecent = "Authentification requise.";
          _errorMessageStatus = "Authentification requise.";
          userName = "";
        });
      }
      return;
    }
    _loadData();
    _loadUserInfo();
  }

  Future<void> _checkWelcomeNotification() async {
    final prefs = await SharedPreferences.getInstance();
    final lastNotificationTime = prefs.getInt(WELCOME_NOTIFICATION_KEY) ?? 0;
    final currentTime = DateTime.now().millisecondsSinceEpoch;
    final shouldShowNotification = lastNotificationTime == 0 || currentTime - lastNotificationTime > 24 * 60 * 60 * 1000;
    if (shouldShowNotification && mounted) {
      await prefs.setInt(WELCOME_NOTIFICATION_KEY, currentTime);
      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) { setState(() { _showNotification = true; });
          Future.delayed(const Duration(seconds: 5), () { if (mounted) setState(() { _showNotification = false; }); });
        }
      });
    } else { if (mounted) setState(() { _showNotification = false; });}
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _loadUserInfo() async {
    final String? token = await getAuthToken();
    if (token == null || token.isEmpty) { if (mounted) setState(() { userName = "Invité"; }); return; }
    final url = '$API_BASE_URL/profile';
    try {
      final response = await _dio.get(url, options: Options(headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'}, receiveTimeout: const Duration(seconds: 10), sendTimeout: const Duration(seconds: 10),));
      if (response.statusCode == 200 && response.data != null) {
        final userData = response.data;
        if (mounted) { setState(() { String extractedName = ''; if (userData['prenom'] != null && userData['prenom'].toString().isNotEmpty) { extractedName = userData['prenom'].toString(); } else if (userData['nom_entreprise'] != null && userData['nom_entreprise'].toString().isNotEmpty) { extractedName = userData['nom_entreprise'].toString(); } else if (userData['name'] != null && userData['name'].toString().isNotEmpty) { final fullName = userData['name'].toString(); final parts = fullName.split(' '); extractedName = parts.isNotEmpty ? parts[0] : 'Utilisateur'; } else { extractedName = 'Utilisateur'; } userName = extractedName; }); }
      } else { if (mounted) setState(() { userName = "Utilisateur"; }); }
    } catch (e) { if (mounted) setState(() { userName = "Utilisateur"; }); }
  }

  Future<void> _loadData() async {
    if (!mounted) return;
    setState(() { _isLoadingRecent = true; _isLoadingStatus = true; _errorMessageRecent = null; _errorMessageStatus = null; });
    await Future.wait([fetchStatusCounts(), fetchRecentDocuments()]);
  }

  Future<void> fetchStatusCounts() async {
    final String? token = await getAuthToken();
    if (token == null || token.isEmpty) { if (mounted) { setState(() { _isLoadingStatus = false; _errorMessageStatus = "Authentification requise."; });} return;}
    final url = '$API_BASE_URL/documents/status-counts';
    try {
      final response = await _dio.get(url, options: Options(headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'}, receiveTimeout: const Duration(seconds: 20), sendTimeout: const Duration(seconds: 20),));
      if (response.statusCode == 200 && response.data != null && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        if (mounted) { setState(() { documentStatuses = { 'En cours': (data['En cours'] ?? data['en_cours'] ?? 0) as int, 'Validé': (data['Validé'] ?? data['valide'] ?? 0) as int, 'À revoir': (data['À revoir'] ?? data['a_revoir'] ?? 0) as int,}; _isLoadingStatus = false;});}
      } else { if (mounted) setState(() { _isLoadingStatus = false; _errorMessageStatus = "Erreur serveur (${response.statusCode})."; });}
    } catch (e) { if (mounted) { setState(() { documentStatuses = {'En cours': 0, 'Validé': 0, 'À revoir': 0}; _isLoadingStatus = false; _errorMessageStatus = "Erreur connexion (status)"; });}}
  }

  Future<void> fetchRecentDocuments() async {
    final String? token = await getAuthToken();
    if (token == null || token.isEmpty) {
      if (mounted) setState(() { _isLoadingRecent = false; recentDocuments = []; _errorMessageRecent = "Authentification requise."; });
      return;
    }
    final url = '$API_BASE_URL/documents/recent-documents';
    print('➡️ [Home] Appel API Recent Docs: GET $url');
    try {
      final response = await _dio.get(url, options: Options(headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'}, receiveTimeout: const Duration(seconds: 20), sendTimeout: const Duration(seconds: 20),));
      print('⬅️ [Home] Recent Docs Réponse Status: ${response.statusCode}');
      if (response.statusCode == 200 && response.data != null && response.data is List) {
        final List<dynamic> data = response.data;
        if (mounted) {
          setState(() {
            recentDocuments = data.map<DocumentItem?>((doc) { // map vers DocumentItem?
              final dynamic idFromApi = doc['id']; // Adaptez si le nom du champ ID est différent

              if (idFromApi == null || !(idFromApi is int) || idFromApi <= 0) {
                print("AVERTISSEMENT [Home]: ID manquant ou invalide pour le document récent API: ${doc['nom_fichier'] ?? 'Sans nom'} (ID reçu: $idFromApi). Ce document ne sera pas fonctionnel.");
                return null; // Ignorer ce document
              }
              final int validId = idFromApi;

              final title = doc['nom_fichier'] as String? ?? 'Document Inconnu (ID: $validId)';
              final filePath = doc['chemin_fichier'] as String?;
              final time = doc['created_at']?.toString() ?? doc['uploaded_at']?.toString() ?? DateTime.now().toIso8601String();
              final originalApiType = doc['type']?.toString().toLowerCase().trim() ?? 'unknown';
              final apiStatus = doc['statut']?.toString().toLowerCase().trim();

              print("  [Home] Recent Doc Mapped: id=$validId, title=$title, filePath=$filePath, apiType=$originalApiType, apiStatus=$apiStatus");

              Color typeColorForDisplay = Colors.grey;
              String fileTypeForDisplay = "DOC";
              if (originalApiType.contains('facture_achat')) { typeColorForDisplay = Color(0xFF3B82F6); fileTypeForDisplay = 'F.ACHAT';
              } else if (originalApiType.contains('facture_vente')) { typeColorForDisplay = Color(0xFF10B981); fileTypeForDisplay = 'F.VENTE';
              } else if (originalApiType.contains('bon_livraison')) { typeColorForDisplay = Color(0xFFF59E0B); fileTypeForDisplay = 'B.L.';
              } else if (originalApiType == 'pdf') { typeColorForDisplay = Color(0xFFEF4444); fileTypeForDisplay = 'PDF';
              } else if (['jpg', 'jpeg', 'png'].contains(originalApiType)) { typeColorForDisplay = Color(0xFFA855F7); fileTypeForDisplay = 'IMG';
              }

              return DocumentItem(
                id: validId,
                filePath: filePath,
                title: title,
                time: time,
                fileTypeForDisplay: fileTypeForDisplay,
                typeColorForDisplay: typeColorForDisplay,
                originalApiType: originalApiType,
                apiStatus: apiStatus,
              );
            }).whereType<DocumentItem>().toList(); // Filtrer les nulls et caster
            _isLoadingRecent = false;
          });
        }
      } else {
        if (mounted) setState(() { _isLoadingRecent = false; recentDocuments = []; _errorMessageRecent = "Erreur serveur (${response.statusCode}) pour documents récents.";});
      }
    } catch (e) {
      print('❌ [Home] Exception fetchRecentDocuments: $e');
      if (mounted) {
        setState(() { recentDocuments = []; _isLoadingRecent = false; _errorMessageRecent = "Erreur de connexion (documents récents)"; });
      }
    }
  }

  void _toggleDialog() {
    if (mounted) setState(() { _showDialog = !_showDialog; });
  }

  void _refreshRecentDocuments() {
    if (mounted) {
      print("[Home] Rafraîchissement des documents récents demandé.");
      setState(() { _isLoadingRecent = true; _errorMessageRecent = null; });
      fetchRecentDocuments();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          Container(decoration: BoxDecoration(color: Colors.white)),
          Container( height: 200, decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [const Color(0xFF2563EB), const Color(0xFF3B82F6).withOpacity(0.9)],), borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(35), bottomRight: Radius.circular(35),), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 15, offset: Offset(0, 5),)],),),
          SafeArea(
            child: RefreshIndicator(
              onRefresh: _loadData,
              color: const Color(0xFF2563EB),
              child: CustomScrollView(
                slivers: [
                  SliverAppBar( backgroundColor: Colors.transparent, 
                  elevation: 0, 
                  pinned: true, 
                  floating: false, 
                  automaticallyImplyLeading: false, 
                  toolbarHeight: 70, flexibleSpace: Padding(padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10,), 
                  child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, 
                  children: [
               Container(
                              height: 68,
                              width: 50,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(24),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.1),
                                    blurRadius: 10,
                                    offset: const Offset(0, 5),
                                  )
                                ],
                              ),
                              child: Padding(
                                padding: const EdgeInsets.all(8.0),
                                child: Image.asset('assets/logo.png'),
                              ),
                            ),
                            
                       Row(children: [GestureDetector(onTap: _toggleDialog, child: CircleAvatar(radius: 18, backgroundColor: Colors.white.withOpacity(0.9), 
                       child: Text(userName.isNotEmpty ? userName[0].toUpperCase() : "U", 
                       style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold, fontSize: 16),),),),],),],),),),
                  SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.fromLTRB(20, 20, 20, 0), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Bienvenue, ${userName.isNotEmpty ? userName.split(' ').first : "cher utilisateur"} !', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),), const SizedBox(height: 6), Text('Votre espace de gestion documentaire.', style: TextStyle(fontSize: 15, color: Colors.white.withOpacity(0.85)),), const SizedBox(height: 25),],),),),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container( margin: const EdgeInsets.only(bottom: 25, top: 0), padding: const EdgeInsets.symmetric(horizontal: 8), height: 52, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 3),)],), child: Row(children: [const Padding(padding: EdgeInsets.symmetric(horizontal: 8.0,), child: Icon(Icons.search, color: Color(0xFF64748B), size: 22,),), Expanded(child: TextField(decoration: InputDecoration(hintText: 'Rechercher un document...', border: InputBorder.none, hintStyle: TextStyle(color: const Color(0xFF94A3B8), fontSize: 15,),), style: const TextStyle(fontSize: 15),),), ],),),
                          const Text('Vue d\'ensemble', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
                          const SizedBox(height: 16),
                          if (_errorMessageStatus != null && !_isLoadingStatus) Padding(padding: const EdgeInsets.only(bottom: 16.0), child: Center(child: Text('$_errorMessageStatus', style: const TextStyle(color: Colors.red, fontSize: 14)))),
                          _isLoadingStatus ? const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 30), child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF2563EB))))) : AnimatedBuilder(animation: _animation, builder: (context, child) { return Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [_buildAnimatedStatusCard(context, 'En cours', documentStatuses['En cours']?.toString() ?? '0', const Color(0xFF3B82F6), Icons.hourglass_empty_rounded, 0, isSelected: true), _buildAnimatedStatusCard(context, 'Validé', documentStatuses['Validé']?.toString() ?? '0', const Color(0xFF10B981), Icons.check_circle_outline_rounded, 1), _buildAnimatedStatusCard(context, 'À revoir', documentStatuses['À revoir']?.toString() ?? '0', const Color(0xFFF43F5E), Icons.error_outline_rounded, 2),]);},),
                          const SizedBox(height: 20),
                          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Documents Récents', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))), TextButton.icon(onPressed: () => Navigator.pushReplacementNamed(context, '/documents'), icon: const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: Color(0xFF3B82F6)), label: const Text('Voir tout', style: TextStyle(color: Color(0xFF3B82F6), fontWeight: FontWeight.w500, fontSize: 14)), style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 0, vertical: 6))),],),
                          const SizedBox(height: 12),
                          if (_errorMessageRecent != null && !_isLoadingRecent) Padding(padding: const EdgeInsets.only(bottom: 16.0), child: Center(child: Text('$_errorMessageRecent', style: const TextStyle(color: Colors.red, fontSize: 14)))),
                          _isLoadingRecent
                              ? const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 40.0), child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF2563EB)))))
                              : recentDocuments.isEmpty
                                  ? Center(child: Padding(padding: const EdgeInsets.symmetric(vertical: 40.0), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.inbox_outlined, size: 48, color: Colors.grey[350]), const SizedBox(height: 12), Text(_errorMessageRecent == null ? 'Aucun document récent.' : '', style: TextStyle(fontSize: 15, color: Colors.grey.shade600),), ],),),)
                                  
                                  
                          
                                  
                                  : ListView.builder(
                                      physics: const NeverScrollableScrollPhysics(),
                                      shrinkWrap: true,
                                      itemCount: math.min(recentDocuments.length, 4),
                                      itemBuilder: (context, index) {
                                        final docItem = recentDocuments[index];
                                        final delay = index * 0.1;
                                        final animValue = _animation.value > delay ? (_animation.value - delay).clamp(0.0, 1.0) / (1 - delay) : 0.0;
                                        return Transform.translate(
                                          offset: Offset(0, 20 * (1 - animValue)),
                                          child: Opacity(
                                            opacity: animValue,
                                            child: Padding(
                                              padding: const EdgeInsets.only(bottom: 10.0),
                                              child: _buildDocumentItem(context, docItem, index),
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                          Container( width: double.infinity, margin: const EdgeInsets.symmetric(vertical: 30), height: 52, decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), gradient: const LinearGradient(colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],), boxShadow: [BoxShadow(color: const Color(0xFF2563EB,).withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 4),)],), child: ElevatedButton.icon(onPressed: () => Navigator.pushReplacementNamed(context, '/upload'), style: ElevatedButton.styleFrom(backgroundColor: Colors.transparent, shadowColor: Colors.transparent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14),),), icon: const Icon(Icons.add_circle_outline_rounded, color: Colors.white, size: 22,), label: const Text('Ajouter un document', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600,),),),),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_showNotification) Positioned(top: MediaQuery.of(context).padding.top + 80, left: 16, right: 16, child: SlideTransition(position: Tween<Offset>(begin: const Offset(0, -1.5), end: Offset.zero).animate(CurvedAnimation(parent: _animationController, curve: Interval(0.4, 0.7, curve: Curves.elasticOut))), child: FadeTransition(opacity: Tween<double>(begin: 0.0, end: 1.0).animate(CurvedAnimation(parent: _animationController, curve: Interval(0.4, 0.6, curve: Curves.easeOut))), child: Material(elevation: 6, borderRadius: BorderRadius.circular(12), child: Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), decoration: BoxDecoration(color: Color(0xFFE0F2FE), borderRadius: BorderRadius.circular(12), border: Border.all(color: Color(0xFF7DD3FC).withOpacity(0.5))), child: Row(children: [Icon(Icons.campaign_outlined, color: Color(0xFF0EA5E9), size: 22), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Bienvenue, ${userName.isNotEmpty ? userName.split(" ").first : ""}!', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0C4A6E))), const SizedBox(height: 2), Text('Ravi de vous revoir sur Cleverbills.', style: TextStyle(fontSize: 12, color: Color(0xFF0C4A6E).withOpacity(0.9))),],),), IconButton(icon: Icon(Icons.close_rounded, size: 18, color: Color(0xFF38BDF8)), onPressed: () { if (mounted) setState(() { _showNotification = false; }); }),],),),),),),),
          if (_showDialog) Positioned(top: MediaQuery.of(context).padding.top + 60, right: 20, child: Material(elevation: 8.0, borderRadius: BorderRadius.circular(12), shadowColor: Colors.black.withOpacity(0.2), child: Container(padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16), width: 220, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [Padding(padding: const EdgeInsets.only(bottom: 8.0, top: 4.0), child: Text('Bonjour ${userName.isNotEmpty ? userName.split(" ").first : ""}!', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B)), maxLines: 1, overflow: TextOverflow.ellipsis,),), _buildPopupUserMenuItem(Icons.person_outline_rounded, 'Mon profil', () { _toggleDialog(); Navigator.pushReplacementNamed(context, '/profile'); }), const Divider(height: 12, thickness: 0.5), _buildPopupUserMenuItem(Icons.logout_rounded, 'Déconnexion', () async { _toggleDialog(); await AuthService.logout(context, sharedPrefsKeysToClear: [WELCOME_NOTIFICATION_KEY]);}, isDestructive: true),],),),),),
        ],
      ),
      bottomNavigationBar: Container( decoration: BoxDecoration(boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -5),),],), child: ClipRRect(borderRadius: const BorderRadius.only(topLeft: Radius.circular(20), topRight: Radius.circular(20),), child: BottomNavigationBar(type: BottomNavigationBarType.fixed, selectedItemColor: const Color(0xFF2196F3), unselectedItemColor: Colors.grey, currentIndex: 0, backgroundColor: Colors.white, elevation: 10, selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12,), unselectedLabelStyle: const TextStyle(fontSize: 12), onTap: (index) { if (index == 0 && ModalRoute.of(context)?.settings.name == '/home') return; String routeName; switch (index) { case 0: routeName = '/home'; break; case 1: routeName = '/upload'; break; case 2: routeName = '/documents'; break; case 3: routeName = '/profile'; break; default: return;} Navigator.pushReplacementNamed(context, routeName);}, items: const [BottomNavigationBarItem(icon: Icon(Icons.home_outlined, size: 24), activeIcon: Icon(Icons.home_rounded, size: 26), label: 'Accueil'), BottomNavigationBarItem(icon: Icon(Icons.cloud_upload_outlined, size: 24), activeIcon: Icon(Icons.cloud_upload_rounded, size: 26), label: 'Déposer'), BottomNavigationBarItem(icon: Icon(Icons.folder_copy_outlined, size: 24), activeIcon: Icon(Icons.folder_copy_rounded, size: 26), label: 'Documents'), BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded, size: 24), activeIcon: Icon(Icons.person_rounded, size: 26), label: 'Profil'),],),),),
    );
  }

  Widget _buildDocumentItem(BuildContext context, DocumentItem docItem, int index) {
    String formattedTime = 'Date inconnue';
    try {
      DateTime? parsedDate = DateTime.tryParse(docItem.time);
      if (parsedDate != null) {
        formattedTime = DateFormat('dd MMM yy, HH:mm', 'fr_FR').format(parsedDate.toLocal());
      }
    } catch (e) { /* Géré par fallback */ }

    return Card(
      elevation: 1.5,
      margin: const EdgeInsets.only(bottom: 10.0),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: Colors.white,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          final docInfo = docItem.toDocumentInfo();
          print("[Home _buildDocumentItem onTap -> View] Converting DocumentItem (id: ${docItem.id}, title: ${docItem.title}) to DocumentInfo (id: ${docInfo.id}, fileName: ${docInfo.fileName}, type: ${docInfo.type}, status: ${docInfo.status}, filePath: ${docInfo.filePath})");
          _documentService.viewDocument(context, docInfo);
        },
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Row(
            children: [
              Container(
                width: 42, height: 42,
                decoration: BoxDecoration(color: docItem.typeColorForDisplay.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
                child: Center(child: Text(docItem.fileTypeForDisplay, textAlign: TextAlign.center, style: TextStyle(color: docItem.typeColorForDisplay, fontWeight: FontWeight.bold, fontSize: 9))),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(docItem.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5, color: Color(0xFF374151)), maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Text(formattedTime, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                icon: Icon(Icons.more_vert_rounded, color: Colors.grey.shade500, size: 22),
                tooltip: "Options",
                offset: const Offset(0, 35),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                itemBuilder: (context) => [
                  _buildPopupMenuItem(context, Icons.visibility_outlined, 'Aperçu', 'view'),
                  _buildPopupMenuItem(context, Icons.edit_outlined, 'Renommer', 'rename'),
                  // _buildPopupMenuItem(context, Icons.share_outlined, 'Partager', 'share'),
                  const PopupMenuDivider(height: 1),
                  _buildPopupMenuItem(context, Icons.delete_outline_rounded, 'Supprimer', 'delete', isDestructive: true),
                ],
                onSelected: (value) {
                  final documentInfoForService = docItem.toDocumentInfo();
                  print("[Home _buildDocumentItem onSelected] Action: $value. Converting DocumentItem (id: ${docItem.id}, title: ${docItem.title}) to DocumentInfo (id: ${documentInfoForService.id}, fileName: ${documentInfoForService.fileName}, type: ${documentInfoForService.type}, status: ${documentInfoForService.status}, filePath: ${documentInfoForService.filePath})");

                  if (documentInfoForService.id <= 0) { // Vérification supplémentaire de l'ID
                      print("ERREUR: Tentative d'action sur un document avec ID invalide: ${documentInfoForService.id}");
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text("Impossible d'effectuer l'action: ID de document invalide."), backgroundColor: Colors.red),
                      );
                      return;
                  }

                  switch (value) {
                    case 'view':
                      _documentService.viewDocument(context, documentInfoForService);
                      break;
                    case 'download':
                      _documentService.downloadDocumentForUser(context, documentInfoForService);
                      break;
                    case 'rename':
                      _documentService.showRenameDialog(context, documentInfoForService, _refreshRecentDocuments);
                      break;
                    // case 'share':
                    //   _documentService.shareDocument(context, documentInfoForService);
                    //   break;
                    case 'delete':
                      _documentService.deleteDocument(context, documentInfoForService, _refreshRecentDocuments);
                      break;
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  PopupMenuItem<String> _buildPopupMenuItem(BuildContext context, IconData icon, String text, String value, {bool isDestructive = false}) {
    Color itemColor = isDestructive ? Colors.red.shade600 : Theme.of(context).textTheme.bodyLarge?.color?.withOpacity(0.85) ?? Colors.black.withOpacity(0.85);
    return PopupMenuItem<String>(value: value, height: 44, child: Row(children: [Icon(icon, size: 19, color: itemColor), SizedBox(width: 12), Text(text, style: TextStyle(color: itemColor, fontSize: 14, fontWeight: FontWeight.w500)),],),);
  }

  Widget _buildAnimatedStatusCard(BuildContext context, String title, String value, Color color, IconData icon, int index, {bool isSelected = false}) {
    final delay = index * 0.1; final animValue = _animation.value > delay ? (_animation.value - delay).clamp(0.0, 1.0) / (1 - delay) : 0.0; return Expanded(child: Padding(padding: EdgeInsets.only(left: index == 0 ? 0 : 6, right: index == 2 ? 0 : 6), child: Transform.scale(scale: 0.9 + (0.1 * animValue), child: Opacity(opacity: animValue, child: Card(elevation: isSelected ? 4.0 : 2.0, color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: isSelected ? color.withOpacity(0.8) : Colors.grey.shade200, width: isSelected ? 1.5 : 1.0),), child: Padding(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, crossAxisAlignment: CrossAxisAlignment.start, children: [Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: color, size: 20),), Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),],), const SizedBox(height: 10), Text(title, style: TextStyle(fontSize: 12.5, color: Colors.grey.shade700, fontWeight: FontWeight.w600),),],),),),),),),);
  }
  Widget _buildPopupUserMenuItem(IconData icon, String text, VoidCallback onTap, {bool isDestructive = false}) {
    return Material(color: Colors.transparent, child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(8), child: Padding(padding: const EdgeInsets.symmetric(vertical: 10.0, horizontal: 4.0), child: Row(children: [Icon(icon, size: 20, color: isDestructive ? Colors.red.shade600 : Color(0xFF4B5563)), const SizedBox(width: 12), Text(text, style: TextStyle(fontSize: 14.5, color: isDestructive ? Colors.red.shade600 : Color(0xFF374151), fontWeight: FontWeight.w500)),],),),),);
  }
}



