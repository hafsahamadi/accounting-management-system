import 'package:flutter/material.dart';
import 'dart:io';
import 'package:dio/dio.dart'; // Pour FormData et DioException
import 'package:file_selector/file_selector.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path/path.dart' as path;
import 'package:image_picker/image_picker.dart';

// ------------------- CONFIGURATION ET FONCTIONS D'API -------------------
const String BASE_URL = "http://192.168.1.14:8000/api";

Future<String?> getAuthToken() async {
  const storage = FlutterSecureStorage();
  return await storage.read(key: 'token');
}

// NOUVELLE FONCTION UTILITAIRE GLOBALE POUR GÉNÉRER LE NOM DE FICHIER
String _generateConciseFileName(String docTypePrefix, String originalExtension) {
  // Utilise les 6 derniers chiffres du timestamp pour la concision et une unicité raisonnable
  // Assure que le timestamp est assez long pour éviter une erreur de plage si trop court.
  final nowMillis = DateTime.now().millisecondsSinceEpoch.toString();
  final String timestampSuffix = nowMillis.length > 6 ? nowMillis.substring(nowMillis.length - 6) : nowMillis;
  
  // Assure que l'extension n'a pas de point au début et n'est pas vide
  String cleanExtension = originalExtension.startsWith('.') ? originalExtension.substring(1) : originalExtension;
  if (cleanExtension.isEmpty) {
    cleanExtension = "bin"; // Fallback pour extension inconnue/vide
  }
  
  return '${docTypePrefix}_$timestampSuffix.$cleanExtension';
}


Future<Map<String, dynamic>?> uploadMainDocument({
  required String categorie,
  required File file,
  required String clientFileName, // MODIFIÉ: accepter le nom de fichier généré
}) async {
  String? token = await getAuthToken();
  if (token == null) {
    print('UploadMainDocument Erreur: Token non trouvé');
    return null;
  }

  var dio = Dio();
  // String fileName = path.basename(file.path); // ANCIEN: On utilise clientFileName maintenant

  Map<String, dynamic> formDataMap = {
    'categorie': categorie,
    'document': await MultipartFile.fromFile(file.path, filename: clientFileName), // MODIFIÉ
  };

  try {
    print('🚀 UploadMainDocument: Envoi de $clientFileName (cat: $categorie) à $BASE_URL/documents'); // MODIFIÉ
    final response = await dio.post(
      '$BASE_URL/documents',
      data: FormData.fromMap(formDataMap),
      options: Options(
        headers: {'Authorization': 'Bearer $token','Accept':'application/json'},
      ),
    );

    if (response.statusCode == 201) {
      print('✅ UploadMainDocument: Succès! Réponse: ${response.data}');
      return response.data as Map<String, dynamic>;
    } else {
      print('❌ UploadMainDocument: Erreur ${response.statusCode} - ${response.data}');
      return null;
    }
  } on DioException catch (e) {
    print('❌ UploadMainDocument DioError: ${e.response?.statusCode} - ${e.response?.data} - ${e.message}');
    return null;
  } catch (e) {
    print('❌ UploadMainDocument Erreur Inattendue: $e');
    return null;
  }
}

Future<Map<String, dynamic>?> uploadPaymentProof({
  required String idDocumentPrincipal,
  required File file,
  required String clientFileName, // MODIFIÉ: accepter le nom de fichier généré
  String? modePaiement,
  String? dateJustificatif,
}) async {
  String? token = await getAuthToken();
  if (token == null) {
    print('UploadPaymentProof Erreur: Token non trouvé');
    return null;
  }

  var dio = Dio();
  // String fileName = path.basename(file.path); // ANCIEN: On utilise clientFileName maintenant

  Map<String, dynamic> formDataMap = {
    'id_facture': idDocumentPrincipal,
    'document_justificatif': await MultipartFile.fromFile(file.path, filename: clientFileName), // MODIFIÉ
    if (modePaiement != null) 'mode_paiement': modePaiement,
    if (dateJustificatif != null) 'date_justificatif': dateJustificatif,
  };

  try {
    print('🚀 UploadPaymentProof: Envoi de $clientFileName (pour docID: $idDocumentPrincipal) à $BASE_URL/justificatifs'); // MODIFIÉ
    final response = await dio.post(
      '$BASE_URL/justificatifs',
      data: FormData.fromMap(formDataMap),
      options: Options(
        headers: {'Authorization': 'Bearer $token','Accept': 'application/json',},
      ),
    );
    if (response.statusCode == 201) {
      print('✅ UploadPaymentProof: Succès! Réponse: ${response.data}');
      return response.data as Map<String, dynamic>;
    } else {
      print('❌ UploadPaymentProof: Erreur ${response.statusCode} - ${response.data}');
      return null;
    }
  } on DioException catch (e) {
    print('❌ UploadPaymentProof DioError: ${e.response?.statusCode} - ${e.response?.data} - ${e.message}');
    return null;
  } catch (e) {
    print('❌ UploadPaymentProof Erreur Inattendue: $e');
    return null;
  }
}


