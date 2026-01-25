// lib/screens/documents.dart (ou votre chemin vers UploadHistoryPage)
import 'package:flutter/material.dart';
import 'package:dio/dio.dart'; 
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/cupertino.dart';
import 'package:intl/intl.dart';
import 'document_info.dart';
import 'documents_service.dart';
import 'auth_service.dart';
import 'document_card_widget.dart';

// --- Fonctions globales/utilitaires (si encore nécessaires ici) ---
const String API_BASE_URL = "http://192.168.1.14:8000/api";

Future<String?> getAuthToken() async {
  return await const FlutterSecureStorage().read(key: 'token');
}

Future<List<DocumentInfo>> fetchDocumentsApi() async {
  String? token = await getAuthToken();
  if (token == null || token.isEmpty) throw Exception('Token non trouvé. Veuillez vous reconnecter.');

  final dio = Dio();
  final url = '$API_BASE_URL/documents';
  try {
    final response = await dio.get(url,
        options: Options(
            headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
            receiveTimeout: const Duration(seconds: 30),
            sendTimeout: const Duration(seconds: 30),
        ));
    if (response.statusCode == 200 && response.data != null && response.data is List) {
      return (response.data as List).map((json) => DocumentInfo.fromJson(json)).toList();
    } else {
      throw Exception('Erreur lors du chargement des documents: ${response.statusCode}');
    }
  } on DioException catch (e) {
    String errorMessage = 'Erreur réseau lors de la récupération des documents.';
    if (e.response?.statusCode == 401) {
        errorMessage = 'Session expirée. Veuillez vous reconnecter.';
    }
    throw Exception(errorMessage);
  } catch (e) {
    throw Exception('Erreur inconnue lors de la récupération des documents: $e');
  }
}

class UploadHistoryPage extends StatefulWidget {
  const UploadHistoryPage({Key? key}) : super(key: key);
  @override
  State<UploadHistoryPage> createState() => _UploadHistoryPageState();
}

class _UploadHistoryPageState extends State<UploadHistoryPage> with SingleTickerProviderStateMixin {
  final TextEditingController _searchController = TextEditingController();
  List<DocumentInfo> _allDocuments = [];
  List<DocumentInfo> _filteredDocuments = [];
  bool _isLoading = true;
  String? _errorMessage;
  late TabController _tabController;

  String _currentStatusFilter = 'tous';
  String _currentTypeFilter = 'tous_types';
  bool _sortAscending = false;
  bool _isSearchFocused = false;

  final DocumentService _documentService = DocumentService();

  // Palette de couleurs inspirée de home.dart
  final Color _primaryColor = const Color(0xFF3B82F6); // Bleu principal de home.dart
  final Color _accentColor = const Color(0xFFE0F2FE); // Bleu très clair (comme la notif home)
  final Color _lightBorderColor = Colors.blue.shade100; // Pour bordures subtiles
  
  final Color _textColorPrimary = const Color(0xFF1E293B); // Texte principal de home.dart
  final Color _textColorSecondary = const Color(0xFF64748B); // Texte secondaire de home.dart
  final Color _hintTextColor = const Color(0xFF94A3B8); // Hint text de home.dart
  final Color _errorColor = const Color(0xFFD32F2F); // ou EF4444 de home
  
  final Color _cardColor = Colors.white;
  final Color _scaffoldBgColor = Colors.white;

