<?php

namespace App\Http\Controllers;

use App\Helpers\ActivityLogger; // Assurez-vous que ce helper existe et fonctionne
use App\Models\Entreprise;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB; // DB est importé mais pas utilisé directement dans ce code, à vérifier
use App\Enums\EntrepriseStatut; // Si vous avez créé l'Enum PHP
use Carbon\Carbon;
use Illuminate\Validation\Rules\Password; 

class EntrepriseController extends Controller
{
    public function index()
    {
        // Retourne toutes les entreprises avec leur comptable et le statut
        // Il est préférable de sélectionner explicitement les colonnes si possible
        return Entreprise::with('comptable')->get()->map(function ($entreprise) {
            return $this->formatEntrepriseForFrontend($entreprise);
        });
    }

public function store(Request $request)
{
    // Utiliser le guard API au lieu du guard web par défaut
    if (!auth('api')->check()) {
        return response()->json(['error' => 'Utilisateur non authentifié'], 401);
    }

    $request->validate([
        'nom_entreprise' => 'required|string|max:255',
        'nom' => 'required|string|max:255',
        'prenom' => 'required|string|max:255',
        'email' => 'required|email|unique:entreprises,email',
        'adresse' => 'required|string',
        'telephone' => 'required|string|max:20',
        'RC' => 'required|string|max:255',
        'ICE' => 'required|string|max:255|unique:entreprises,ICE',
        'IF' => 'required|string|max:255|unique:entreprises,IF',
        'nom_utilisateur' => 'required|string|max:255|unique:entreprises,nom_utilisateur',
        'mot_de_passe' => 'required|string|min:8',
    ]);

    // Récupérer l'ID du comptable connecté via le guard API
    $comptableId = auth('api')->id();
    $user = auth('api')->user();
    
    // Vérifier que l'utilisateur est bien un comptable (pas un admin)
    if ($user->role !== 'comptable') {
        return response()->json([
            'error' => 'Seuls les comptables peuvent créer des entreprises',
            'user_role' => $user->role
        ], 403);
    }

    $entreprise = Entreprise::create([
        'nom_entreprise' => $request->nom_entreprise,
        'nom' => $request->nom,
        'prenom' => $request->prenom,
        'email' => $request->email,
        'adresse' => $request->adresse,
        'telephone' => $request->telephone,
        'RC' => $request->RC,
        'ICE' => $request->ICE,
        'IF' => $request->IF,
        'nom_utilisateur' => $request->nom_utilisateur,
        'mot_de_passe' => Hash::make($request->mot_de_passe),
        'id_comptable' => $comptableId,
    ]);

    if (class_exists(ActivityLogger::class)) {
        ActivityLogger::log("Ajout de l'entreprise: " . $entreprise->nom_entreprise, $user);
    }

    return response()->json([
        'message' => 'Entreprise créée avec succès', 
        'entreprise' => $this->formatEntrepriseForFrontend($entreprise->fresh())
    ], 201);
}


