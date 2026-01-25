import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart'; // Pour DateFormat
import 'package:flutter/cupertino.dart'; // Pour CupertinoActivityIndicator
import 'auth_service.dart'; // Assurez-vous que le chemin est correct
import 'edit_profile_page.dart';
import 'change_password_page.dart';  



// Gardez vos constantes et fonctions globales
Future<String?> getAuthToken() async {
  const storage = FlutterSecureStorage();
  return await storage.read(key: 'token');
}
const String API_BASE_URL = "http://192.168.1.14:8000/api"; // Votre IP locale
const String WELCOME_NOTIFICATION_KEY = 'last_welcome_notification_time_profile';

// Vos modèles de données existants
class UserProfileInfo {
  final String companyName;
  final String email;
  final String phone;
  final String address;
  final String initials;

  UserProfileInfo({
    required this.companyName,
    required this.email,
    required this.phone,
    required this.address,
    required this.initials,
  });

  factory UserProfileInfo.fromJson(Map<String, dynamic> json) {
    String name = json['nom_entreprise'] ?? json['name'] ?? 'N/A';
    String initials = "N/A";
    if (name != 'N/A' && name.isNotEmpty) {
      List<String> parts = name.split(' ');
      if (parts.isNotEmpty) {
        initials = parts.map((p) => p.isNotEmpty ? p[0].toUpperCase() : '').take(3).join();
         if (initials.isEmpty && name.length >= 2) initials = name.substring(0,2).toUpperCase();
         else if (initials.isEmpty && name.isNotEmpty) initials = name[0].toUpperCase();
      } else if (name.isNotEmpty) {
        initials = name[0].toUpperCase();
      }
    }
    return UserProfileInfo(
      companyName: name,
      email: json['email'] ?? 'Non spécifié',
      phone: json['telephone'] ?? 'Non spécifié',
      address: json['adresse'] ?? 'Non spécifiée',
      initials: initials,
    );
  }
}

class ProfileActivityInfo {
  final int totalDocumentsDeposited;
  final String? lastDepositFileName;
  final DateTime? lastDepositDate;

  ProfileActivityInfo({
    required this.totalDocumentsDeposited,
    this.lastDepositFileName,
    this.lastDepositDate,
  });

  factory ProfileActivityInfo.fromJson(Map<String, dynamic> json) {
    DateTime? lastDate;
    if (json['last_deposit'] != null && json['last_deposit']['date'] != null) {
      lastDate = DateTime.tryParse(json['last_deposit']['date']);
    }
    return ProfileActivityInfo(
      totalDocumentsDeposited: json['total_documents_deposited'] ?? 0,
      lastDepositFileName: json['last_deposit']?['file_name'],
      lastDepositDate: lastDate,
    );
  }
}
class SubscriptionInfo {
  final String planName;
  final DateTime? expiryDate;
  final String status;
  final double? montant;

  SubscriptionInfo({
    required this.planName,
    this.expiryDate,
    required this.status,
    this.montant,
  });

  factory SubscriptionInfo.fromJson(Map<String, dynamic> json) {
    // Assumons que le backend renvoie toujours 'status' et 'montant' à la racine.
    // Et que 'plan' est un objet imbriqué.

    // Gère le cas "aucun" explicitement au début, si le statut est 'aucun'
    if (json['status'] == 'aucun') { // Utilise 'status' ici, comme le backend envoie.
      return SubscriptionInfo(
        planName: 'Aucun',
        status: 'aucun',
        expiryDate: null,
        montant: null,
      );
    }
    
    // Pour les abonnements actifs/expirés, extraire les infos
    String extractedPlanName = 'Plan Inconnu';
    if (json['plan'] != null && json['plan'] is Map<String, dynamic>) {
      // Si 'plan' est un objet JSON, on extrait son 'nom'
      extractedPlanName = json['plan']['nom'] ?? 'Plan Inconnu';
    } else if (json['plan'] != null) {
      // Au cas où 'plan' serait une chaîne directe (moins probable avec l'image que tu as fournie)
      extractedPlanName = json['plan'].toString();
    }


    return SubscriptionInfo(
      planName: extractedPlanName, // Utilise le nom extrait
      expiryDate: json['date_fin'] != null ? DateTime.parse(json['date_fin']) : null, // Tu avais 'date_fin' initialement
      status: json['status'] ?? 'inconnu', // Utilise 'status' comme le backend envoie
      montant: json['montant'] != null ? double.parse(json['montant'].toString()) : null,
    );
  }
}

