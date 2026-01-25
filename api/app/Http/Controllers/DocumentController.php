<?php

namespace App\Http\Controllers;
use App\Helpers\ActivityLogger;
use App\Models\Document;
use Illuminate\Http\Request; // Assurez-vous que cette ligne est présente
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\UploadedFile;
use Carbon\Carbon;

use Laravel\Sanctum\HasApiTokens;

class DocumentController extends Controller
{
    use HasApiTokens;
    // MOBILE
    public function index(Request $request)
    {
        $entreprise = $request->user(); // Maintenant $request est défini
        if (!$entreprise || !$entreprise->id) { // Vérification plus robuste de l'entreprise
            return response()->json(['message' => 'Non autorisé ou utilisateur non entreprise.'], 401);
        }
        
        // Récupérer les documents uniquement pour l'entreprise authentifiée
        $documents = Document::where('id_entreprise', $entreprise->id)
                             ->orderBy('uploaded_at', 'desc') // ou 'created_at' si vous préférez
                             // ->with('entreprise') // Optionnel: si vous voulez inclure les infos de l'entreprise avec chaque document
                             ->get();
        
        return response()->json($documents);
    }
    

public function store(Request $request)
{
    $entreprise = $request->user();
    if (!$entreprise || !$entreprise->id) {
        return response()->json(['message' => 'Utilisateur entreprise non authentifié.'], 401);
    }

    // --- NOUVELLE PARTIE : VÉRIFICATION DE L'ABONNEMENT ---

    // 1. On récupère le dernier abonnement de l'entreprise
    $abonnement = $entreprise->dernierAbonnement;

    // 2. On vérifie si un abonnement existe
    if (!$abonnement) {
        return response()->json([
            'message' => 'Action impossible. Aucun abonnement trouvé pour votre entreprise.'
        ], 403); // 403 Forbidden : l'utilisateur est authentifié mais n'a pas les droits
    }

    // 3. On vérifie si l'état de validation est 'valide'
    if ($abonnement->etat_validation !== 'valide') {
        $message = 'Votre abonnement est en attente de validation par un administrateur.';
        if ($abonnement->etat_validation === 'refuse') {
            $message = 'Votre demande d\'abonnement a été refusée.';
        }
        return response()->json(['message' => $message], 403);
    }
    
    // 4. On vérifie si l'abonnement est actif (non expiré)
    $dateFin = Carbon::parse($abonnement->date_fin)->endOfDay();
    if ($abonnement->statut !== 'actif' || $dateFin->isPast()) {
        return response()->json([
            'message' => 'Action impossible. Votre abonnement a expiré. Veuillez le renouveler.'
        ], 403);
    }

    // --- FIN DE LA VÉRIFICATION ---

    // Si on arrive ici, l'abonnement est valide. On peut continuer.
    $validatedData = $request->validate([
        'categorie' => 'required|in:facture_achat,facture_vente,bon_livraison',
        'document' => 'required|file|mimes:pdf,jpg,jpeg,png',
        'montant' => 'nullable|numeric', // Rendre optionnel si pas toujours présent
        'date_document' => 'nullable|date', // Rendre optionnel si pas toujours présent
    ]);

    $file = $request->file('document');
    $path = $file->store('documents', 'public');
    $tailleFichierEnOctets = $file->getSize();

    $doc = Document::create([
        'id_entreprise' => $entreprise->id,
        'type' => $validatedData['categorie'],
        'nom_fichier' => $file->getClientOriginalName(),
        'chemin_fichier' => $path,
        'montant' => $request->montant,
        'date_document' => $request->date_document,
        'taille_fichier' => $tailleFichierEnOctets,
    ]);

    return response()->json($doc, 201);
}


    
     public function getStatusCounts(Request $request)
    {
        $entreprise = $request->user();
        if (!$entreprise || !$entreprise->id) {
            return response()->json(['message' => 'Non autorisé'], 401);
        }
    
        // EXEMPLE : si votre colonne s'appelle 'status' et la valeur est 'en_cours'
        $enCoursCount = Document::where('id_entreprise', $entreprise->id)
                                ->where('statut', 'en_cours') // Adaptez ici
                                ->count();
    
        // Adaptez aussi pour 'Validé' et 'À revoir'
        $valideCount = Document::where('id_entreprise', $entreprise->id)
                               ->where('statut', 'traite') // Exemple
                               ->count();
        $aRevoirCount = Document::where('id_entreprise', $entreprise->id)
                                ->where('statut', 'a_revoir') // Exemple
                                ->count();
    
        // Les CLÉS de la réponse JSON doivent correspondre à ce que Flutter attend
        return response()->json([
            'En cours' => $enCoursCount, // Flutter attend 'En cours'
            'Validé'   => $valideCount,   // Flutter attend 'Validé'
            'À revoir' => $aRevoirCount, // Flutter attend 'À revoir'
        ]);
    }