   public function updateEntreprise(Request $request, $id)
{
    $entreprise = Entreprise::find($id);
    if (!$entreprise) {
        return response()->json(['message' => 'Entreprise introuvable'], 404);
    }

    // Seul le comptable propriétaire ou un admin devrait pouvoir modifier
    // Ajoutez une vérification de politique d'autorisation ici si nécessaire

    $validated = $request->validate([
        'nom_entreprise' => 'sometimes|required|string|max:255',
        'nom'            => 'sometimes|required|string|max:255',
        'prenom'         => 'sometimes|required|string|max:255',
        'email'          => 'sometimes|required|email|unique:entreprises,email,'.$id,
        'adresse'        => 'sometimes|required|string',
        'telephone'      => 'sometimes|required|string|max:20',
        'RC'             => 'sometimes|required|string|max:255',
        'ICE'            => 'sometimes|required|string|max:255|unique:entreprises,ICE,'.$id,
        'IF'             => 'sometimes|required|string|max:255|unique:entreprises,IF,'.$id,
        'nom_utilisateur'=> 'sometimes|required|string|max:255|unique:entreprises,nom_utilisateur,'.$id,
        'mot_de_passe'   => 'nullable|string|min:8',
    ]);

    // Utiliser fill pour les champs validés
    $entreprise->fill($validated);

    // Mettre le statut en "attente" lors de la modification
    $entreprise->statut = 'en_attente';

    if (!empty($validated['mot_de_passe'])) {
        $entreprise->mot_de_passe = Hash::make($validated['mot_de_passe']);
    }

    $entreprise->save();

    if (class_exists(ActivityLogger::class) && Auth::check()) {
        ActivityLogger::log("Mise à jour de l'entreprise: " . $entreprise->nom_entreprise . " (statut mis en attente)", Auth::user());
    }

    return response()->json([
        'message'    => 'Entreprise mise à jour avec succès. Le statut a été mis en attente pour validation.',
        'entreprise' => $this->formatEntrepriseForFrontend($entreprise->fresh())
    ], 200);
}
    public function showEntreprise($id)
    {
        $entreprise = Entreprise::withCount('documents')->with('comptable')->find($id); // Charger comptable aussi
        if (!$entreprise) {
            return response()->json(['message' => 'Entreprise introuvable'], 404);
        }

        return response()->json($this->formatEntrepriseForFrontend($entreprise), 200);
    }

    public function countALLEntreprises()
    {
        $count = Entreprise::count();
        return response()->json(['total_entreprises' => $count]);
    }


  public function countEntreprises(Request $request) // Gardons le nom, il est implicitement lié au contexte du comptable
    {
        Log::info('EntrepriseController@countEntreprises (filtré par comptable): Début de la requête.');

        // Étape 1: Vérifier l'authentification
        if (!Auth::check()) {
            Log::warning('EntrepriseController@countEntreprises: Utilisateur non authentifié. Renvoi 401.');
            return response()->json(['message' => 'Utilisateur non authentifié.'], 401);
        }

        $comptable = Auth::user();
        $comptableId = $comptable->id;
        Log::info('EntrepriseController@countEntreprises: Utilisateur authentifié. Comptable ID: ' . $comptableId);

        // Étape 2: Compter les entreprises du comptable connecté
        $count = Entreprise::query()
            // Filtrer les entreprises où la colonne 'id_comptable' (ou le nom que vous utilisez)
            // correspond à l'ID du comptable connecté.
            // **VÉRIFIEZ LE NOM DE CETTE COLONNE 'id_comptable' DANS VOTRE TABLE 'entreprises'**
            ->where('id_comptable', $comptableId)
            ->count(); // Obtenir le nombre d'entreprises correspondantes

        Log::info('EntrepriseController@countEntreprises: Nombre d\'entreprises pour comptable ID ' . $comptableId . ': ' . $count);

        // Étape 3: Retourner le compte
        // La clé 'total_entreprises' peut être gardée, elle sera interprétée comme "total pour ce comptable"
        return response()->json(['total_entreprises' => $count]);
    }