class ProfilePage extends StatefulWidget {
  const ProfilePage({Key? key}) : super(key: key);

  @override
  _ProfilePageState createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  int _currentIndex = 3;
  // Assurez-vous que ces routes sont définies dans votre MaterialApp si vous utilisez pushReplacementNamed
  final _routes = ['/home', '/upload', '/documents', '/profile'];

  UserProfileInfo? _profileInfo;
  ProfileActivityInfo? _activityInfo;
  SubscriptionInfo? _subscriptionInfo;

  bool _isLoadingProfile = true;
  bool _isLoadingActivity = true;
  bool _isLoadingSubscription = true;
  String? _errorProfile;
  String? _errorActivity;
  String? _errorSubscription;

  final Dio _dio = Dio();

  @override
  void initState() {
    super.initState();
    _checkTokenAndLoadData();
  }

  Future<void> _checkTokenAndLoadData() async {
    // Utilise getAuthToken depuis auth_service.dart (ou d'où il est défini)
    final token = await getAuthToken();
    // ignore: use_build_context_synchronously
    AuthService.redirectToLoginIfNoToken(context, token); // AuthService gère la redirection
    if (token == null) {
      if (mounted) {
        setState(() {
          _isLoadingProfile = false;
          _isLoadingActivity = false;
          _isLoadingSubscription = false;
          _errorProfile = "Authentification requise.";
          _errorActivity = "Authentification requise.";
          _errorSubscription = "Authentification requise.";
        });
      }
      return;
    }
    _loadProfileData();
  }

  Future<void> _loadProfileData() async {
    if (!mounted) return;
    setState(() {
      _isLoadingProfile = true;
      _isLoadingActivity = true;
      _isLoadingSubscription = true;
      _errorProfile = null;
      _errorActivity = null;
      _errorSubscription = null;
    });

    await Future.wait([
      _fetchUserProfile(),
      _fetchProfileActivity(),
      _fetchSubscriptionInfo(),
    ]);
  }