    public function getRecentDocuments(Request $request)
    {
        $user = $request->user();
        if (!$user || !isset($user->id)) {
            return response()->json(['message' => 'Utilisateur non authentifié ou ID utilisateur manquant.'], 401);
        }
    
        $documents = Document::where('id_entreprise', $user->id)
                             ->orderBy('created_at', 'desc') // ou 'uploaded_at' si c'est plus pertinent
                             ->take(4)
                             ->get(['id', 'nom_fichier', 'chemin_fichier', 'created_at', 'type', 'statut', 'uploaded_at']); // Inclure les champs nécessaires
    
        
        $formattedDocuments = $documents->map(function ($document) {
            return [
                'id' => $document->id,
                'nom_fichier' => $document->nom_fichier,
                'chemin_fichier' => $document->chemin_fichier, // Assurez-vous que ce champ existe et est sélectionné
                'type' => $document->type,
                'statut' => $document->statut,
                'created_at' => $document->created_at ? $document->created_at->toIso8601String() : null,
                // Si uploaded_at peut être null, le ternaire est bon. Sinon, $document->uploaded_at->toIso8601String()
                'uploaded_at' => $document->uploaded_at ? $document->uploaded_at->toIso8601String() : ($document->created_at ? $document->created_at->toIso8601String() : null),
            ];
        });
    
        return response()->json($formattedDocuments);
    }