    public function pending()
    {
        // Récupère uniquement les entreprises avec statut 'en_attente'
        $companies = Entreprise::where('statut', EntrepriseStatut::EN_ATTENTE->value ?? 'en_attente')
                                ->with('comptable')
                                ->orderBy('created_at', 'desc')
                                ->get();

        $mapped = $companies->map(function ($company) {
            return [
                'id' => $company->id,
                'name' => $company->nom_entreprise, // Pour CompanyValidationPage
                'siret' => $company->ICE,         // Pour CompanyValidationPage (ICE)
                'rc' => $company->RC,
                'if' => $company->IF,
                'nom' => $company->nom,
                'prenom' => $company->prenom,
                'accountant' => $company->comptable
                    ? ($company->comptable->nom . ' ' . $company->comptable->prenom)
                    : 'Inconnu',
                'requestDate' => $company->created_at->format('d/m/Y H:i'),
                'address' => $company->adresse,
                'contact' => $company->email, // Email de l'entreprise
                'phone' => $company->telephone,
                'statut' => $company->statut,
                 // Important d'envoyer le statut
            ];
        });

        // Le frontend s'attend à un objet { companies: [...] }
        return response()->json(['companies' => $mapped]);
    }
 public function valider($id)
{
    $entreprise = Entreprise::findOrFail($id);

    // Vérifier si l'entreprise est déjà validée
    if ($entreprise->statut === EntrepriseStatut::VALIDEE) {
        return response()->json([
            'message' => 'Cette entreprise est déjà validée'
        ], 400);
    }

    // Permettre la validation pour les entreprises en attente ET rejetées
    if (!in_array($entreprise->statut, [EntrepriseStatut::EN_ATTENTE, EntrepriseStatut::REJETEE])) {
        return response()->json([
            'message' => 'Cette entreprise ne peut pas être validée dans son état actuel (' . $entreprise->statut->value . ')'
        ], 400);
    }

    // Déterminer le type d'action pour le log
    $isReactivation = $entreprise->statut === EntrepriseStatut::REJETEE;

    $entreprise->statut = EntrepriseStatut::VALIDEE;
    $entreprise->raison_rejet = null; // Effacer la raison de rejet
    $entreprise->save();

    if (class_exists(ActivityLogger::class) && Auth::check()) {
        $action = $isReactivation ? 'Réactivation' : 'Validation';
        ActivityLogger::log($action . " de l'entreprise: " . $entreprise->nom_entreprise, Auth::user());
    }

    $message = $isReactivation 
        ? 'Entreprise réactivée avec succès' 
        : 'Entreprise validée avec succès';

    return response()->json([
        'message' => $message, 
        'entreprise' => $this->formatEntrepriseForFrontend($entreprise->fresh())
    ]);
}
    public function rejectCompany(Request $request, $id)
    {
        $validatedData = $request->validate([
            'reason' => 'required|string|min:5|max:1000',
        ]);

        $company = Entreprise::find($id);
        if (!$company) {
            return response()->json(['message' => 'Entreprise non trouvée.'], 404);
        }

        if ($company->statut !== EntrepriseStatut::EN_ATTENTE) {
            return response()->json([
                'message' => 'Cette entreprise ne peut pas être rejetée dans son état actuel (' . $company->statut->value . ').' // ✅ Utiliser ->value pour la chaîne
            ], 400);
        }

        $company->statut = EntrepriseStatut::REJETEE; // Eloquent gère ->value
        $company->raison_rejet = $validatedData['reason'];
        $company->save();

        if (class_exists(ActivityLogger::class) && Auth::check()) {
            ActivityLogger::log("Rejet de l'entreprise: " . $company->nom_entreprise . " Raison: " . $company->raison_rejet, Auth::user());
        }

        return response()->json([
            'message' => 'Entreprise rejetée avec succès.',
            'entreprise' => $this->formatEntrepriseForFrontend($company->fresh())
        ], 200);
    }
 public function list(Request $request)
    {
        Log::info('EntrepriseController@list (filtré par comptable): Début de la requête.');

        // Étape 1: Vérifier l'authentification
        if (!Auth::check()) {
            Log::warning('EntrepriseController@list: Utilisateur non authentifié. Renvoi 401.');
            return response()->json(['message' => 'Utilisateur non authentifié.'], 401);
        }

        $comptable = Auth::user();
        $comptableId = $comptable->id;
        Log::info('EntrepriseController@list: Utilisateur authentifié. Comptable ID: ' . $comptableId);

        // Étape 2: Construire la requête pour récupérer les entreprises du comptable
        $entreprises = Entreprise::query()
            // Filtrer les entreprises où la colonne 'id_comptable' (ou le nom que vous utilisez)
            // correspond à l'ID du comptable connecté.
            // **VÉRIFIEZ LE NOM DE CETTE COLONNE 'id_comptable' DANS VOTRE TABLE 'entreprises'**
            ->where('id_comptable', $comptableId)
            ->withCount('documents as document_count') // Compter les documents associés
            ->orderBy('nom_entreprise', 'asc') // Optionnel: ordonner par nom d'entreprise
            ->get(['id', 'nom_entreprise']); // Sélectionner les colonnes nécessaires

        Log::info('EntrepriseController@list: Nombre d\'entreprises récupérées pour comptable ID ' . $comptableId . ': ' . $entreprises->count());

        // Étape 3: Formater les entreprises pour la réponse (votre logique existante)
        // Cette étape est facultative si la structure retournée par ->get() vous convient déjà.
        // Le mappage que vous aviez est bon si vous voulez renommer 'nom_entreprise' en 'nom'.
        $formattedEntreprises = $entreprises->map(function ($entreprise) {
            return [
                'id' => $entreprise->id,
                'nom' => $entreprise->nom_entreprise, // Renomme 'nom_entreprise' en 'nom'
                'document_count' => $entreprise->document_count,
            ];
        });
        
        Log::info('EntrepriseController@list: Entreprises formatées et prêtes à être renvoyées.');
        // Si vous ne faites pas le mappage ci-dessus, retournez directement $entreprises :
        // return response()->json($entreprises);
        
        // Si vous faites le mappage :
        return response()->json($formattedEntreprises);
    }



public function getFormattedCompanies(Request $request)
{
    // Check authentication
    if (!Auth::check()) {
        return response()->json(['error' => 'User not authenticated'], 401);
    }
    
    // Get authenticated user's ID
    $comptableId = Auth::id();
    
    // Rest of your existing code remains the same
    $entreprises = Entreprise::where('id_comptable', $comptableId)
                             ->withCount('documents')
                             ->with('dernierAbonnement')
                             ->get();

    $formatted = $entreprises->map(function ($entreprise) {
        // Your existing mapping logic...
        $tailleTotalePourEntreprise = 0;
        
        $documentsDeLEntreprise = $entreprise->documents;
        
        if ($documentsDeLEntreprise && $documentsDeLEntreprise->count() > 0) {
            foreach ($documentsDeLEntreprise as $document) {
                $tailleTotalePourEntreprise += $document->taille_totale_document;
            }
        }
        
        $abonnement = $entreprise->dernierAbonnement;
        $statutAbonnement = 'aucun';
        $dateFinAbonnement = null;
        
        if ($abonnement) {
            $dateFin = Carbon::parse($abonnement->date_fin);
            $aujourdhui = Carbon::today();
            $dateFinAbonnement = $dateFin->format('Y-m-d');
            
            if ($dateFin->isPast()) {
                $statutAbonnement = 'expiré';
            } elseif ($dateFin->diffInDays($aujourdhui) <= 30 && !$dateFin->isPast()) {
                $statutAbonnement = 'expire bientot';
            } else {
                $statutAbonnement = 'actif';
            }
        }
        
        return [
            'id' => $entreprise->id,
            'nom_entreprise' => $entreprise->nom_entreprise,
            'nom' => $entreprise->nom,
            'prenom' => $entreprise->prenom,
            'ICE' => $entreprise->ICE,
            'adresse' => $entreprise->adresse,
            'email' => $entreprise->email,
            'telephone' => $entreprise->telephone,
            'RC' => $entreprise->RC,
            'IF' => $entreprise->IF,
            'nom_utilisateur' => $entreprise->nom_utilisateur,
            'statut' => $entreprise->statut,
            'raison_rejet' => $entreprise->raison_rejet,
            'document_count' => $entreprise->documents_count,
            'created_at' => $entreprise->created_at ? $entreprise->created_at->toIso8601String() : null,
            'taille_totale_documents_entreprise' => $tailleTotalePourEntreprise,
            'statut_abonnement' => $statutAbonnement,
            'date_fin_abonnement' => $dateFinAbonnement,
        ];
    });

    return response()->json($formatted);
}