  final ScrollController _scrollController = ScrollController();
  final FocusNode _searchFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(_handleTabSelection);
    _searchFocusNode.addListener(_handleFocusChange);
    _checkTokenAndLoadDocuments();
  }

  Future<void> _checkTokenAndLoadDocuments() async {
    if (!mounted) return;
    final token = await getAuthToken();
    AuthService.redirectToLoginIfNoToken(context, token);
    if (token == null) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = "Authentification requise. Veuillez vous reconnecter.";
        });
      }
      return;
    }
    _loadDocuments();
  }

  @override
  void dispose() {
    _tabController.removeListener(_handleTabSelection);
    _tabController.dispose();
    _searchController.dispose();
    _scrollController.dispose();
    _searchFocusNode.removeListener(_handleFocusChange);
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _handleFocusChange() {
    if (mounted) setState(() { _isSearchFocused = _searchFocusNode.hasFocus; });
  }

  void _handleTabSelection() {
    if (_tabController.indexIsChanging || !mounted) return;
    String newFilter;
    switch (_tabController.index) {
      case 0: newFilter = 'tous'; break;
      case 1: newFilter = 'en_cours'; break;
      case 2: newFilter = 'traite'; break;
      case 3: newFilter = 'a_revoir'; break;
      default: newFilter = 'tous';
    }
    if (_currentStatusFilter != newFilter) {
      if (mounted) setState(() { _currentStatusFilter = newFilter; });
      _applyFilters();
    }
  }

  void _applyFilters() {
    if (!mounted) return;
    final String searchQuery = _searchController.text.toLowerCase().trim();
    setState(() {
      _filteredDocuments = _allDocuments.where((doc) {
        final statusMatch = (_currentStatusFilter == 'tous') || (doc.status == _currentStatusFilter);
        final typeMatch = (_currentTypeFilter == 'tous_types') ||
            (_currentTypeFilter == 'facture' && doc.type.contains('facture')) ||
            (_currentTypeFilter == 'bon_livraison' && doc.type == 'bon_livraison');
        final searchMatch = searchQuery.isEmpty ||
            doc.fileName.toLowerCase().contains(searchQuery) ||
            doc.typeFormatted.toLowerCase().contains(searchQuery) ||
            (doc.entrepriseNom?.toLowerCase().contains(searchQuery) ?? false);
        return statusMatch && typeMatch && searchMatch;
      }).toList()
        ..sort((a, b) => _sortAscending ? a.uploadedAt.compareTo(b.uploadedAt) : b.uploadedAt.compareTo(a.uploadedAt));
    });
  }

  Future<void> _loadDocuments() async {
    if (!mounted) return;
    setState(() { _isLoading = true; _errorMessage = null; });
    try {
      final documents = await fetchDocumentsApi();
      if (mounted) {
        setState(() {
          _allDocuments = documents;
          _isLoading = false;
        });
        _applyFilters();
      }
    } catch (e) {
      if (mounted) {
        String errorMsg = e.toString().replaceFirst("Exception: ", "");
        setState(() { _errorMessage = errorMsg; _isLoading = false; });
        if (errorMsg.contains("Session expirée") || errorMsg.contains("Token non trouvé")) {
            AuthService.redirectToLoginIfNoToken(context, null);
        }
      }
    }
  }

  IconData _getFileIcon(String fileName) {
    final ext = fileName.split('.').last.toLowerCase();
    if (ext == 'pdf') return CupertinoIcons.doc_richtext;
    if (['jpg', 'jpeg', 'png'].contains(ext)) return CupertinoIcons.photo_fill_on_rectangle_fill;
    return CupertinoIcons.doc_fill;
  }

  Color _getFileIconColor(String fileName) {
    final ext = fileName.split('.').last.toLowerCase();
    if (ext == 'pdf') return const Color(0xFFEF4444); // Rouge de home.dart
    if (['jpg', 'jpeg', 'png', 'gif'].contains(ext)) return const Color(0xFFA855F7); // Violet/rose de home.dart
    return _textColorSecondary; // Couleur neutre
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'en_cours': return const Color(0xFFF59E0B); // Orange de home.dart (pour BL, mais bon pour 'en cours')
      case 'traite': return const Color(0xFF10B981);   // Vert de home.dart
      case 'a_revoir': return const Color(0xFFEF4444); // Rouge de home.dart
      default: return _textColorSecondary;
    }
  }

  String _formatStatus(String status) {
    switch (status.toLowerCase()) {
      case 'en_cours': return 'En Cours';
      case 'traite': return 'Traité';
      case 'a_revoir': return 'À Revoir';
      default: return status.isNotEmpty ? status[0].toUpperCase() + status.substring(1) : 'N/A';
    }
  }

  Widget _buildEmptyState() {
    bool noFiltersApplied = _searchController.text.isEmpty && _currentTypeFilter == 'tous_types' && _currentStatusFilter == 'tous';
    return Container(alignment: Alignment.center, padding: const EdgeInsets.all(32.0), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [ Icon(noFiltersApplied ? CupertinoIcons.doc_text_search : CupertinoIcons.search_circle_fill, size: 70, color: _textColorSecondary.withOpacity(0.5)), const SizedBox(height: 20), Text(noFiltersApplied ? 'Aucun document trouvé' : 'Aucun résultat pour votre recherche', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: _textColorPrimary), textAlign: TextAlign.center,), const SizedBox(height: 10), Text(noFiltersApplied ? 'Vos documents téléversés apparaîtront ici.' : 'Essayez de modifier vos filtres ou votre terme de recherche.', style: TextStyle(fontSize: 14, color: _textColorSecondary), textAlign: TextAlign.center,), if (!noFiltersApplied) Padding(padding: const EdgeInsets.only(top: 24), child: ElevatedButton.icon(icon: const Icon(CupertinoIcons.clear_circled, size: 18), label: const Text('Effacer les filtres'), style: ElevatedButton.styleFrom(backgroundColor: _primaryColor.withOpacity(0.1), foregroundColor: _primaryColor, elevation: 0, padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20),),), onPressed: () { _searchController.clear(); if(mounted) { setState(() { _currentTypeFilter = 'tous_types'; _tabController.animateTo(0);});} _applyFilters(); _searchFocusNode.unfocus(); },),),],),);
  }

  Widget _buildErrorState() {
    return Container(alignment: Alignment.center, padding: const EdgeInsets.all(32.0), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [ Icon(CupertinoIcons.wifi_slash, size: 70, color: _errorColor.withOpacity(0.6)), const SizedBox(height: 20), Text('Erreur de chargement', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: _errorColor),), const SizedBox(height: 10), Text(_errorMessage ?? 'Impossible de charger les documents. Veuillez vérifier votre connexion.', style: TextStyle(fontSize: 14, color: _textColorSecondary), textAlign: TextAlign.center,), const SizedBox(height: 24), ElevatedButton.icon(icon: const Icon(Icons.refresh_rounded, size: 20), label: const Text('Réessayer'), style: ElevatedButton.styleFrom(backgroundColor: _primaryColor, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25),), textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)), onPressed: _checkTokenAndLoadDocuments,), ],),);
  }

  Widget _buildBottomNavigationBar(BuildContext context, int currentIndex) {
    // NE PAS MODIFIER CETTE FONCTION (BottomNavigationBar) - comme demandé
    return Container(decoration: BoxDecoration(boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -5),),],), child: ClipRRect(borderRadius: const BorderRadius.only(topLeft: Radius.circular(20), topRight: Radius.circular(20),), child: BottomNavigationBar(type: BottomNavigationBarType.fixed, selectedItemColor: const Color(0xFF2196F3), unselectedItemColor: Colors.grey, currentIndex: currentIndex, backgroundColor: Colors.white, elevation: 10, selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12,), unselectedLabelStyle: const TextStyle(fontSize: 12), onTap: (index) { if (index == currentIndex && ModalRoute.of(context)?.settings.name == ['/home', '/upload', '/documents', '/profile'][index] ) return; String routeName; switch (index) { case 0: routeName = '/home'; break; case 1: routeName = '/upload'; break; case 2: routeName = '/documents'; break; case 3: routeName = '/profile'; break; default: return; } Navigator.pushReplacementNamed(context, routeName);}, items: const [BottomNavigationBarItem(icon: Icon(Icons.home_outlined, size: 24), activeIcon: Icon(Icons.home_rounded, size: 26), label: 'Accueil'), BottomNavigationBarItem(icon: Icon(Icons.cloud_upload_outlined, size: 24), activeIcon: Icon(Icons.cloud_upload_rounded, size: 26), label: 'Déposer'), BottomNavigationBarItem(icon: Icon(Icons.folder_copy_outlined, size: 24), activeIcon: Icon(Icons.folder_copy_rounded, size: 26), label: 'Documents'), BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded, size: 24), activeIcon: Icon(Icons.person_rounded, size: 26), label: 'Profil'),],),),);
  }

  Widget _buildTypeFilterChip(String label, String filterValue) {
    final bool isSelected = _currentTypeFilter == filterValue;
    return FilterChip(
      label: Text(label, style: TextStyle(fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal, fontSize: 13.5)),
      selected: isSelected,
      onSelected: (selected) {
        if (mounted) {
          setState(() { _currentTypeFilter = filterValue; });
          _applyFilters();
        }
      },
      backgroundColor: _cardColor, 
      selectedColor: _primaryColor.withOpacity(0.1), 
      labelStyle: TextStyle(color: isSelected ? _primaryColor : _textColorSecondary),
      shape: StadiumBorder(
        side: BorderSide(
          color: isSelected ? _primaryColor : _lightBorderColor, 
          width: isSelected ? 1.5 : 1.2,
        )
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
      showCheckmark: false,
      elevation: isSelected ? 1 : 0,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _scaffoldBgColor,
      appBar: AppBar(
        backgroundColor: _cardColor, 
        elevation: 0.8, 
        centerTitle: false,
        titleSpacing: 16.0,
        title: Text('Mes Documents', style: TextStyle(fontWeight: FontWeight.bold, color: _textColorPrimary, fontSize: 22)),
        iconTheme: IconThemeData(color: _textColorPrimary),
        actions: [
          IconButton(
            icon: Icon(
              _sortAscending ? CupertinoIcons.sort_up : CupertinoIcons.sort_down,
              color: _primaryColor.withOpacity(0.9),
              size: 22
            ),
            tooltip: _sortAscending ? "Plus anciens" : "Plus récents",
            onPressed: () { if (mounted) { setState(() { _sortAscending = !_sortAscending; }); _applyFilters(); }}
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // Section Recherche et Filtres de Type
          Container(
            padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 12.0),
            color: _cardColor, 
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Barre de recherche stylisée comme home.dart
                Container(
                  height: 50,
                  decoration: BoxDecoration(
                    color: _cardColor, // Fond blanc pour le champ
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.grey.withOpacity(0.15), // Ombre plus subtile
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      )
                    ],
                    border: Border.all(color: _lightBorderColor.withOpacity(0.7))
                  ),
                  child: Row(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12.0),
                        child: Icon(
                          CupertinoIcons.search, 
                          color: _searchFocusNode.hasFocus ? _primaryColor : _textColorSecondary, 
                          size: 20
                        ),
                      ),
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          focusNode: _searchFocusNode,
                          style: TextStyle(fontSize: 15, color: _textColorPrimary),
                          decoration: InputDecoration(
                            hintText: 'Rechercher un document...',
                            hintStyle: TextStyle(color: _hintTextColor, fontSize: 15),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(vertical: 15.0),
                          ),
                          onChanged: (value) => _applyFilters(),
                        ),
                      ),
                      if (_searchController.text.isNotEmpty)
                        IconButton(
                          icon: Icon(CupertinoIcons.clear_thick_circled, color: _textColorSecondary.withOpacity(0.7), size: 18),
                          onPressed: () { _searchController.clear(); _applyFilters(); _searchFocusNode.unfocus(); }
                        ),
                      const SizedBox(width: 4), // petit espace avant le bord
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.only(bottom: 4.0),
                  child: Row(
                    children: [
                      _buildTypeFilterChip('Tous les types', 'tous_types'), const SizedBox(width: 10),
                      _buildTypeFilterChip('Factures', 'facture'), const SizedBox(width: 10),
                      _buildTypeFilterChip('Bons de livraison', 'bon_livraison'),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // TabBar pour les Statuts
          Container(
            decoration: BoxDecoration(
              color: _cardColor, 
              border: Border(
                bottom: BorderSide(color: _lightBorderColor.withOpacity(0.8), width: 1.0)
              )
            ),
            child: TabBar(
              controller: _tabController,
              isScrollable: true,
              indicator: UnderlineTabIndicator(
                borderSide: BorderSide(color: _primaryColor, width: 3.0),
                insets: const EdgeInsets.symmetric(horizontal: 16.0)
              ),
              indicatorSize: TabBarIndicatorSize.label,
              labelColor: _primaryColor,
              unselectedLabelColor: _textColorSecondary,
              labelPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2), // Ajusté
              labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, letterSpacing: 0.1),
              unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
              tabs: const [ Tab(text: 'Tous'), Tab(text: 'En Attente'), Tab(text: 'Validés'), Tab(text: 'Rejetés') ],
            ),
          ),

          Expanded(
            child: RefreshIndicator(
              onRefresh: _checkTokenAndLoadDocuments,
              color: _primaryColor,
              backgroundColor: _cardColor,
              child: _isLoading
                  ? Center(child: CupertinoActivityIndicator(radius: 15, color: _primaryColor))
                  : _errorMessage != null
                      ? _buildErrorState()
                      : _filteredDocuments.isEmpty
                          ? _buildEmptyState()
                          : ListView.builder(
                              controller: _scrollController,
                              padding: const EdgeInsets.fromLTRB(14, 14, 14, 16), // Ajusté
                              itemCount: _filteredDocuments.length,
                              itemBuilder: (context, index) {
                                final doc = _filteredDocuments[index];
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 10.0), // Espace entre cartes
                                  child: DocumentCardWidget(
                                    key: ValueKey(doc.id),
                                    doc: doc,
                                    getFileIcon: _getFileIcon,
                                    getFileIconColor: _getFileIconColor,
                                    getStatusColor: _getStatusColor,
                                    formatStatus: _formatStatus,
                                    primaryColor: _primaryColor,
                                    textColorPrimary: _textColorPrimary,
                                    textColorSecondary: _textColorSecondary,
                                    cardColor: _cardColor,
                                    // Assurez-vous que DocumentCardWidget a une élévation et un style cohérent
                                    // Par exemple, elevation: 1.5, borderRadius: 12
                                    onView: () => _documentService.viewDocument(context, doc),
                                    onDownload: () => _documentService.downloadDocumentForUser(context, doc),
                                    onRename: () => _documentService.showRenameDialog(context, doc, _checkTokenAndLoadDocuments),
                                    onShare: () => _documentService.shareDocument(context, doc),
                                    onDelete: () => _documentService.deleteDocument(context, doc, _checkTokenAndLoadDocuments),
                                  ),
                                );
                              },
                            ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomNavigationBar(context, 2),
    );
  }
}