    public function rename(Request $request, Document $document)
    {
        $entreprise = $request->user();

        // Vérifier que le document appartient à l'entreprise authentifiée
        if ($document->id_entreprise !== $entreprise->id) {
            return response()->json(['message' => 'Non autorisé à modifier ce document.'], 403);
        }

        $validatedData = $request->validate([
            'nouveau_nom_fichier' => [
                'required',
                'string',
                'max:255',
                // S'assurer que le nouveau nom a une extension valide (optionnel mais recommandé)
                function ($attribute, $value, $fail) use ($document) {
                    $originalExtension = pathinfo($document->nom_fichier, PATHINFO_EXTENSION);
                    $newExtension = pathinfo($value, PATHINFO_EXTENSION);
                    if (empty($newExtension) && !empty($originalExtension)) {
                        $fail("Le nouveau nom de fichier doit inclure l'extension d'origine (.$originalExtension).");
                    } elseif (!empty($newExtension) && strtolower($newExtension) !== strtolower($originalExtension)) {
                        $fail("L'extension du fichier ne peut pas être modifiée. L'extension d'origine est '.$originalExtension'.");
                    }
                    // Vérifier les caractères non autorisés dans les noms de fichiers (basique)
                    if (preg_match('/[\/\?<>\\:\*\|"]/', $value)) {
                         $fail('Le nom du fichier contient des caractères non autorisés.');
                    }
                },
            ],
        ]);

        $nouveauNom = $validatedData['nouveau_nom_fichier'];
        $ancienNomPourLog = $document->nom_fichier; // Garder l'ancien nom pour les logs ou comparaison

        // Extraire l'extension du nom d'origine pour s'assurer qu'elle est conservée
        // ou que le nouveau nom a la même extension. La validation ci-dessus s'en occupe.
        $originalExtension = pathinfo($document->nom_fichier, PATHINFO_EXTENSION);
        $newBaseName = pathinfo($nouveauNom, PATHINFO_FILENAME); // Nom sans extension
    
        if(empty(pathinfo($nouveauNom, PATHINFO_EXTENSION)) && !empty($originalExtension)){
            $nouveauNomFinal = $newBaseName . '.' . $originalExtension;
        } else {
            $nouveauNomFinal = $nouveauNom;
        }
        $document->nom_fichier = $nouveauNomFinal;
        $document->save();

        return response()->json([
            'message' => 'Document renommé avec succès.',
            'document' => $document->fresh(), // Retourner le document mis à jour
        ]);
    }
    public function destroy(Request $request, Document $document)
    {
        $entreprise = $request->user(); // Récupère l'utilisateur (entreprise) authentifié

        // Vérification 1: L'utilisateur est-il authentifié comme une entreprise ?
        if (!$entreprise || !$entreprise->id) {
            return response()->json(['message' => 'Non autorisé ou utilisateur non entreprise.'], 401);
        }

        // Vérification 2: Le document à supprimer appartient-il bien à l'entreprise authentifiée ?
        // Ceci est crucial pour la sécurité afin d'empêcher un utilisateur de supprimer les documents d'un autre.
        if ($document->id_entreprise !== $entreprise->id) {
            return response()->json(['message' => 'Action non autorisée. Vous ne pouvez pas supprimer ce document.'], 403); // 403 Forbidden
        }

        try {
            // Étape 1: Supprimer le fichier physique du stockage
            // Assurez-vous que 'public' est le bon disque configuré dans config/filesystems.php
            // et que chemin_fichier stocke le chemin relatif à la racine de ce disque (ex: 'documents/monfichier.pdf')
            if ($document->chemin_fichier && Storage::disk('public')->exists($document->chemin_fichier)) {
                Storage::disk('public')->delete($document->chemin_fichier);
                // Log ou message si nécessaire
                // Log::info("Fichier physique supprimé: " . $document->chemin_fichier);
            } else {
                // Log ou message si le fichier physique n'a pas été trouvé (peut arriver si la suppression a déjà eu lieu ou si le chemin est invalide)
                // Log::warning("Fichier physique non trouvé pour suppression: " . $document->chemin_fichier . " pour le document ID: " . $document->id);
            }

            // Étape 2: Supprimer l'enregistrement du document de la base de données
            $document->delete();

            // Retourner une réponse de succès
            // Un statut 200 avec un message ou un statut 204 No Content (qui signifie succès sans corps de réponse) sont courants.
            return response()->json(['message' => 'Document supprimé avec succès.'], 200);
            // Alternativement, pour 204: return response()->noContent();

        } catch (\Exception $e) {
            // Gérer les erreurs potentielles (ex: problème de droits sur le système de fichiers, erreur DB inattendue)
            // Log::error("Erreur lors de la suppression du document ID " . $document->id . ": " . $e->getMessage());
            return response()->json(['message' => 'Erreur lors de la suppression du document.', 'error' => $e->getMessage()], 500);
        }
    }

    public function download(Document $document)
    {
        $entreprise = request()->user();
        
        // Vérification que le document appartient à l'entreprise
        if ($document->id_entreprise !== $entreprise->id) {
            abort(403, 'Non autorisé à accéder à ce document.');
        }
        
        // Vérifier que le fichier existe
        if (!Storage::disk('public')->exists($document->chemin_fichier)) {
            abort(404, 'Document non trouvé.');
        }
        
        // Retourner le fichier pour téléchargement
        return response()->download(
            storage_path('app/public/' . $document->chemin_fichier),
            $document->nom_fichier
        );
    }

