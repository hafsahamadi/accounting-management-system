import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'profile.dart'; // Adaptez le chemin si nécessaire
import 'package:flutter/cupertino.dart';

class EditProfilePage extends StatefulWidget {
  final UserProfileInfo currentUserInfo;

  const EditProfilePage({Key? key, required this.currentUserInfo}) : super(key: key);

  @override
  _EditProfilePageState createState() => _EditProfilePageState();
}

class _EditProfilePageState extends State<EditProfilePage> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _addressController;

  bool _isLoading = false;
  final Dio _dio = Dio();

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.currentUserInfo.companyName);
    _emailController = TextEditingController(text: widget.currentUserInfo.email);
    _phoneController = TextEditingController(text: widget.currentUserInfo.phone);
    _addressController = TextEditingController(text: widget.currentUserInfo.address);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    if (_formKey.currentState!.validate()) {
      setState(() { _isLoading = true; });

      final token = await getAuthToken();
      if (token == null) {
        // Gérer le cas où le token n'est pas trouvé
        setState(() { _isLoading = false; });
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Erreur d'authentification.")));
        return;
      }
      
      // !!! ATTENTION : Adaptez l'URL à votre API
      const String url = '$API_BASE_URL/profile/updatee';

      try {
        final response = await _dio.put( // ou _dio.put
          url,
          options: Options(headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'}),
          data: {
            'nom_entreprise': _nameController.text,
            'email': _emailController.text,
            'telephone': _phoneController.text,
            'adresse': _addressController.text,
          },
        );

        if (response.statusCode == 200) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Profil mis à jour avec succès !"), backgroundColor: Colors.green,));
          Navigator.of(context).pop(true); // Retourne 'true' pour indiquer que la mise à jour a réussi
        } else {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Erreur serveur : ${response.statusMessage}"), backgroundColor: Colors.red,));
        }
      } on DioException catch (e) {
         ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Erreur de connexion : ${e.message}"), backgroundColor: Colors.red,));
      } finally {
        if (mounted) {
          setState(() { _isLoading = false; });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Modifier mes informations"),
        elevation: 0.5,
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            children: [
              TextFormField(
                controller: _nameController,
                decoration: InputDecoration(labelText: 'Nom de l\'entreprise'),
                validator: (value) => value!.isEmpty ? 'Ce champ est requis' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _emailController,
                decoration: InputDecoration(labelText: 'Email'),
                keyboardType: TextInputType.emailAddress,
                validator: (value) => value!.isEmpty || !value.contains('@') ? 'Entrez un email valide' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _phoneController,
                decoration: InputDecoration(labelText: 'Téléphone'),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _addressController,
                decoration: InputDecoration(labelText: 'Adresse'),
                maxLines: 3,
              ),
              const SizedBox(height: 30),
              _isLoading
                  ? CupertinoActivityIndicator()
                  : ElevatedButton(
                      onPressed: _saveProfile,
                      child: Text('Enregistrer les modifications'),
                      style: ElevatedButton.styleFrom(
                        padding: EdgeInsets.symmetric(horizontal: 40, vertical: 15),
                      ),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}