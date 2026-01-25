// lib/widgets/document_card_widget.dart
// OU lib/screens/document_card_widget.dart selon votre structure

import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:intl/intl.dart';

// CORRECTION IMPORT: Importer DocumentInfo depuis son emplacement unique
import 'document_info.dart'; // Adaptez le chemin si votre dossier models est ailleurs

class DocumentCardWidget extends StatelessWidget {
  final DocumentInfo doc; // Ce DocumentInfo vient maintenant de models/document_info.dart
  final IconData Function(String) getFileIcon;
  final Color Function(String) getFileIconColor;
  final Color Function(String) getStatusColor;
  final String Function(String) formatStatus;

  final Color primaryColor;
  final Color textColorPrimary;
  final Color textColorSecondary;
  final Color cardColor;

  final VoidCallback onView;
  final VoidCallback onDownload;
  final VoidCallback onRename;
  final VoidCallback? onShare;
  final VoidCallback? onDelete;

  const DocumentCardWidget({
    Key? key,
    required this.doc,
    required this.getFileIcon,
    required this.getFileIconColor,
    required this.getStatusColor,
    required this.formatStatus,
    required this.primaryColor,
    required this.textColorPrimary,
    required this.textColorSecondary,
    required this.cardColor,
    required this.onView,
    required this.onDownload,
    required this.onRename,
    this.onShare,
    this.onDelete,
  }) : super(key: key);

  PopupMenuItem<String> _buildPopupMenuItem(
    BuildContext context,
    IconData icon,
    String text,
    String value, {
    bool isDestructive = false,
  }) {
    final Color itemColor = isDestructive ? Colors.red.shade600 : textColorPrimary.withOpacity(0.9);
    return PopupMenuItem<String>(
      value: value,
      height: 42,
      child: Row(
        children: [
          Icon(icon, size: 20, color: itemColor),
          const SizedBox(width: 12),
          Text(text, style: TextStyle(color: itemColor, fontSize: 14, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final DateFormat dateFormat = DateFormat('dd MMM yyyy, HH:mm', 'fr_FR');
    final Color statusColor = getStatusColor(doc.status);
    final String formattedStatus = formatStatus(doc.status);
    final Color iconColor = getFileIconColor(doc.fileName);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            spreadRadius: 1,
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onView,
          borderRadius: BorderRadius.circular(16),
          splashColor: primaryColor.withOpacity(0.1),
          highlightColor: primaryColor.withOpacity(0.05),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            child: Row(
              children: [
                // Icône de fichier
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: iconColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(getFileIcon(doc.fileName), color: iconColor, size: 28),
                ),
                const SizedBox(width: 16),
                // Informations principales
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        doc.fileName,
                        style: TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w600,
                          color: textColorPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        doc.typeFormatted, // Utilise le getter de DocumentInfo
                        style: TextStyle(fontSize: 13, color: textColorSecondary, fontWeight: FontWeight.w400),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Icon(CupertinoIcons.calendar_today, size: 12, color: textColorSecondary.withOpacity(0.7)),
                          const SizedBox(width: 4),
                          Text(
                            dateFormat.format(doc.uploadedAt.toLocal()),
                            style: TextStyle(fontSize: 11.5, color: textColorSecondary.withOpacity(0.7), fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                      if (doc.entrepriseNom != null && doc.entrepriseNom!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(CupertinoIcons.building_2_fill, size: 14, color: textColorSecondary.withOpacity(0.8)),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                doc.entrepriseNom!,
                                style: TextStyle(fontSize: 11.5, color: textColorSecondary.withOpacity(0.7), fontStyle: FontStyle.italic),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                // Statut et Menu
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        formattedStatus.toUpperCase(),
                        style: TextStyle(fontSize: 9.5, color: statusColor, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                      ),
                    ),
                    if (onRename != null || onShare != null || onDelete != null || onDownload != null)
                      SizedBox(
                        height: 38,
                        width: 38,
                        child: PopupMenuButton<String>(
                          icon: Icon(Icons.more_horiz_rounded, color: textColorSecondary.withOpacity(0.7), size: 22),
                          tooltip: "Options",
                          splashRadius: 18,
                          iconSize: 22,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          offset: const Offset(0, 30),
                          itemBuilder: (context) => [
                            _buildPopupMenuItem(context, Icons.file_download_outlined, 'Télécharger', 'download'),
                            if (onRename != null) _buildPopupMenuItem(context, Icons.edit_outlined, 'Renommer', 'rename'),
                            if (onShare != null) _buildPopupMenuItem(context, Icons.share_outlined, 'Partager', 'share'),
                            if (onDelete != null) const PopupMenuDivider(height: 0.5),
                            if (onDelete != null) _buildPopupMenuItem(context, Icons.delete_outline_rounded, 'Supprimer', 'delete', isDestructive: true),
                          ],
                          onSelected: (value) {
                            if (value == 'download') onDownload();
                            if (value == 'rename' && onRename != null) onRename!();
                            if (value == 'share' && onShare != null) onShare!();
                            if (value == 'delete' && onDelete != null) onDelete!();
                          },
                        ),
                      )
                    else
                      const SizedBox(height: 38),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}