    public function demandeSuppression($id, Request $request)
    {
        $request->validate([ 'raison' => 'required|string|max:1000']);
        $entreprise = Entreprise::findOrFail($id);

        $entreprise->demande_suppression = true; // Assurez-vous que ce champ existe dans la table
        $entreprise->raison_suppression = $request->raison; // Assurez-vous que ce champ existe
        $entreprise->save();

        if (class_exists(ActivityLogger::class) && Auth::check()) {
            ActivityLogger::log("Demande de suppression pour l'entreprise : " . $entreprise->nom_entreprise, Auth::user());
        }
        return response()->json(['message' => 'Demande de suppression envoyée avec succès.']);
    }

    public function demandesSuppressionEnAttente()
    {
        $entreprises = Entreprise::where('demande_suppression', true)
            ->with('comptable')
            ->orderBy('updated_at', 'desc') // Probablement updated_at pour la date de la demande
            ->get();

        $mapped = $entreprises->map(fn($company) => [
            'id'      => $company->id,
            'companyName' => $company->nom_entreprise,
            'ICE'     => $company->ICE,
            'reason'  => $company->raison_suppression, // Utiliser raison_suppression
            'contact' => $company->email,
            'phone'   => $company->telephone,
            'accountant'   => $company->comptable
                ? ($company->comptable->nom . ' ' . $company->comptable->prenom)
                : 'N/A',
            'requestDate'  => $company->updated_at->format('d/m/Y H:i'), // Date de la dernière mise à jour (demande)
            'address'      => $company->adresse,
            'documents'    => $company->documents()->count(), // Compter dynamiquement ou utiliser withCount si plus performant
            'statut'       => $company->statut, // Inclure le statut actuel de l'entreprise
        ]);

        return response()->json(['demandes_suppression' => $mapped]);
    }