    public function getActivitySummary(Request $request)
    {
        $user = $request->user();
        if (!$user || !isset($user->id)) {
            return response()->json(['message' => 'Utilisateur non authentifié ou ID utilisateur manquant.'], 401);
        }

        // 1. Total des documents déposés par l'utilisateur
        $totalDocumentsDeposited = Document::where('id_entreprise', $user->id)->count();

        // 2. Informations sur le dernier dépôt
        $lastDeposit = Document::where('id_entreprise', $user->id)
                               ->orderBy('created_at', 'desc') // Ou 'uploaded_at'
                               ->first(['nom_fichier', 'created_at']); // Sélectionnez les champs nécessaires

        $lastDepositData = null;
        if ($lastDeposit) {
            $lastDepositData = [
                'file_name' => $lastDeposit->nom_fichier,
                'date' => $lastDeposit->created_at ? $lastDeposit->created_at->toIso8601String() : null,
            ];
        }

        // Construire la réponse JSON qui correspond à ce qu'attend ProfileActivityInfo.fromJson
        return response()->json([
            'total_documents_deposited' => $totalDocumentsDeposited,
            'last_deposit' => $lastDepositData,
            // Ajoutez d'autres statistiques d'activité si nécessaire
        ]);
    }



//WEB

    public function getDocumentsTraites(Request $request)
  {
        Log::info('DocumentController@getDocumentsTraitesCount: Début de la requête.');

        // Étape 1: Vérifier l'authentification
        if (!Auth::check()) {
            Log::warning('DocumentController@getDocumentsTraitesCount: Utilisateur non authentifié. Renvoi 401.');
            return response()->json(['message' => 'Utilisateur non authentifié.'], 401);
        }

        $comptable = Auth::user();
        $comptableId = $comptable->id;
        Log::info('DocumentController@getDocumentsTraitesCount: Utilisateur authentifié. Comptable ID: ' . $comptableId);
        $count = Document::where('statut', 'traite') // Filtrer par statut 'traite'
            ->whereHas('entreprise', function ($query) use ($comptableId) {

                $query->where('id_comptable', $comptableId);
            })
            ->count(); // Obtenir le nombre de documents correspondants

        Log::info('DocumentController@getDocumentsTraitesCount: Nombre de documents traités pour comptable ID ' . $comptableId . ': ' . $count);

        // Étape 3: Retourner le compte
        return response()->json(['documents_traites_count' => $count]);
    }

    public function getDocumentsEnAttente(Request $request)
{
        Log::info('DocumentController@getDocumentsEnAttenteCount: Début de la requête.');

        // Étape 1: Vérifier l'authentification
        if (!Auth::check()) {
            Log::warning('DocumentController@getDocumentsEnAttenteCount: Utilisateur non authentifié. Renvoi 401.');
            return response()->json(['message' => 'Utilisateur non authentifié.'], 401);
        }

        $comptable = Auth::user();
        $comptableId = $comptable->id;
        Log::info('DocumentController@getDocumentsEnAttenteCount: Utilisateur authentifié. Comptable ID: ' . $comptableId);

        $statutEnAttente = 'en_cours'; 

        $count = Document::where('statut', $statutEnAttente) // Filtrer par statut
            ->whereHas('entreprise', function ($query) use ($comptableId) {
             
                $query->where('id_comptable', $comptableId);
            })
            ->count(); // Obtenir le nombre de documents correspondants

        Log::info('DocumentController@getDocumentsEnAttenteCount: Nombre de documents en attente (statut "' . $statutEnAttente . '") pour comptable ID ' . $comptableId . ': ' . $count);


        return response()->json(['documents_en_attente_count' => $count]);
    }


    public function updateStatus(Request $request, $id)
{
    $request->validate([
        'status' => 'required|in:en_cours,traite,a_revoir',
    ]);

    $document = Document::findOrFail($id);
    $document->statut = $request->input('status');
    $document->save();

    return response()->json([
        'message' => 'Statut mis à jour avec succès',
        'document' => $document
    ]);
}

