import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_helper.dart';
import 'subscriptions.dart'; // Import de votre page d'abonnement

class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController usernameController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  bool _rememberMe = true;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _checkIfUserIsLoggedIn();
  }

  void _checkIfUserIsLoggedIn() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final isLoggedIn = await AuthService.isLoggedIn();

      // Si l'utilisateur n'est pas connecté, on reste sur la page de login
      if (!isLoggedIn) {
        return;
      }

      // Récupérer le flag de "première connexion". Par défaut true (on considère que
      // l'utilisateur n'a pas encore fait sa première connexion si la clé n'existe pas)
      final prefs = await SharedPreferences.getInstance();
      final isFirstLogin = prefs.getBool('isFirstLogin') ?? true;

      // Si c'est la première connexion, on laisse l'utilisateur voir se connecter (ne pas rediriger).
      if (isFirstLogin) {
        return;
      }

      // Sinon, rediriger selon le statut et l'abonnement
      final entrepriseStatus = prefs.getString('entreprise_status') ?? '';
      final hasSubscription = prefs.getBool('has_active_subscription') ?? false;
      final entrepriseId = prefs.getString('entreprise_id');

      if (entrepriseStatus == "en_attente") {
        // Statut en attente -> aller à Home
        Navigator.pushReplacementNamed(context, '/home');
      } else if (hasSubscription) {
        // Abonnement actif -> Home
        Navigator.pushReplacementNamed(context, '/home');
      } else if (entrepriseId != null && entrepriseId.isNotEmpty) {
        // Pas d'abonnement -> page d'abonnement
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => SubscriptionPlanPage(entrepriseId: entrepriseId),
          ),
        );
      } else {
        // Cas inattendu -> forcer logout
        await AuthService.logout();
      }

    } catch (e) {
      print('Erreur lors de la vérification de l\'authentification: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _login() async {
    final username = usernameController.text.trim();
    final password = passwordController.text.trim();

    if (username.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Veuillez remplir tous les champs';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage)),
      );
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      // Nouvelle méthode qui retourne plus d'informations
      final loginResult = await AuthService.loginEntreprise(username, password);

      if (loginResult['success'] == true) {
        final prefs = await SharedPreferences.getInstance();

        // Si l'option "Se souvenir de moi" est activée
        if (_rememberMe) {
          await prefs.setBool('isLoggedIn', true);
          await prefs.setString('username', username);
        }

        // On marque la première connexion comme effectuée (ne plus considérer comme "première fois")
        await prefs.setBool('isFirstLogin', false);

        // Vérifier le statut d'abonnement (retourné par la requête)
        final hasActiveSubscription = loginResult['hasActiveSubscription'] ?? false;
        final entrepriseId = loginResult['entrepriseId'] ?? '';

        if (hasActiveSubscription) {
          // L'entreprise a un abonnement actif, aller à l'accueil
          Navigator.pushReplacementNamed(context, '/home');
        } else {
          // Pas d'abonnement, aller à la page d'abonnement
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => SubscriptionPlanPage(entrepriseId: entrepriseId),
            ),
          );
        }
      } else {
        setState(() {
          _errorMessage = loginResult['error'] ?? 'Identifiants incorrects';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_errorMessage),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Erreur de connexion: ${e.toString()}';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_errorMessage),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }


  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    final bool isSmallScreen = screenSize.width < 600;
    
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.white,
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildLogo(),
                    SizedBox(height: 40),
                    
                    Container(
                      width: isSmallScreen ? double.infinity : 420,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.06),
                            blurRadius: 20,
                            offset: Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(30.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Connexion',
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF3B82F6),
                              ),
                            ),
                            SizedBox(height: 8),
                            Text(
                              'Accédez à votre espace sécurisé',
                              style: TextStyle(
                                fontSize: 14,
                                color: Color(0xFF64748B),
                              ),
                            ),
                            SizedBox(height: 30),
                            
                            _buildForm(),
                            
                            SizedBox(height: 12),
                            
                            if (_errorMessage.isNotEmpty)
                              Container(
                                padding: EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Color(0xFFFFF1F2),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(
                                      Icons.error_outline_rounded,
                                      color: Color(0xFFE11D48),
                                      size: 18,
                                    ),
                                    SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        _errorMessage,
                                        style: TextStyle(
                                          fontSize: 13,
                                          color: Color(0xFFE11D48),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              
                            if (_errorMessage.isNotEmpty) SizedBox(height: 20),
                            
                            Row(
                              children: [
                                SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: Checkbox(
                                    value: _rememberMe,
                                    onChanged: (value) {
                                      setState(() {
                                        _rememberMe = value ?? false;
                                      });
                                    },
                                    activeColor: Color(0xFF3B82F6),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                  ),
                                ),
                                SizedBox(width: 8),
                                Text(
                                  'Rester connecté',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                                Spacer(),
                                /* TextButton(
                                  onPressed: () {},
                                  style: TextButton.styleFrom(
                                    minimumSize: Size.zero,
                                    padding: EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 5,
                                    ),
                                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  ),
                                 child: Text(
                                    'Mot de passe oublié ?',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: Color(0xFF3B82F6),
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),*/
                              ],
                            ),
                            SizedBox(height: 30),
                            
                            SizedBox(
                              width: double.infinity,
                              height: 50,
                              child: ElevatedButton(
                                onPressed: _isLoading ? null : _login,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Color(0xFF2563EB),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  disabledBackgroundColor: Color(0xFF2563EB).withOpacity(0.7),
                                ),
                                child: _isLoading
                                    ? SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                        ),
                                      )
                                    : Text(
                                        'Se connecter',
                                        style: TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    
                    SizedBox(height: 24),
                    
                    GestureDetector(
                      onTap: () {},
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(width: 8),
                          Text(
                            'Besoin d\'aide ? Contactez le support',
                            style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                    
                    SizedBox(height: 16),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  bool get isInitialLoading => _isLoading && usernameController.text.isEmpty && passwordController.text.isEmpty;

  Widget _buildLogo() {
    return Column(
      children: [
        Image.asset(
          'assets/logo.png',
          width: 180,
          height: 120,
          fit: BoxFit.contain,
        ),
      ],
    );
  }
  
  Widget _buildForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildInputLabel('Nom d\'utilisateur'),
        SizedBox(height: 8),
        _buildInputField(
          controller: usernameController,
          hintText: 'Entrez votre identifiant',
          icon: Icons.person_outline_rounded,
        ),
        SizedBox(height: 20),
        
        _buildInputLabel('Mot de passe'),
        SizedBox(height: 8),
        _buildInputField(
          controller: passwordController,
          hintText: 'Entrez votre mot de passe',
          icon: Icons.lock_outline_rounded,
          isPassword: true,
        ),
      ],
    );
  }
  
  Widget _buildInputLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(left: 2),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: Color(0xFF334155),
        ),
      ),
    );
  }
  
  Widget _buildInputField({
    required TextEditingController controller,
    required String hintText,
    required IconData icon,
    bool isPassword = false,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Color(0xFFE2E8F0),
          width: 1,
        ),
      ),
      child: TextFormField(
        controller: controller,
        obscureText: isPassword && _obscurePassword,
        style: TextStyle(
          fontSize: 15,
          color: Color(0xFF1E293B),
        ),
        decoration: InputDecoration(
          hintText: hintText,
          hintStyle: TextStyle(
            color: Color(0xFF94A3B8),
            fontSize: 14,
          ),
          prefixIcon: Icon(
            icon,
            size: 18,
            color: Color(0xFF64748B),
          ),
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(
                    _obscurePassword
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    size: 18,
                    color: Color(0xFF64748B),
                  ),
                  onPressed: () {
                    setState(() {
                      _obscurePassword = !_obscurePassword;
                    });
                  },
                  splashRadius: 20,
                )
              : null,
          contentPadding: EdgeInsets.symmetric(vertical: 14),
          border: InputBorder.none,
          isDense: true,
        ),
      ),
    );
  }
}