// ------------------- WIDGETS ET ÉCRANS FLUTTER -------------------

class UploadApp extends StatelessWidget {
  const UploadApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return const DocumentTypeSelectionScreen();
  }
}

// Page principale de sélection du type de document
class DocumentTypeSelectionScreen extends StatelessWidget {
  const DocumentTypeSelectionScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Télécharger Document', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 20)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const SizedBox(height: 24),
            const Text('Sélectionnez le type de document', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 40),
            _buildDocumentTypeButton(
              context,
              'Bon de livraison',
              Icons.local_shipping_outlined,
              () => Navigator.push(context, MaterialPageRoute(builder: (context) => const DeliveryNoteUploadScreen())),
            ),
            const SizedBox(height: 24),
            _buildDocumentTypeButton(
              context,
              'Facture',
              Icons.receipt_long_outlined,
              () => Navigator.push(context, MaterialPageRoute(builder: (context) => const InvoiceTypeSelectionScreen())),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomNavigationBar(context, 1),
    );
  }

  Widget _buildDocumentTypeButton(BuildContext context, String title, IconData icon, VoidCallback onPressed) {
    return SizedBox(
      width: double.infinity,
      height: 100,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.white,
          foregroundColor: const Color(0xFF2196F3),
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade300)),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
        ),
        child: Row(
          children: [
            Icon(icon, size: 40, color: const Color(0xFF2196F3)),
            const SizedBox(width: 20),
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w500, color: Colors.black87)),
            const Spacer(),
            const Icon(Icons.arrow_forward_ios, color: Colors.grey, size: 16),
          ],
        ),
      ),
    );
  }
}

// Page de sélection du type de facture
class InvoiceTypeSelectionScreen extends StatelessWidget {
  const InvoiceTypeSelectionScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Type de Facture', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 20)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const SizedBox(height: 24),
            const Text('Sélectionnez le type de facture', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 40),
            _buildInvoiceTypeButton(
              context,
              'Facture d\'achat',
              Icons.shopping_cart_outlined,
              () => Navigator.push(context, MaterialPageRoute(builder: (context) => InvoiceUploadScreen(invoiceType: 'Facture d\'achat', categorie: 'facture_achat'))),
            ),
            const SizedBox(height: 24),
            _buildInvoiceTypeButton(
              context,
              'Facture de vente',
              Icons.point_of_sale_outlined,
              () => Navigator.push(context, MaterialPageRoute(builder: (context) => InvoiceUploadScreen(invoiceType: 'Facture de vente', categorie: 'facture_vente'))),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomNavigationBar(context, 1),
    );
  }

  Widget _buildInvoiceTypeButton(BuildContext context, String title, IconData icon, VoidCallback onPressed) {
    return SizedBox(
      width: double.infinity,
      height: 100,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.white,
          foregroundColor: const Color(0xFF2196F3),
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade300)),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
        ),
        child: Row(
          children: [
            Icon(icon, size: 40, color: const Color(0xFF2196F3)),
            const SizedBox(width: 20),
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w500, color: Colors.black87)),
            const Spacer(),
            const Icon(Icons.arrow_forward_ios, color: Colors.grey, size: 16),
          ],
        ),
      ),
    );
  }
}

// Page d'upload pour bon de livraison
class DeliveryNoteUploadScreen extends StatefulWidget {
  const DeliveryNoteUploadScreen({Key? key}) : super(key: key);