  Future<void> _fetchUserProfile() async {
    final token = await getAuthToken();
    if (!mounted || token == null) {
      if(mounted) setState(() { _isLoadingProfile = false; _errorProfile = "Authentification requise."; });
      return;
    }
    try {
      final response = await _dio.get(
        // Utilise API_BASE_URL depuis constants.dart ou auth_service.dart
        '$API_BASE_URL/profile',
        options: Options(headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'}),
      );
      if (!mounted) return;
      if (response.statusCode == 200 && response.data != null) {
        setState(() {
          _profileInfo = UserProfileInfo.fromJson(response.data);
          _isLoadingProfile = false;
        });
      } else {
        setState(() { _isLoadingProfile = false; _errorProfile = "Erreur ${response.statusCode}"; });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() { _isLoadingProfile = false; _errorProfile = "Erreur de connexion (profil)"; });
      print("Erreur fetchUserProfile: $e");
    }
  }

  Future<void> _fetchProfileActivity() async {
    final token = await getAuthToken();
    if (!mounted || token == null) {
      if(mounted) setState(() { _isLoadingActivity = false; _errorActivity = "Authentification requise."; });
      return;
    }
    try {
      final response = await _dio.get(
        '$API_BASE_URL/documents/activity-summary',
        options: Options(headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'}),
      );
      if (!mounted) return;
      if (response.statusCode == 200 && response.data != null && response.data is Map<String, dynamic>) {
        setState(() {
          _activityInfo = ProfileActivityInfo.fromJson(response.data as Map<String, dynamic>);
          _isLoadingActivity = false;
        });
      } else {
        setState(() { _isLoadingActivity = false; _errorActivity = "Erreur de données du serveur (${response.statusCode})"; });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() { _isLoadingActivity = false; _errorActivity = "Erreur de connexion (activité)"; });
      print("Erreur fetchProfileActivity: $e");
    }
  }

  Future<void> _fetchSubscriptionInfo() async {
    final token = await getAuthToken();
    if (!mounted || token == null) {
      if(mounted) setState(() { _isLoadingSubscription = false; _errorSubscription = "Authentification requise."; });
      return;
    }
    try {
      final response = await _dio.get(
        '$API_BASE_URL/profile/subscription',
        options: Options(headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'}),
      );
      if (!mounted) return;
      if (response.statusCode == 200 && response.data != null && response.data is Map<String, dynamic>) {
        setState(() {
          _subscriptionInfo = SubscriptionInfo.fromJson(response.data as Map<String, dynamic>);
          _isLoadingSubscription = false;
        });
      } else {
        setState(() { _isLoadingSubscription = false; _errorSubscription = "Erreur serveur ${response.statusCode} (abonnement)";});
      }
    } catch (e) {
      if (!mounted) return;
      setState(() { _isLoadingSubscription = false; _errorSubscription = "Erreur de connexion (abonnement)";});
      print("Erreur fetchSubscriptionInfo: $e");
    }
  }

  Future<void> _handleLogout() async {
    // WELCOME_NOTIFICATION_KEY vient de constants.dart ou auth_service.dart
    // ignore: use_build_context_synchronously
    await AuthService.logout(context, sharedPrefsKeysToClear: [WELCOME_NOTIFICATION_KEY]);
  }

  void _onItemTapped(int index) {
    if (index == _currentIndex && ModalRoute.of(context)?.settings.name == _routes[index]) return;
    Navigator.pushReplacementNamed(context, _routes[index]);
  }

  // NOUVELLES MÉTHODES POUR LA NAVIGATION
  void _navigateToEditProfile() async {
    if (_profileInfo == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Informations du profil non chargées pour modification.')),
      );
      return;
    }
    // Attend un résultat de EditProfilePage. Si c'est 'true', on rafraîchit.
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        // Passez les informations actuelles du profil à la page de modification
     // NOUVELLE LIGNE (correcte)
builder: (context) => EditProfilePage(currentUserInfo: _profileInfo!),
      ),
    );

    if (result == true && mounted) { // 'true' est renvoyé par EditProfilePage en cas de succès
      _loadProfileData(); // Rafraîchit toutes les données du profil
    }
  }