    public function rejectRequest($id) // Rejeter une demande de suppression
    {
        $entreprise = Entreprise::findOrFail($id);

        // Vérifier les autorisations (admin uniquement)
        // if (Auth::user()->cannot('rejectDeleteRequest', $entreprise)) {
        //    return response()->json(['message' => 'Action non autorisée.'], 403);
        // }

        $entreprise->demande_suppression = false;
        $entreprise->raison_suppression = null;
        $entreprise->save();

        if (class_exists(ActivityLogger::class) && Auth::check()) {
            ActivityLogger::log("Rejet de la demande de suppression pour l'entreprise : " . $entreprise->nom_entreprise, Auth::user());
        }
        return response()->json(['message' => 'Demande de suppression rejetée avec succès.']);
    }

    
    private function formatEntrepriseForFrontend(Entreprise $entreprise, bool $isListForAccountant = false)
    {
        $data = [
            'id' => $entreprise->id,
            'nom_entreprise' => $entreprise->nom_entreprise, // Pour CompaniesPage
            'name' => $entreprise->nom_entreprise,           // Pour CompanyValidationPage & getFormattedCompanies
            'nom' => $entreprise->nom, // Contact nom
            'prenom' => $entreprise->prenom, // Contact prenom
            'ICE' => $entreprise->ICE, // Pour CompaniesPage
            'siret' => $entreprise->ICE, // Pour CompanyValidationPage & getFormattedCompanies (SIRET est souvent l'équivalent de l'ICE en France)
            'adresse' => $entreprise->adresse, // Pour CompaniesPage
            'address' => $entreprise->adresse, // Pour CompanyValidationPage
            'email' => $entreprise->email, // Pour CompaniesPage
            'contact' => $entreprise->email, // Pour CompanyValidationPage
            'telephone' => $entreprise->telephone, // Pour CompaniesPage
            'phone' => $entreprise->telephone, // Pour CompanyValidationPage
            'RC' => $entreprise->RC,
            'IF' => $entreprise->IF,
            'nom_utilisateur' => $entreprise->nom_utilisateur,
            'statut' => $entreprise->statut, // Source de vérité
            'raison_rejet' => $entreprise->raison_rejet,
            'document_count' => $entreprise->documents_count ?? $entreprise->documents()->count(), // Utiliser withCount si possible
            'documents' => $entreprise->documents_count ?? $entreprise->documents()->count(),      // Pour getFormattedCompanies
            'created_at' => $entreprise->created_at->toIso8601String(), // Format standard pour JS
            'requestDate' => $entreprise->created_at->format('d/m/Y H:i'), // Pour CompanyValidationPage
            'accountant' => $entreprise->comptable ? ($entreprise->comptable->nom . ' ' . $entreprise->comptable->prenom) : 'N/A',
        ];

        if ($isListForAccountant) {
            // Spécifique à getFormattedCompanies si les noms de champs doivent être différents
            // Ici, 'name', 'siret', 'documents' sont déjà gérés par les alias ci-dessus.
            // 'valide' n'est plus utilisé.
        }
        return $data;
    }