  @override
  _DeliveryNoteUploadScreenState createState() => _DeliveryNoteUploadScreenState();
}

class _DeliveryNoteUploadScreenState extends State<DeliveryNoteUploadScreen> {
  File? _mainDocument;
  File? _paymentProofDocument;
  bool _showPaymentProof = false;
  bool _isUploaded = false;
  bool _isLoading = false;
  String? _mainDocumentName; // Stocke le nom généré pour le document principal
  String? _paymentProofName; // Stocke le nom généré pour le justificatif
  final ImagePicker _picker = ImagePicker();

  Future<void> _showDocumentSourceOptions(bool isMainDocument) async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea( 
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.document_scanner_outlined),
                title: const Text('Scanner un document'),
                onTap: () {
                  Navigator.pop(context);
                  _scanDocument(isMainDocument);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Choisir depuis la galerie/fichiers'),
                onTap: () {
                  Navigator.pop(context);
                  _pickDocument(isMainDocument);
                },
              ),
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }

  Future<void> _pickDocument(bool isMainDocument) async {
    const XTypeGroup typeGroup = XTypeGroup(
      label: 'Documents (PDF, Images)',
      extensions: <String>['pdf', 'jpg', 'jpeg', 'png'],
    );
    try {
      final XFile? pickedFile = await openFile(
        acceptedTypeGroups: <XTypeGroup>[typeGroup],
      );

      if (pickedFile != null) {
        setState(() {
          final String originalExtension = path.extension(pickedFile.name);
          if (isMainDocument) {
            _mainDocument = File(pickedFile.path);
            _mainDocumentName = _generateConciseFileName("Bon de Livraison", originalExtension);
          } else {
            _paymentProofDocument = File(pickedFile.path);
            _paymentProofName = _generateConciseFileName("Justif BL", originalExtension);
          }
        });
      } else {
        print('Aucun fichier sélectionné');
      }
    } catch (e) {
      print('Erreur lors de la sélection du fichier: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erreur lors de la sélection du fichier'), backgroundColor: Colors.red),
        );
      }
    }
  }
 
  Future<void> _scanDocument(bool isMainDocument) async {
    try {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Placez le document sur une surface plane et bien éclairée.'), duration: Duration(seconds: 3)),
        );
        await Future.delayed(const Duration(milliseconds: 500));
      }

      final XFile? scan = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 100,
        preferredCameraDevice: CameraDevice.rear,
      );

      if (scan != null) {
        setState(() {
          const String scanExtension = "jpg"; // Les scans sont des jpg
          if (isMainDocument) {
            _mainDocument = File(scan.path);
            _mainDocumentName = _generateConciseFileName("Bon de Livraison", scanExtension);
          } else {
            _paymentProofDocument = File(scan.path);
            _paymentProofName = _generateConciseFileName("Justif BL", scanExtension);
          }
        });
      }
    } catch (e) {
      print('Erreur lors du scan du document: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erreur lors du scan du document'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _submitDocuments() async {
    if (_mainDocument == null || _mainDocumentName == null) { // Vérifier aussi _mainDocumentName
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Veuillez sélectionner le bon de livraison'), backgroundColor: Colors.red));
      return;
    }
    if (_showPaymentProof && (_paymentProofDocument == null || _paymentProofName == null)) { // Vérifier _paymentProofName
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Veuillez sélectionner un justificatif de paiement'), backgroundColor: Colors.red));
      return;
    }

    setState(() { _isLoading = true; });

    Map<String, dynamic>? mainDocResponse;
    bool mainUploadSuccess = false;
    bool paymentProofUploadSuccess = true;

    try {
      print("Tentative d'upload du bon de livraison...");
      mainDocResponse = await uploadMainDocument(
        categorie: 'bon_livraison',
        file: _mainDocument!,
        clientFileName: _mainDocumentName!, // MODIFIÉ: Passer le nom généré
      );

      if (mainDocResponse != null && mainDocResponse.containsKey('id')) {
        mainUploadSuccess = true;
        print("Bon de livraison uploadé avec succès. ID: ${mainDocResponse['id']}");

        if (_showPaymentProof && _paymentProofDocument != null) {
          print("Tentative d'upload du justificatif de paiement pour le bon de livraison...");
          final String documentPrincipalId = mainDocResponse['id'].toString();

          Map<String, dynamic>? proofResponse = await uploadPaymentProof(
            idDocumentPrincipal: documentPrincipalId,
            file: _paymentProofDocument!,
            clientFileName: _paymentProofName!, // MODIFIÉ: Passer le nom généré
          );
          paymentProofUploadSuccess = proofResponse != null;
          if (paymentProofUploadSuccess) {
            print("Justificatif de paiement pour BL uploadé avec succès.");
          } else {
            print("Échec de l'upload du justificatif de paiement pour BL.");
          }
        }
      } else {
        print("Échec de l'upload du bon de livraison.");
        mainUploadSuccess = false;
      }

      if (mounted) {
        setState(() {
          _isLoading = false;
          _isUploaded = mainUploadSuccess && paymentProofUploadSuccess;
        });

        if (!_isUploaded) {
          String errorMessage = 'Erreur lors du téléchargement.';
          if (!mainUploadSuccess) {
            errorMessage = 'Le bon de livraison n\'a pas pu être téléchargé.';
          } else if (_showPaymentProof && !paymentProofUploadSuccess) {
            errorMessage = 'Le bon de livraison a été téléchargé, mais le justificatif de paiement a échoué.';
          }
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(errorMessage), backgroundColor: Colors.red),
          );
        }
      }
    } catch (e) {
      print("Erreur globale dans _submitDocuments (BL): $e");
      if (mounted) {
        setState(() { _isLoading = false; });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Une erreur inattendue est survenue: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _resetForm() {
    setState(() {
      _mainDocument = null;
      _paymentProofDocument = null;
      _mainDocumentName = null;
      _paymentProofName = null;
      _showPaymentProof = false;
      _isUploaded = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bon de Livraison', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 20)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_isUploaded) {
              Navigator.of(context).popUntil((route) => route.isFirst);
            } else {
              Navigator.pop(context);
            }
          },
        ),
      ),
      body: _isUploaded ? _buildSuccessScreen() : _buildUploadForm(),
      bottomNavigationBar: _buildBottomNavigationBar(context, 1),
    );
  }

  Widget _buildUploadForm() {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 16),
            const Text('Document du Bon de Livraison', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            const Text('Veuillez télécharger votre bon de livraison (PDF ou image)', style: TextStyle(fontSize: 14, color: Colors.grey)),
            const SizedBox(height: 16),
            _buildFileSelectionButton(
              'Sélectionner le Bon de Livraison',
              _mainDocument,
              _mainDocumentName, // Affiche le nom généré
              true,
            ),
            const SizedBox(height: 24),

            if (!_showPaymentProof)
              TextButton.icon(
                onPressed: () { setState(() { _showPaymentProof = true; }); },
                icon: const Icon(Icons.add_circle_outline),
                label: const Text('Ajouter un justificatif de paiement'),
                style: TextButton.styleFrom(foregroundColor: const Color(0xFF2196F3)),
              ),

            if (_showPaymentProof) ...[
              const Text('Justificatif de Paiement', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
              const SizedBox(height: 8),
              const Text('Ajoutez un justificatif de paiement (PDF ou image)', style: TextStyle(fontSize: 14, color: Colors.grey)),
              const SizedBox(height: 16),
              _buildFileSelectionButton(
                'Sélectionner le Justificatif',
                _paymentProofDocument,
                _paymentProofName, // Affiche le nom généré
                false,
              ),
              TextButton.icon(
                onPressed: () {
                  setState(() {
                    _showPaymentProof = false;
                    _paymentProofDocument = null;
                    _paymentProofName = null;
                  });
                },
                icon: const Icon(Icons.remove_circle_outline),
                label: const Text('Supprimer le justificatif'),
                style: TextButton.styleFrom(foregroundColor: Colors.red),
              ),
            ],

            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: (_mainDocument == null || _isLoading) ? null : _submitDocuments,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2196F3),
                minimumSize: const Size(double.infinity, 50),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                disabledBackgroundColor: Colors.grey[300],
              ),
              child: _isLoading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Soumettre', style: TextStyle(fontSize: 16, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileSelectionButton(
    String text,
    File? file,
    String? displayedFileName, // MODIFIÉ: utilise ce nom pour l'affichage
    bool isMainDoc
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ElevatedButton(
          onPressed: () => _showDocumentSourceOptions(isMainDoc),
          style: ElevatedButton.styleFrom(
            backgroundColor: file != null ? Colors.green[50] : const Color.fromRGBO(233, 236, 239, 1),
            foregroundColor: file != null ? Colors.green[700] : Colors.grey[700],
            minimumSize: const Size(double.infinity, 50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(file != null ? Icons.check_circle : Icons.upload_file, color: file != null ? Colors.green[700] : Colors.grey[700]),
              const SizedBox(width: 8),
              Text(
                file != null ? 'Fichier sélectionné' : text,
                style: TextStyle(fontWeight: FontWeight.w500, color: file != null ? Colors.green[700] : Colors.grey[700]),
              ),
            ],
          ),
        ),
        if (file != null)
          Padding(
            padding: const EdgeInsets.only(top: 8.0, left: 8.0),
            child: Row(
              children: [
                const Icon(Icons.attach_file, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    displayedFileName ?? 'fichier inconnu', // Utilise le nom généré/stocké
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 16, color: Colors.grey),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () {
                    setState(() {
                      if (isMainDoc) {
                        _mainDocument = null;
                        _mainDocumentName = null;
                      } else {
                        _paymentProofDocument = null;
                        _paymentProofName = null;
                      }
                    });
                  },
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildSuccessScreen() {
     return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.check_circle,
                color: Colors.blue[700],
                size: 80,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Document(s) téléchargé(s) avec succès!',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.blue[700],
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Text(
              _showPaymentProof && _paymentProofDocument != null
                  ? 'Votre bon de livraison et le justificatif de paiement ont été traités.'
                  : 'Votre bon de livraison a été traité.',
              style: const TextStyle(fontSize: 16, color: Colors.black87),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: () {
                _resetForm();
                Navigator.of(context).popUntil((route) => route.isFirst);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2196F3),
                minimumSize: const Size(200, 50),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Télécharger un autre document',
                style: TextStyle(fontSize: 16, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Page d'upload pour facture (achat ou vente)
class InvoiceUploadScreen extends StatefulWidget {
  final String invoiceType;
  final String categorie;

  const InvoiceUploadScreen({
    Key? key,
    required this.invoiceType,
    required this.categorie,
  }) : super(key: key);

  @override
  _InvoiceUploadScreenState createState() => _InvoiceUploadScreenState();
}

class _InvoiceUploadScreenState extends State<InvoiceUploadScreen> {
  File? _invoiceDocument;
  File? _paymentProofDocument;
  bool _showPaymentProof = false;
  bool _isUploaded = false;
  bool _isLoading = false;
  String? _invoiceFileName; // Stocke le nom généré pour la facture
  String? _paymentProofName; // Stocke le nom généré pour le justificatif de facture
  final ImagePicker _picker = ImagePicker();

  String _getDocTypePrefix(String categorie) {
    if (categorie == 'facture_achat') return 'FA';
    if (categorie == 'facture_vente') return 'FV';
    return 'DOC'; // Fallback
  }

  Future<void> _showDocumentSourceOptions(bool isInvoiceDocument) async {
     showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.document_scanner_outlined),
                title: const Text('Scanner un document'),
                onTap: () {
                  Navigator.pop(context);
                  _scanDocument(isInvoiceDocument);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Choisir depuis la galerie/fichiers'),
                onTap: () {
                  Navigator.pop(context);
                  _pickDocument(isInvoiceDocument);
                },
              ),
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }

  Future<void> _pickDocument(bool isInvoiceDocument) async {
     const XTypeGroup typeGroup = XTypeGroup(
      label: 'Documents (PDF, Images)',
      extensions: <String>['pdf', 'jpg', 'jpeg', 'png'],
    );
    try {
      final XFile? pickedFile = await openFile(
        acceptedTypeGroups: <XTypeGroup>[typeGroup],
      );

      if (pickedFile != null) {
        setState(() {
          final String originalExtension = path.extension(pickedFile.name);
          final String docPrefix = _getDocTypePrefix(widget.categorie);

          if (isInvoiceDocument) {
            _invoiceDocument = File(pickedFile.path);
            _invoiceFileName = _generateConciseFileName(docPrefix, originalExtension);
          } else {
            _paymentProofDocument = File(pickedFile.path);
            _paymentProofName = _generateConciseFileName("Justif$docPrefix", originalExtension);
          }
        });
      }
    } catch (e) {
      print('Erreur sélection fichier (Facture): $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erreur lors de la sélection du fichier'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _scanDocument(bool isInvoiceDocument) async {
     try {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Placez le document sur une surface plane et bien éclairée.'), duration: Duration(seconds: 3)),
        );
        await Future.delayed(const Duration(milliseconds: 500));
      }

      final XFile? scan = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 100,
        preferredCameraDevice: CameraDevice.rear,
      );

      if (scan != null) {
        setState(() {
          const String scanExtension = "jpg";
          final String docPrefix = _getDocTypePrefix(widget.categorie);

          if (isInvoiceDocument) {
            _invoiceDocument = File(scan.path);
            _invoiceFileName = _generateConciseFileName(docPrefix, scanExtension);
          } else {
            _paymentProofDocument = File(scan.path);
            _paymentProofName = _generateConciseFileName("Justif$docPrefix", scanExtension);
          }
        });
      }
    } catch (e) {
      print('Erreur lors du scan du document: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erreur lors du scan du document'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _submitDocument() async {
    if (_invoiceDocument == null || _invoiceFileName == null) { // Vérifier aussi _invoiceFileName
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Veuillez sélectionner la ${widget.invoiceType.toLowerCase()}'), backgroundColor: Colors.red));
      return;
    }
    if (_showPaymentProof && (_paymentProofDocument == null || _paymentProofName == null)) { // Vérifier _paymentProofName
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Veuillez sélectionner un justificatif de paiement'), backgroundColor: Colors.red));
      return;
    }

    setState(() { _isLoading = true; });

    Map<String, dynamic>? mainDocResponse;
    bool mainUploadSuccess = false;
    bool paymentProofUploadSuccess = true;

    try {
      print("Tentative d'upload de la facture: ${widget.categorie}...");
      mainDocResponse = await uploadMainDocument(
        categorie: widget.categorie,
        file: _invoiceDocument!,
        clientFileName: _invoiceFileName!, // MODIFIÉ: Passer le nom généré
      );

      if (mainDocResponse != null && mainDocResponse.containsKey('id')) {
        mainUploadSuccess = true;
        print("Facture uploadée avec succès. ID: ${mainDocResponse['id']}");

        if (_showPaymentProof && _paymentProofDocument != null) {
          print("Tentative d'upload du justificatif de paiement pour la facture...");
          final String documentPrincipalId = mainDocResponse['id'].toString();

          Map<String, dynamic>? proofResponse = await uploadPaymentProof(
            idDocumentPrincipal: documentPrincipalId,
            file: _paymentProofDocument!,
            clientFileName: _paymentProofName!, // MODIFIÉ: Passer le nom généré
          );
          paymentProofUploadSuccess = proofResponse != null;
          if (paymentProofUploadSuccess) {
            print("Justificatif de paiement pour facture uploadé avec succès.");
          } else {
            print("Échec de l'upload du justificatif de paiement pour facture.");
          }
        }
      } else {
        print("Échec de l'upload de la facture.");
        mainUploadSuccess = false;
      }

      if (mounted) {
        setState(() {
          _isLoading = false;
          _isUploaded = mainUploadSuccess && paymentProofUploadSuccess;
        });
        if (!_isUploaded) {
          String errorMessage = 'Erreur lors du téléchargement.';
          if (!mainUploadSuccess) {
            errorMessage = '${widget.invoiceType} n\'a pas pu être téléchargée.';
          } else if (_showPaymentProof && !paymentProofUploadSuccess) {
            errorMessage = '${widget.invoiceType} a été téléchargée, mais le justificatif de paiement a échoué.';
          }
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(errorMessage), backgroundColor: Colors.red),
          );
        }
      }
    } catch (e) {
      print("Erreur globale dans _submitDocument (Facture): $e");
      if (mounted) {
        setState(() { _isLoading = false; });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Une erreur inattendue est survenue: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _resetForm() {
    setState(() {
      _invoiceDocument = null;
      _paymentProofDocument = null;
      _invoiceFileName = null;
      _paymentProofName = null;
      _showPaymentProof = false;
      _isUploaded = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.invoiceType, style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 20)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_isUploaded) {
              Navigator.of(context).popUntil((route) => route.isFirst);
            } else {
              Navigator.pop(context);
            }
          },
        ),
      ),
      body: _isUploaded ? _buildSuccessScreen() : _buildUploadForm(),
      bottomNavigationBar: _buildBottomNavigationBar(context, 1),
    );
  }

  Widget _buildUploadForm() {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 16),
            Text('Document de ${widget.invoiceType}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            Text('Veuillez télécharger votre ${widget.invoiceType.toLowerCase()} (PDF ou image)', style: const TextStyle(fontSize: 14, color: Colors.grey)),
            const SizedBox(height: 16),
            _buildFileSelectionButton(
              'Sélectionner la ${widget.invoiceType}',
              _invoiceDocument,
              _invoiceFileName, // Affiche le nom généré
              true,
            ),
            const SizedBox(height: 24),

            if (!_showPaymentProof)
              TextButton.icon(
                onPressed: () { setState(() { _showPaymentProof = true; }); },
                icon: const Icon(Icons.add_circle_outline),
                label: const Text('Ajouter un justificatif de paiement'),
                style: TextButton.styleFrom(foregroundColor: const Color(0xFF2196F3)),
              ),

            if (_showPaymentProof) ...[
              const Text('Justificatif de Paiement (Optionnel)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
              const SizedBox(height: 8),
              const Text('Ajoutez un justificatif de paiement pour cette facture (PDF ou image)', style: TextStyle(fontSize: 14, color: Colors.grey)),
              const SizedBox(height: 16),
              _buildFileSelectionButton(
                'Sélectionner le Justificatif',
                _paymentProofDocument,
                _paymentProofName, // Affiche le nom généré
                false,
              ),
              TextButton.icon(
                onPressed: () {
                  setState(() {
                    _showPaymentProof = false;
                    _paymentProofDocument = null;
                    _paymentProofName = null;
                  });
                },
                icon: const Icon(Icons.remove_circle_outline),
                label: const Text('Supprimer le justificatif'),
                style: TextButton.styleFrom(foregroundColor: Colors.red),
              ),
            ],
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: (_invoiceDocument == null || _isLoading) ? null : _submitDocument,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2196F3),
                minimumSize: const Size(double.infinity, 50),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                disabledBackgroundColor: Colors.grey[300],
              ),
              child: _isLoading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Soumettre', style: TextStyle(fontSize: 16, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileSelectionButton(
    String text,
    File? file,
    String? displayedFileName, // MODIFIÉ: utilise ce nom pour l'affichage
    bool isInvoiceDoc
  ) {
     return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ElevatedButton(
          onPressed: () => _showDocumentSourceOptions(isInvoiceDoc),
          style: ElevatedButton.styleFrom(
            backgroundColor: file != null ? Colors.green[50] : const Color.fromRGBO(233, 236, 239, 1),
            foregroundColor: file != null ? Colors.green[700] : Colors.grey[700],
            minimumSize: const Size(double.infinity, 50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(file != null ? Icons.check_circle : Icons.upload_file, color: file != null ? Colors.green[700] : Colors.grey[700]),
              const SizedBox(width: 8),
              Text(
                file != null ? 'Fichier sélectionné' : text,
                style: TextStyle(fontWeight: FontWeight.w500, color: file != null ? Colors.green[700] : Colors.grey[700]),
              ),
            ],
          ),
        ),
        if (file != null)
          Padding(
            padding: const EdgeInsets.only(top: 8.0, left: 8.0),
            child: Row(
              children: [
                const Icon(Icons.attach_file, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    displayedFileName ?? 'fichier inconnu', // Utilise le nom généré/stocké
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 16, color: Colors.grey),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () {
                    setState(() {
                      if (isInvoiceDoc) {
                        _invoiceDocument = null;
                        _invoiceFileName = null;
                      } else {
                        _paymentProofDocument = null;
                        _paymentProofName = null;
                      }
                    });
                  },
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildSuccessScreen() {
      String successMessage = '${widget.invoiceType} a été traitée.';
      if (_showPaymentProof && _paymentProofDocument != null) {
        successMessage = '${widget.invoiceType} et le justificatif de paiement ont été traités.';
      }

      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.check_circle,
                  color: Colors.blue[700],
                  size: 80,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Document(s) téléchargé(s) avec succès!',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.blue[700],
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                successMessage,
                style: const TextStyle(fontSize: 16, color: Colors.black87),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: () {
                  _resetForm();
                  Navigator.of(context).popUntil((route) => route.isFirst);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2196F3),
                  minimumSize: const Size(200, 50),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text(
                  'Télécharger un autre document',
                  style: TextStyle(fontSize: 16, color: Colors.white),
                ),
              ),
            ],
          ),
        ),
      );
  }
}

// Widget pour la barre de navigation du bas (partagé entre tous les écrans)
Widget _buildBottomNavigationBar(BuildContext context, int currentIndex) {
   return Container(
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
        currentIndex: currentIndex,
        backgroundColor: Colors.white,
        elevation: 10,
        selectedLabelStyle: const TextStyle(
          fontWeight: FontWeight.w500,
          fontSize: 12,
        ),
        unselectedLabelStyle: const TextStyle(fontSize: 12),
        onTap: (index) {
          // Gestion de la navigation actuelle pour éviter de reconstruire la même page
          String currentRouteName = ModalRoute.of(context)?.settings.name ?? "";
          String targetRouteName = "";
          
          switch (index) {
            case 0: targetRouteName = '/home'; break;
            case 1: targetRouteName = '/upload'; break;
            case 2: targetRouteName = '/documents'; break;
            case 3: targetRouteName = '/profile'; break;
            default: return;
          }

          // Si on est déjà sur la page cible (spécifiquement pour /upload car elle a plusieurs sous-écrans)
          // ou si l'index actuel correspond à la page cible
          if ((targetRouteName == '/upload' && currentRouteName.startsWith('/upload_flow')) || (currentIndex == index && currentRouteName == targetRouteName) ) {
             // Si on est sur la page d'upload et qu'on clique à nouveau sur "Déposer",
             // on retourne à la première page du flux d'upload si on n'y est pas déjà.
             if (targetRouteName == '/upload' && currentRouteName != '/upload_flow/document_type_selection') {
                Navigator.of(context).popUntil((route) => route.settings.name == '/upload_flow/document_type_selection' || route.isFirst);
                // Si DocumentTypeSelectionScreen n'est pas dans la pile, on y navigue.
                // Cela arrive si on vient d'une autre page directement vers un sous-écran d'upload.
                // Pour simplifier, on peut juste popUntil isFirst, puis pushReplacementNamed('/upload')
                // Ou, si on veut garder la logique de sélection, on peut faire un check plus complexe.
                // Pour l'instant, cette logique devrait ramener à DocumentTypeSelectionScreen
                // si elle est dans la pile.
             }
             return;
          }
          // Pour la navigation vers les pages d'upload, on utilise un nom de route qui englobe le flow
          // et on s'assure que la navigation part de DocumentTypeSelectionScreen
          if (targetRouteName == '/upload') {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(
                builder: (context) => const DocumentTypeSelectionScreen(),
                settings: const RouteSettings(name: '/upload_flow/document_type_selection') // Nom de route spécifique
              ),
              (route) => route.isFirst, 
            );
          } else {
            Navigator.pushReplacementNamed(context, targetRouteName);
          }
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined, size: 24),
            activeIcon: Icon(Icons.home_rounded, size: 26),
            label: 'Accueil',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.cloud_upload_outlined, size: 24),
            activeIcon: Icon(Icons.cloud_upload_rounded, size: 26),
            label: 'Déposer',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.folder_copy_outlined, size: 24),
            activeIcon: Icon(Icons.folder_copy_rounded, size: 26),
            label: 'Documents',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline_rounded, size: 24),
            activeIcon: Icon(Icons.person_rounded, size: 26),
            label: 'Profil',
          ),
        ],
      ),
    ),
  );
}

// Ajoutez cette ligne au début de votre fichier si vous avez plusieurs écrans dans ce fichier
// et que vous voulez que DocumentTypeSelectionScreen soit la "racine" du flux d'upload.
// Cela n'est nécessaire que si vous définissez des routes nommées de manière plus complexe.
// Pour l'instant, la navigation se fait via MaterialPageRoute.