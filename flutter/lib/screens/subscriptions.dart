import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'dart:io';
// home_page.dart ou le nom de votre page
import 'home.dart'; // <-- MODIFIEZ CE CHEMIN

class SubscriptionPlanPage extends StatefulWidget {
  final String entrepriseId;

  const SubscriptionPlanPage({Key? key, required this.entrepriseId}) : super(key: key);

  @override
  _SubscriptionPlanPageState createState() => _SubscriptionPlanPageState();
}

class _SubscriptionPlanPageState extends State<SubscriptionPlanPage> {
  String? selectedPlanId;
  File? selectedFile;
  bool isLoading = false;

  final List<SubscriptionPlan> plans = [
    SubscriptionPlan(id: 'basic', name: 'Basic', storage: '1 Go', price: '500 DH/an', color: Colors.blue),
    SubscriptionPlan(id: 'standard', name: 'Standard', storage: '5 Go', price: '750 DH/an', color: Colors.green),
    SubscriptionPlan(id: 'premium', name: 'Premium', storage: '10 Go', price: '1000 DH/an', color: Colors.purple),
  ];

  Future<void> _pickFile() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      );

      if (result != null) {
        setState(() {
          selectedFile = File(result.files.single.path!);
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur lors de la sélection du fichier: $e')),
      );
    }
  }

  Future<void> _submitRequest() async {
    if (selectedPlanId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez sélectionner un plan')),
      );
      return;
    }

    if (selectedFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez téléverser un justificatif de paiement')),
      );
      return;
    }

    setState(() {
      isLoading = true;
    });

    try {
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('http://192.168.1.14:8000/api/abonnements/demande'), // ← Ton API ici
      );

      request.fields['plan_id'] = selectedPlanId!;
      request.fields['entreprise_id'] = widget.entrepriseId;

      request.files.add(await http.MultipartFile.fromPath('file', selectedFile!.path));

      var response = await request.send();

   if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Demande envoyée avec succès !'),
            backgroundColor: Colors.green,
          ),
        );
  Navigator.of(context).pushNamedAndRemoveUntil('/home', (Route<dynamic> route) => false);
      
    } else {
      final responseBody = await http.Response.fromStream(response);
      throw Exception('Erreur ${response.statusCode}: ${responseBody.body}');
    }
  } catch (e) {
    // Vérifier que le widget est toujours "monté" avant d'afficher le SnackBar
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Erreur: $e')),
    );
  } finally {
    // Vérifier que le widget est toujours "monté" avant de modifier l'état
    if (mounted) {
      setState(() {
        isLoading = false;
      });
    }
  }
}

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: const Text(
          'Formule d’abonnement',
          style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue.shade100),
              ),
              child: const Text(
                '🚧 Pour accéder à l’application, vous devez d’abord souscrire à une formule d’abonnement.\n\n📦 Chaque plan vous donne droit à un quota de stockage pour vos documents à téléverser.',
                style: TextStyle(fontSize: 14, color: Colors.black87),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Choisissez une formule ci-dessous :',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 20),
            Column(
              children: plans.map((plan) => _buildPlanCard(plan)).toList(),
            ),
            const SizedBox(height: 30),
            if (selectedPlanId != null) ...[
              const Text(
                'Justificatif de paiement',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              Text(
                selectedFile == null
                    ? 'Veuillez téléverser un fichier prouvant votre paiement.'
                    : 'Fichier sélectionné : ${selectedFile!.path.split('/').last}',
                style: const TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: _pickFile,
                icon: const Icon(Icons.upload_file),
                label: Text(selectedFile == null
                    ? 'Téléverser un fichier (PDF, JPG, PNG)'
                    : 'Changer le fichier'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey[200],
                  foregroundColor: Colors.black87,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(height: 30),
              ElevatedButton(
                onPressed: isLoading ? null : _submitRequest,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text(
                        'Envoyer la demande',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPlanCard(SubscriptionPlan plan) {
    final bool isSelected = selectedPlanId == plan.id;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected ? plan.color : Colors.grey[300]!,
          width: isSelected ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: plan.color.withOpacity(0.07),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Text(
              plan.name,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: plan.color,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              plan.storage,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: plan.color.withOpacity(0.9),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              plan.price,
              style: const TextStyle(
                fontSize: 18,
                color: Colors.black87,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  selectedPlanId = plan.id;
                });
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: isSelected ? plan.color : Colors.grey[100],
                foregroundColor: isSelected ? Colors.white : Colors.black54,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: Text(
                isSelected ? 'Sélectionné' : 'Choisir ce plan',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SubscriptionPlan {
  final String id;
  final String name;
  final String storage;
  final String price;
  final Color color;

  SubscriptionPlan({
    required this.id,
    required this.name,
    required this.storage,
    required this.price,
    required this.color,
  });
}