  void _navigateToChangePassword() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const ChangePasswordPage()),
    );
    // Pas besoin de rafraîchir les données du profil ici, sauf si le changement de mot de passe
    // invalide le token actuel et nécessite une reconnexion (ce qui serait géré par une redirection).
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: const Text('Mon Profil', style: TextStyle(color: Color(0xFF263238), fontWeight: FontWeight.bold, fontSize: 20)),
        elevation: 0.5,
        backgroundColor: Colors.white,
        centerTitle: false,
        iconTheme: const IconThemeData(color: Color(0xFF263238)),
      ),
      body: RefreshIndicator(
        onRefresh: _loadProfileData,
        color: const Color(0xFF2196F3),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildHeader(context),
              const SizedBox(height: 24),
              _buildSubscriptionSection(context),
              const SizedBox(height: 24),
              _buildPersonalInfoSection(context),
              const SizedBox(height: 24),
              _buildActivitySection(context),
              const SizedBox(height: 24),
              _buildSettingsSection(context), // C'est ici que les boutons sont mis à jour
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
          ),
          child: BottomNavigationBar(
            type: BottomNavigationBarType.fixed,
            selectedItemColor: const Color(0xFF2196F3),
            unselectedItemColor: Colors.grey,
            currentIndex: _currentIndex,
            backgroundColor: Colors.white,
            elevation: 10,
            selectedLabelStyle: const TextStyle(
              fontWeight: FontWeight.w500,
              fontSize: 12,
            ),
            unselectedLabelStyle: const TextStyle(fontSize: 12),
            onTap: _onItemTapped,
            items: const [
              BottomNavigationBarItem(icon: Icon(Icons.home_outlined, size: 26), activeIcon: Icon(Icons.home_rounded, size: 28), label: 'Accueil'),
              BottomNavigationBarItem(icon: Icon(Icons.cloud_upload_outlined, size: 26), activeIcon: Icon(Icons.cloud_upload_rounded, size: 28), label: 'Déposer'),
              BottomNavigationBarItem(icon: Icon(Icons.folder_copy_outlined, size: 26), activeIcon: Icon(Icons.folder_copy_rounded, size: 28), label: 'Documents'),
              BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded, size: 26), activeIcon: Icon(Icons.person_rounded, size: 28), label: 'Profil'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    if (_isLoadingProfile) {
      return Card(
        color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), elevation: 2,
        child: Padding(padding: const EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator(color: Theme.of(context).primaryColor))),
      );
    }
    if (_errorProfile != null || _profileInfo == null) {
       return Card(
        color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), elevation: 2,
        child: Padding(padding: const EdgeInsets.all(24), child: Text(_errorProfile ?? "Impossible de charger le profil.", textAlign: TextAlign.center, style: TextStyle(color: Colors.red.shade700))),
      );
    }
    return Card(
       color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 52,
              backgroundColor:const Color.fromARGB(255, 230, 236, 240),
              child: Text(
                _profileInfo!.initials,
                style: theme.displaySmall!.copyWith(
                  color: const Color.fromARGB(255, 115, 166, 200),
                  fontWeight: FontWeight.bold
                )
              ),
            ),
            const SizedBox(height: 20),
            Text(_profileInfo!.companyName, style: theme.headlineSmall!.copyWith(fontWeight: FontWeight.bold, color: const Color(0xFF263238))),
            const SizedBox(height: 6),
            Text(_profileInfo!.email, style: theme.bodyMedium!.copyWith(color: Colors.grey.shade700, fontSize: 15)),
          ],
        ),
      ),
    );
  }

  Widget _buildSubscriptionSection(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final DateFormat formatter = DateFormat('dd MMMM yyyy', 'fr_FR');

    if (_isLoadingSubscription) {
      return Card(
        color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), elevation: 2,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Abonnement', style: theme.titleMedium!.copyWith(fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
              const Divider(height: 20, thickness: 0.8),
              Center(child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 20.0),
                child: CupertinoActivityIndicator(color: Theme.of(context).primaryColor),
              )),
            ],
          ),
        ),
      );
    }

    if (_errorSubscription != null || _subscriptionInfo == null) {
      return Card(
        color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), elevation: 2,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Abonnement', style: theme.titleMedium!.copyWith(fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
              const Divider(height: 20, thickness: 0.8),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20.0),
                child: Text(
                  _errorSubscription ?? "Impossible de charger les informations d'abonnement.",
                  style: TextStyle(color: Colors.red.shade700, fontSize: 14),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      );
    }

    String planName = _subscriptionInfo!.planName;
    String expiryDateFormatted = "N/A";
    if (_subscriptionInfo!.expiryDate != null) {
      expiryDateFormatted = formatter.format(_subscriptionInfo!.expiryDate!);
    }

    // --- NOUVELLE LOGIQUE POUR DÉTERMINER LE STATUT CÔTÉ CLIENT ---
    String currentStatus = _subscriptionInfo!.status.toLowerCase(); // Statut initial du backend
    Color statusColor;
    IconData statusIcon;
    String statusText;

    if (_subscriptionInfo!.status.toLowerCase() == 'aucun') {
      statusText = 'Aucun Abonnement';
      statusColor = Colors.blueGrey.shade400;
      statusIcon = Icons.do_not_disturb_alt_rounded;
      expiryDateFormatted = 'Non applicable';
    } else if (_subscriptionInfo!.expiryDate != null) {
      final now = DateTime.now();
      final expiryDate = _subscriptionInfo!.expiryDate!;
      final difference = expiryDate.difference(now);
      const int daysUntilSoon = 30; // Définir "bientôt" comme 30 jours, tu peux ajuster

      if (expiryDate.isBefore(now)) {
        currentStatus = 'expiré';
      } else if (difference.inDays <= daysUntilSoon) {
        currentStatus = 'expire_bientot';
      } else {
        currentStatus = 'actif'; // Si la date est dans le futur et pas "bientôt"
      }

      // Appliquer les styles en fonction du nouveau `currentStatus`
      switch (currentStatus) {
        case 'actif':
          statusText = 'Abonnement Actif';
          statusColor = Colors.green.shade600;
          statusIcon = Icons.verified_user_rounded;
          break;
        case 'expire_bientot':
          statusText = 'Expire Bientôt';
          statusColor = Colors.orange.shade600;
          statusIcon = Icons.warning_amber_rounded;
          break;
        case 'expiré':
          statusText = 'Abonnement Expiré';
          statusColor = Colors.red.shade600;
          statusIcon = Icons.error_outline_rounded;
          break;
        default:
          statusText = 'Statut Inconnu';
          statusColor = Colors.grey;
          statusIcon = Icons.help_outline_rounded;
      }
    } else {
      // Si expiryDate est null mais le statut n'est pas "aucun"
      statusText = 'Statut Inconnu (Date manquante)';
      statusColor = Colors.grey;
      statusIcon = Icons.help_outline_rounded;
    }
    // --- FIN DE LA NOUVELLE LOGIQUE ---

    final double? montant = _subscriptionInfo!.montant;

    return Card(
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Abonnement', style: theme.titleMedium!.copyWith(fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
            const Divider(height: 20, thickness: 0.8),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [statusColor.withOpacity(0.7), statusColor],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [BoxShadow(color: statusColor.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 4))]
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(statusIcon, color: Colors.white, size: 22),
                      const SizedBox(width: 10),
                      Text(statusText, style: const TextStyle(color: Colors.white, fontSize: 16.5, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text('Plan Actuel : $planName', style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 14)),
                  const SizedBox(height: 4),
                  if (currentStatus != 'aucun') // Utilisez le `currentStatus` mis à jour
                    Text('Expire le : $expiryDateFormatted', style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 14)),
                  const SizedBox(height: 4),
                  if (montant != null)
                    Text(
                      'Montant : ${montant.toStringAsFixed(2)} DH',
                      style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 14)
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPersonalInfoSection(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    if (_isLoadingProfile) { 
      return Card(elevation:0, color: Colors.transparent, child: Center(child: Padding(padding: const EdgeInsets.all(16.0), child: CupertinoActivityIndicator(color: Theme.of(context).primaryColor))));
    }
    if (_errorProfile != null || _profileInfo == null) { 
      return Card(elevation:2, color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), child: Padding(padding: const EdgeInsets.all(16), child: Text(_errorProfile ?? "Infos personnelles non disponibles.", style: TextStyle(color: Colors.red.shade700))));
    }
    return Card(
       color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Informations de l\'entreprise', style: theme.titleMedium!.copyWith(fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
            const Divider(height: 20, thickness: 0.8),
            _infoTile(CupertinoIcons.building_2_fill, 'Nom', _profileInfo!.companyName),
            _infoTile(CupertinoIcons.mail_solid, 'Email', _profileInfo!.email),
            _infoTile(CupertinoIcons.phone_fill, 'Téléphone', _profileInfo!.phone),
            _infoTile(CupertinoIcons.location_solid, 'Adresse', _profileInfo!.address),
          ],
        ),
      ),
    );
  }

  Widget _buildActivitySection(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    if (_isLoadingActivity) {
      return Card(elevation:0, color: Colors.transparent, child: Center(child: Padding(padding: const EdgeInsets.all(16.0), child: CupertinoActivityIndicator(color: Theme.of(context).primaryColor))));
    }
    if (_errorActivity != null || _activityInfo == null) {
      return Card(elevation:2, color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), child: Padding(padding: const EdgeInsets.all(16), child: Text(_errorActivity ?? "Activité non disponible.", style: TextStyle(color: Colors.red.shade700))));
    }

    String lastDepositDateFormatted = "N/A";
    if (_activityInfo!.lastDepositDate != null) {
      lastDepositDateFormatted = DateFormat('dd MMM yyyy, HH:mm', 'fr_FR').format(_activityInfo!.lastDepositDate!.toLocal());
    }

    return Card(
       color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Activité du compte', style: theme.titleMedium!.copyWith(fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
            const Divider(height: 20, thickness: 0.8),
            _activityTile(CupertinoIcons.doc_chart_fill, 'Documents déposés', _activityInfo!.totalDocumentsDeposited.toString()),
            const SizedBox(height: 8),
            _activityTile(CupertinoIcons.arrow_up_doc_fill, 'Dernier dépôt', _activityInfo!.lastDepositFileName ?? "Aucun", subtitle: _activityInfo!.lastDepositFileName != null ? lastDepositDateFormatted : null),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () { Navigator.pushReplacementNamed(context, '/documents'); },
                 style: TextButton.styleFrom(foregroundColor: const Color(0xFF2196F3), padding: const EdgeInsets.symmetric(horizontal:0, vertical: 8)),
                child: const Text('Voir l\'historique complet', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // MODIFICATION ICI pour appeler les nouvelles méthodes de navigation
  Widget _buildSettingsSection(BuildContext context) {
     return Card(
       color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal:16.0, vertical: 8.0),
              child: Text('Paramètres & Sécurité', style: Theme.of(context).textTheme.titleMedium!.copyWith(fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
            ),
            const Divider(height: 1, thickness: 0.8, indent: 16, endIndent: 16),
            _settingsButton(
              Icons.edit_rounded, 
              'Modifier mes informations', 
              onTap: _navigateToEditProfile // APPEL À LA NOUVELLE MÉTHODE
            ),
            _settingsButton(
              CupertinoIcons.lock_shield, 
              'Changer de mot de passe', 
              onTap: _navigateToChangePassword // APPEL À LA NOUVELLE MÉTHODE
            ),
            _settingsButton(
              CupertinoIcons.square_arrow_left, 
              'Se déconnecter', 
              isDestructive: true, 
              onTap: _handleLogout // Utilise _handleLogout pour plus de clarté
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoTile(IconData icon, String label, String value) => ListTile(
      leading: Icon(icon, color: const Color(0xFF2196F3), size: 22),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14.5, color: Color(0xFF4B5563))),
      subtitle: Text(value, style: const TextStyle(fontSize: 15, color: Color(0xFF1F2937), fontWeight: FontWeight.w600)),
      contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 0),
      dense: true,
    );

  Widget _activityTile(IconData icon, String title, String value, {String? subtitle}) => ListTile(
      leading: Icon(icon, color: const Color(0xFF2196F3), size: 22),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14.5, color: Color(0xFF4B5563))),
      subtitle: subtitle != null
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [Text(value, style: const TextStyle(fontSize: 15, color: Color(0xFF1F2937), fontWeight: FontWeight.w600)), Text(subtitle, style: const TextStyle(fontSize: 12.5, color: Colors.grey))],
            )
          : Text(value, style: const TextStyle(fontSize: 15, color: Color(0xFF1F2937), fontWeight: FontWeight.w600)),
      contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 0),
      dense: true,
    );

  Widget _settingsButton(IconData icon, String label, {bool isDestructive = false, required VoidCallback onTap}) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: isDestructive ? Colors.red.shade600 : const Color(0xFF2196F3), size: 22),
            const SizedBox(width: 16),
            Expanded(child: Text(label, style: TextStyle(color: isDestructive ? Colors.red.shade600 : const Color(0xFF374151) , fontWeight: FontWeight.w500, fontSize: 15))),
            if (!isDestructive) Icon(CupertinoIcons.chevron_forward, size: 18, color: Colors.grey.shade400),
          ],
        ),
      ),
    ),
  );
}
