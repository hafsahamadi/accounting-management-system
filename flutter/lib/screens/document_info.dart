import 'package:flutter/material.dart';
// lib/models/document_info.dart
// Vous pouvez garder l'extension ici si elle est spécifique à ce modèle
// ou la déplacer dans un fichier d'extensions utilitaires si elle est plus générale.
extension StringExtensionForModel on String {
  String capitalizeDocInfo() {
    if (this.isEmpty) return this;
    return "${this[0].toUpperCase()}${this.substring(1)}";
  }
}

class DocumentInfo {
  final int id;
  final String fileName;
  final String type;
  final DateTime uploadedAt;
  final String status;
  final String? filePath;
  final String? entrepriseNom;

  DocumentInfo({
    required this.id,
    required this.fileName,
    required this.type,
    required this.uploadedAt,
    required this.status,
    this.filePath,
    this.entrepriseNom,
  });


  factory DocumentInfo.fromJson(Map<String, dynamic> json) {
    DateTime parsedDate;
    try {
      String? dateStr = json['uploaded_at'] ?? json['created_at'];
      if (dateStr != null) parsedDate = DateTime.parse(dateStr);
      else parsedDate = DateTime.now(); // Fallback
    } catch (e) {
      parsedDate = DateTime.now(); // Fallback en cas d'erreur de parsing
    }
    String statusFromApi = json['statut'] ?? json['status'] ?? 'N/A';
    return DocumentInfo(
      id: json['id'] as int? ?? 0, // Assurer le type et fallback
      fileName: json['nom_fichier'] as String? ?? 'Nom inconnu',
      type: (json['type'] as String?)?.toLowerCase().trim() ?? 'type_inconnu',
      uploadedAt: parsedDate,
      status: statusFromApi.toLowerCase().trim(),
      filePath: (json['chemin_fichier'] as String?)?.trim(),
      entrepriseNom: json['entreprise'] != null && json['entreprise']['nom_entreprise'] is String
          ? json['entreprise']['nom_entreprise'] as String
          : null,
    );
  }

  String get typeFormatted {
    // Utiliser l'extension définie ci-dessus
    return type.split('_').map((word) => word.capitalizeDocInfo()).join(' ');
  }
}