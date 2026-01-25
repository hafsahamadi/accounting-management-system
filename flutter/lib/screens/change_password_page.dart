import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter/cupertino.dart';
import 'profile.dart'; // Adaptez le chemin si besoin

class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({Key? key}) : super(key: key);

  @override
  _ChangePasswordPageState createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  
  bool _isLoading = false;
  final Dio _dio = Dio();

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }
  
  Future<void> _changePassword() async {
    if (_formKey.currentState!.validate()) {
      setState(() { _isLoading = true; });

      final token = await getAuthToken();
      if (token == null) {
        setState(() { _isLoading = false; });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Erreur d'authentification."))
        );
        return;
      }
      
      // ATTENTION : Adaptez l'URL à votre API
      const String url = '$API_BASE_URL/profile/change-password';

      try {
        final response = await _dio.post(
          url,
          options: Options(
            headers: {
              'Authorization': 'Bearer $token',
              'Accept': 'application/json'
            },
          ),
          data: {
            'current_password': _currentPasswordController.text,
            'new_password': _newPasswordController.text,
            'new_password_confirmation': _confirmPasswordController.text,
          },
        );

        if (response.statusCode == 200) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Mot de passe changé avec succès !"),
              backgroundColor: Colors.green,
            )
          );
          Navigator.of(context).pop();
        } else {
          // Si le backend renvoie une erreur de validation
          String errorMessage = response.data['message'] ?? "Une erreur est survenue.";
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(errorMessage),
              backgroundColor: Colors.red,
            )
          );
        }
      } on DioException catch (e) {
        String errorMessage = e.response?.data['message'] ?? "Erreur de connexion.";
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.red,
          )
        );
      } finally {
        if (mounted) {
          setState(() { _isLoading = false; });
        }
      }
    }
  }

  String? _passwordValidator(String? value) {
    if (value == null || value.isEmpty) {
      return 'Ce champ est requis';
    }
    if (value.length < 8) {
      return 'Au moins 8 caractères';
    }
    if (!RegExp(r'[A-Z]').hasMatch(value)) {
      return 'Au moins une lettre majuscule';
    }
    if (!RegExp(r'[a-z]').hasMatch(value)) {
      return 'Au moins une lettre minuscule';
    }
    if (!RegExp(r'[0-9]').hasMatch(value)) {
      return 'Au moins un chiffre';
    }
    // Si vous voulez obliger un caractère spécial, décommentez :
    // if (!RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(value)) {
    //   return 'Au moins un caractère spécial';
    // }
    return null; // Tout est OK
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Changer le mot de passe"),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            children: [
              // Champ : Mot de passe actuel
              TextFormField(
                controller: _currentPasswordController,
                decoration: const InputDecoration(labelText: 'Mot de passe actuel'),
                obscureText: true,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Ce champ est requis';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Champ : Nouveau mot de passe (avec votre nouveau validateur)
              TextFormField(
                controller: _newPasswordController,
                decoration: const InputDecoration(labelText: 'Nouveau mot de passe'),
                obscureText: true,
                validator: _passwordValidator,
              ),
              const SizedBox(height: 16),

              // Champ : Confirmer le nouveau mot de passe
              TextFormField(
                controller: _confirmPasswordController,
                decoration: const InputDecoration(labelText: 'Confirmer le nouveau mot de passe'),
                obscureText: true,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Ce champ est requis';
                  }
                  if (value != _newPasswordController.text) {
                    return 'Les mots de passe ne correspondent pas';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 30),

              // Bouton ou indicateur de chargement
              _isLoading
                  ? const CupertinoActivityIndicator()
                  : ElevatedButton(
                      onPressed: _changePassword,
                      child: const Text('Changer le mot de passe'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 15),
                      ),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}