 public function getAllRecentDocuments(Request $request)
    {
        Log::info('DocumentController@getAllRecentDocuments (filtré par comptable): Début de la requête.');

        // Étape 1: Vérifier l'authentification
        if (!Auth::check()) {
            Log::warning('DocumentController@getAllRecentDocuments: Utilisateur non authentifié. Renvoi 401.');
            return response()->json(['message' => 'Utilisateur non authentifié.'], 401);
        }

        $comptable = Auth::user();
        $comptableId = $comptable->id;
        Log::info('DocumentController@getAllRecentDocuments: Utilisateur authentifié. Comptable ID: ' . $comptableId);

        // Étape 2: Construire la requête pour récupérer les documents récents du comptable
        $documents = Document::query()
            ->whereHas('entreprise', function ($query) use ($comptableId) {
                // Filtrer par les entreprises appartenant au comptable connecté.
                // 'entreprise' est la relation dans le modèle Document.
                // 'id_comptable' est la colonne dans la table 'entreprises' liant à un comptable.
                // **VÉRIFIEZ LE NOM DE LA RELATION ET DE LA COLONNE 'id_comptable'**
                $query->where('id_comptable', $comptableId);
            })
            ->with(['entreprise:id,nom_entreprise']) // Optionnel: pour inclure le nom de l'entreprise dans la réponse
            ->orderBy('created_at', 'desc') // Ordonner par date de création, les plus récents en premier
            ->take(10) // Limiter aux 10 premiers résultats
            ->get([ // Sélectionner les colonnes nécessaires pour la réponse
                'id',
                'nom_fichier',
                'chemin_fichier',
                'created_at',
                'type',
                'statut',
                'uploaded_at', // Si vous avez ce champ et qu'il est pertinent
                'id_entreprise' // Utile si vous voulez afficher l'entreprise associée
            ]);

        Log::info('DocumentController@getAllRecentDocuments: Nombre de documents récents pour comptable ID ' . $comptableId . ': ' . $documents->count());

        // Étape 3: Formater les documents pour la réponse (votre logique existante, légèrement adaptée)
        $formattedDocuments = $documents->map(function ($document) {
            return [
                'id' => $document->id,
                'name' => $document->nom_fichier, // 'name' pour correspondre au frontend si besoin
                'company_name' => $document->entreprise ? $document->entreprise->nom_entreprise : 'N/A', // Si with('entreprise') est utilisé
                'chemin_fichier' => $document->chemin_fichier ? Storage::url($document->chemin_fichier) : null, // Si vous utilisez Storage::url()
                'type' => $document->type,
                'statut' => $document->statut,
                'date' => $document->created_at ? $document->created_at->format('Y-m-d') : null, // 'date' pour correspondre au frontend
                // 'created_at_iso' => $document->created_at ? $document->created_at->toIso8601String() : null, // Optionnel: si vous préférez ISO
                'uploaded_at' => $document->uploaded_at // Gardez la logique originale si 'uploaded_at' est important
                    ? Carbon::parse($document->uploaded_at)->toIso8601String()
                    : ($document->created_at ? Carbon::parse($document->created_at)->toIso8601String() : null),
            ];
        });
        
        Log::info('DocumentController@getAllRecentDocuments: Documents formatés et prêts à être renvoyés.');
        return response()->json($formattedDocuments); // Laravel enveloppera automatiquement cela dans une clé 'data' si vous retournez une collection directement, sinon c'est bien.
                                                    // Pour être cohérent avec les autres fonctions, vous pourriez faire : return response()->json(['data' => $formattedDocuments]);
    }
  
 
    public function indexPublic(Request $request) // Gardons le nom 'indexPublic' pour correspondre à votre route
    {
        Log::info('DocumentController@indexPublic: Début de la requête.');
        Log::info('DocumentController@indexPublic: Token reçu par Laravel (Header Authorization): ' . $request->header('Authorization'));
        Log::info('DocumentController@indexPublic: Auth::check() avant la vérification: ' . (Auth::check() ? 'true' : 'false'));
        Log::info('DocumentController@indexPublic: Auth::user() avant la vérification: ' . json_encode(Auth::user()));

        // Étape 1: Vérifier l'authentification de l'utilisateur (comptable)
        $comptable = Auth::user(); // Tente de récupérer l'utilisateur authentifié via le token Sanctum

        if (!$comptable) {
            // Si Auth::user() retourne null, l'utilisateur n'est pas authentifié
            Log::warning('DocumentController@indexPublic: Utilisateur non authentifié. Le token est invalide ou manquant. Renvoi 401.');
            return response()->json(['message' => 'Utilisateur non authentifié.'], 401);
        }

        Log::info('DocumentController@indexPublic: Utilisateur authentifié avec succès. ID: ' . $comptable->id . ', Email: ' . $comptable->email);

        // Étape 2: Récupérer l'ID du comptable connecté
        $comptableId = $comptable->id;

        // Étape 3: Construire la requête pour récupérer les documents
        // Filtrer les documents où l'entreprise associée...
        $documentsQuery = Document::query()
            ->whereHas('entreprise', function ($query) use ($comptableId) {
                // ...a un 'id_comptable' qui correspond à l'ID du comptable connecté.
                // **IMPORTANT**: Assurez-vous que 'id_comptable' est le nom correct de la colonne
                // dans votre table 'entreprises' qui lie une entreprise à un comptable.
                // Si cette colonne s'appelle 'user_id' ou autre, changez-le ici.
                $query->where('id_comptable', $comptableId);
            });

        // Étape 4: Eager load les relations nécessaires et calculer les sommes
        $documents = $documentsQuery
            ->with(['entreprise:id,nom_entreprise']) // Charger seulement l'ID et le nom de l'entreprise pour l'efficacité
            ->withSum('justificatifs AS justificatifs_sum_taille_fichier', 'taille_fichier') // Calculer la somme de la taille des justificatifs
            ->orderBy('created_at', 'desc') // Ou 'date_document' si vous préférez ce champ pour le tri
            ->get();
            
        Log::info('DocumentController@indexPublic: Nombre de documents récupérés après filtrage: ' . $documents->count());

        // Étape 5: Mapper les résultats pour le frontend
        $formattedDocuments = $documents->map(function ($doc) {
            // La somme est déjà calculée par withSum et est disponible comme $doc->justificatifs_sum_taille_fichier
            return [
                'id'                               => $doc->id,
                'name'                             => $doc->nom_fichier, // Assurez-vous que 'nom_fichier' est le bon attribut pour le nom du document
                'company_name'                     => $doc->entreprise ? $doc->entreprise->nom_entreprise : 'N/A', // 'company_name' pour correspondre au frontend
                'type'                             => $doc->type,
                'status'                           => $doc->statut,
                'date'                             => $doc->created_at ? $doc->created_at->format('Y-m-d') : null, // Ou $doc->date_document si c'est un champ différent
                'chemin_fichier'                   => $doc->chemin_fichier ? Storage::url($doc->chemin_fichier) : null,
                'taille_fichier'                   => $doc->taille_fichier,
                'justificatifs_sum_taille_fichier' => (int) ($doc->justificatifs_sum_taille_fichier ?? 0),
            ];
        });
        
        Log::info('DocumentController@indexPublic: Documents formatés et prêts à être renvoyés.');
        return response()->json(['data' => $formattedDocuments], 200);
    }