    public function listForSelect()
{
   
    $entreprises = Entreprise::select('id', 'nom_entreprise') // Assurez-vous que 'nom_entreprise' est le bon nom de colonne
                             ->orderBy('nom_entreprise')
                             ->get();
    return response()->json($entreprises);
}


public function indexWithComptablesAndDocuments()
{
    $entreprises = Entreprise::with([
            'comptable',          // Charger la relation comptable
            'documents',          // Charger la collection complète des documents
            'dernierAbonnement'   // Charger le dernier abonnement
        ])
        ->withCount('documents')  // Toujours utile pour avoir 'documents_count' directement
        ->orderBy('created_at', 'desc') // Vous pouvez garder ou retirer cet orderBy si celui de dernierAbonnement suffit
        ->get();

    $mapped = $entreprises->map(function ($company) {
        $tailleTotalePourEntreprise = 0;

        // Maintenant, $company->documents DEVRAIT être la collection chargée grâce à l'eager loading
        $documentsDeLEntreprise = $company->documents;

        if ($documentsDeLEntreprise && $documentsDeLEntreprise->count() > 0) {
            foreach ($documentsDeLEntreprise as $document) {
                // Assurez-vous que 'taille_totale_document' est un attribut ou un accesseur sur votre modèle Document
                // et qu'il retourne bien une valeur numérique.
                $tailleTotalePourEntreprise += (int) $document->taille_totale_document;
            }
        }

        $abonnement = $company->dernierAbonnement;
        $statutAbonnement = 'aucun';
        $dateFinAbonnement = null;

        if ($abonnement) {
            $dateFin = Carbon::parse($abonnement->date_fin);
            $aujourdhui = Carbon::today();
            $dateFinAbonnement = $dateFin->format('Y-m-d');
            if ($dateFin->isPast()) {
                $statutAbonnement = 'expiré';
            } elseif ($dateFin->diffInDays($aujourdhui) <= 30 && !$dateFin->isPast()) {
                $statutAbonnement = 'expire bientot';
            } else {
                $statutAbonnement = 'actif';
            }
        }

        return [
            'id' => $company->id,
            'entreprise_nom' => $company->nom_entreprise,
            'RC' => $company->RC,
            'IF' => $company->IF,
            'ICE' => $company->ICE,
            'adresse' => $company->adresse,
            'email' => $company->email,
            'telephone' => $company->telephone,
            'responsable_nom' => $company->nom,
            'responsable_prenom' => $company->prenom,
            'created_at' => $company->created_at ? $company->created_at->toIso8601String() : null,
            'statut' => $company->statut,
            'raison_rejet' => $company->raison_rejet,
            // $company->comptable devrait maintenant être chargé
            'comptable_nom' => $company->comptable ? $company->comptable->nom : 'N/A',
            'comptable_prenom' => $company->comptable ? $company->comptable->prenom : '',
            'total_documents' => $company->documents_count, // Ceci vient de withCount
            'taille_totale_documents_entreprise' => $tailleTotalePourEntreprise,
            'statut_abonnement' => $statutAbonnement, // Le statut calculé backend
            'date_fin_abonnement' => $dateFinAbonnement,
        ];
    });

    return response()->json(['entreprises' => $mapped]);
}



    public function destroy($id)
    {
        $entreprise = Entreprise::findOrFail($id);

        $nom_entreprise = $entreprise->nom_entreprise; // Pour le log
        $entreprise->delete();

        if (class_exists(ActivityLogger::class) && Auth::check()) {
            ActivityLogger::log("Suppression de l'entreprise: " . $nom_entreprise, Auth::user());
        }

        return response()->json(['message' => 'Entreprise supprimée avec succès.']);
    }

    public function updateMyProfile(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = Auth::user();

        if (!($user instanceof Entreprise)) {
            return response()->json(['message' => 'Action non autorisée pour ce type d\'utilisateur.'], 403);
        }

        $entreprise = $user; // L'utilisateur authentifié est l'entreprise

        // Valider les données.
        // Les champs comme RC, ICE, IF, nom_utilisateur ne devraient peut-être pas être modifiables facilement par l'utilisateur lui-même
        // ou devraient déclencher une re-validation par un admin.
        // Pour l'instant, nous permettons la modification de champs "simples".
        $validated = $request->validate([
            'nom_entreprise' => 'sometimes|required|string|max:255',
            // 'nom'            => 'sometimes|required|string|max:255', // Nom du responsable
            // 'prenom'         => 'sometimes|required|string|max:255', // Prénom du responsable
            'email'          => ['sometimes', 'required', 'email', Rule::unique('entreprises')->ignore($entreprise->id)],
            'adresse'        => 'sometimes|required|string|max:1000',
            'telephone'      => 'sometimes|required|string|max:20',
            // Ajoutez d'autres champs que l'entreprise peut modifier
            // Par exemple, si le nom et prénom du contact de l'entreprise sont modifiables :
            'nom_contact' => 'sometimes|nullable|string|max:255', // Correspondra à 'nom' dans la DB
            'prenom_contact' => 'sometimes|nullable|string|max:255', // Correspondra à 'prenom' dans la DB
        ]);

        // Mappage spécifique pour nom/prénom du contact si vous les envoyez ainsi depuis Flutter
        if ($request->has('nom_contact')) {
            $validated['nom'] = $validated['nom_contact'];
            unset($validated['nom_contact']);
        }
        if ($request->has('prenom_contact')) {
            $validated['prenom'] = $validated['prenom_contact'];
            unset($validated['prenom_contact']);
        }


        // Mettre à jour l'entreprise
        $entreprise->fill($validated);

        // Si des modifications sensibles (ex: email) nécessitent une re-validation ou notification
        // if ($entreprise->isDirty('email')) {
        //     // Logique de notification ou de mise en attente de validation
        // }

        $entreprise->save();

        // Retourner les informations mises à jour (similaire à ce que l'endpoint /profile retourne)
        return response()->json([
            'message' => 'Informations du profil mises à jour avec succès.',
            'entreprise' => [ // Renvoyer un format cohérent avec l'endpoint /profile
                'id' => $entreprise->id,
                'nom_entreprise' => $entreprise->nom_entreprise,
                'nom' => $entreprise->nom, // nom du contact
                'prenom' => $entreprise->prenom, // prenom du contact
                'email' => $entreprise->email,
                'telephone' => $entreprise->telephone,
                'adresse' => $entreprise->adresse,
                'type' => 'entreprise' // Pour que le client Flutter sache que c'est une entreprise
            ]
        ]);
    }

    
    public function changeMyPassword(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = Auth::user();

        if (!($user instanceof Entreprise)) {
            return response()->json(['message' => 'Action non autorisée pour ce type d\'utilisateur.'], 403);
        }

        $entreprise = $user;

        $request->validate([
            'current_password' => ['required', function ($attribute, $value, $fail) use ($entreprise) {
                if (!Hash::check($value, $entreprise->mot_de_passe)) {
                    $fail('Le mot de passe actuel est incorrect.');
                }
            }],
            'new_password' => ['required', 'string', Password::min(6)->mixedCase()->numbers()->symbols(), 'confirmed'],
         
        ]);

        $entreprise->mot_de_passe = Hash::make($request->new_password);
        $entreprise->save();

        return response()->json(['message' => 'Mot de passe modifié avec succès.']);
    }



}