    public function countALLDocuments()
{
  
 $count = Document::count();
    return response()->json(['total_documents' => $count]);
}


 public function countDocuments(Request $request) 
    {
        Log::info('DocumentController@countDocuments (filtré par comptable): Début de la requête.');

    
        if (!Auth::check()) {
            Log::warning('DocumentController@countDocuments: Utilisateur non authentifié. Renvoi 401.');
            return response()->json(['message' => 'Utilisateur non authentifié.'], 401);
        }

        $comptable = Auth::user();
        $comptableId = $comptable->id;
        Log::info('DocumentController@countDocuments: Utilisateur authentifié. Comptable ID: ' . $comptableId);

        $count = Document::query()
            ->whereHas('entreprise', function ($query) use ($comptableId) {
                // 'entreprise' est la relation dans le modèle Document.
                // 'id_comptable' est la colonne dans la table 'entreprises' liant à un comptable.
                // **VÉRIFIEZ LE NOM DE LA RELATION ET DE LA COLONNE 'id_comptable'**
                $query->where('id_comptable', $comptableId);
            })
            ->count(); // Obtenir le nombre de documents correspondants

        Log::info('DocumentController@countDocuments: Nombre de documents pour comptable ID ' . $comptableId . ': ' . $count);

        // Étape 3: Retourner le compte
        // La clé 'total_documents' peut être gardée, elle sera interprétée comme "total pour ce comptable"
        return response()->json(['total_documents' => $count]);
    }


}
