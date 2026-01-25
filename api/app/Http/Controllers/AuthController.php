<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use App\Models\Entreprise;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;
use App\Models\Abonnement;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required'  // Ici aussi : "password"
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Identifiants invalides'], 401);
        }

        $token = $user->createToken('api-token')->plainTextToken;
      
        return response()->json([
            'token' => $token,
            'user' => $user,
            'role' => $user->role,
            
        ]);
    }

    public function loginEntreprise(Request $request)
    {
        // 1. Validation (inchangée)
        $request->validate([
            'nom_utilisateur' => 'required|string',
            'mot_de_passe' => 'required|string',
        ]);

        // 2. Recherche de l'entreprise (inchangée)
        $entreprise = Entreprise::where('nom_utilisateur', $request->nom_utilisateur)->first();

        if (!$entreprise || !Hash::check($request->mot_de_passe, $entreprise->mot_de_passe)) {
            return response()->json(['message' => 'Identifiants invalides'], 401);
        }

        // 3. Création du token (inchangée)
        $token = $entreprise->createToken('entreprise-token')->plainTextToken;

        // -----------------------------------------------------------
        // 4. LOGIQUE DE VÉRIFICATION DE L'ABONNEMENT (Version Finale)
        // -----------------------------------------------------------

        // On cherche un abonnement qui remplit TOUTES les conditions requises
        $isSubscribed = Abonnement::where('id_entreprise', $entreprise->id)
                                  ->whereIn('etat_validation', ['valide', 'en_attente']) 
                                  // L'admin doit l'avoir validé
                                  ->where('date_fin', '>=', now())   // Et la date de fin ne doit pas être dépassée
                                  ->exists(); // Retourne true si au moins une ligne correspond, sinon false

        // -----------------------------------------------------------
        // 5. CONSTRUCTION DE LA RÉPONSE JSON (Version Finale)
        // -----------------------------------------------------------
        
        // On construit la réponse pour correspondre exactement à ce que Flutter attend.
        return response()->json([
            'success' => true,
            'token' => $token,
            'entreprise' => [ // Un objet 'entreprise' qui contient les infos
                'id' => $entreprise->id,
                'nom' => $entreprise->nom,
                'status' => $entreprise->statut, // Utilisation de 'statut' si c'est le nom de la colonne dans votre table `entreprises`
                
                // LA CLÉ DU SUCCÈS EST ICI !
                'has_active_subscription' => $isSubscribed, 
            ]
        ], 200);
    }
    public function logout(Request $request): JsonResponse
    {
       
        $user = $request->user();

        if ($user) {
          
            $user->tokens()->delete(); // Supprime tous les tokens pour cet utilisateur

            return response()->json(['message' => 'Déconnexion réussie.']);
        }

    
        return response()->json(['message' => 'Aucun utilisateur authentifié.'], 401);
    }

    public function profile()
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Utilisateur non trouvé'], 404);
        }

        // Vérifier si l'utilisateur est une entreprise ou un utilisateur standard
        if ($user instanceof \App\Models\Entreprise) {
            // C'est une entreprise
            return response()->json([
                'id' => $user->id,
                'nom_entreprise' => $user->nom_entreprise,
                'nom' => $user->nom,
                'prenom' => $user->prenom ?? '', // S'assurer que prenom existe même s'il est null
                'email' => $user->email,
                'telephone' => $user->telephone,
                'adresse' => $user->adresse,
                'type' => 'entreprise'
            ]);
        } else {
            // C'est un utilisateur standard (User)
            // Extraire le prénom du nom complet si le champ prenom n'existe pas
            $prenom = $user->prenom ?? $this->extractFirstName($user->name ?? '');

            return response()->json([
                'id' => $user->id,
                'name' => $user->name ?? '',
                'email' => $user->email,
                'telephone' => $user->telephone,
                'adresse' => $user->adresse,
                'prenom' => $prenom,
                // Toujours fournir un prénom
                'type' => 'user'
            ]);
        }
    }

    private function extractFirstName($fullName)
    {
        if (empty($fullName)) {
            return ''; // Retourner une chaîne vide plutôt que null
        }
        $nameParts = explode(' ', trim($fullName));
        return $nameParts[0];
    }


    public function stats()
    {
        $comptableCount = User::where('role', 'comptable')->count();

        return response()->json([
            'comptables' => $comptableCount,
            // Tu peux aussi ajouter ici les autres stats plus tard (entreprises, documents, etc.)
        ]);
    }

  public function index()
{
    $accountants = User::where('role', 'comptable')->get()->map(function ($user) {
        return [
            'id' => $user->id,
            'nom' => $user->nom ?? '',
            'prenom' => $user->prenom ?? '',
            'email' => $user->email ?? '',
            'statut' => $user->statut ?? 'actif',
            'entreprises' => $user->entreprises()->count(), // ✅ Compte réel ici
            'createdAt' => $user->created_at->format('Y-m-d'),
        ];
    });

    return response()->json([
        'accountants' => $accountants
    ]);
}

public function store(Request $request)
    {
        $request->validate([
            'nom' => 'required|string',
            'prenom' => 'required|string',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:6',
        ]);

        $user = User::create([
            'nom' => $request->nom,
            'prenom' => $request->prenom,
            'email' => $request->email,
            'password' => bcrypt($request->password),
            'role' => 'comptable',
            'statut' => 'inactif',
        ]);

        return response()->json([
            'id' => $user->id,
            'nom' => $user->nom,
            'prenom' => $user->prenom,
            'email' => $user->email,
            'statut' => $user->statut,
            'entreprises' => 0,
            'createdAt' => $user->created_at->format('Y-m-d'),
        ], 201);
    }




    public function destroy($id)
{
    $accountant = User::findOrFail($id);
    $accountant->delete();

    return response()->json(['message' => 'Comptable supprimé avec succès']);
}

public function update(Request $request, $id)
    {
        // 1. Récupère le comptable dans la table users
        $accountant = User::find($id);

        if (! $accountant) {
            return response()->json([
                'message' => 'Comptable introuvable'
            ], 404);
        }

        // 2. Valide les champs : nom, prenom, email, password
        $validated = $request->validate([
            'nom'      => 'required|string|max:255',
            'prenom'   => 'required|string|max:255',
            // on cible bien la table `users`
            'email'    => 'required|email|unique:users,email,' . $id,
            'password' => 'nullable|string|min:6',
        ]);

        // 3. Affecte les valeurs
        $accountant->nom    = $validated['nom'];
        $accountant->prenom = $validated['prenom'];
        $accountant->email  = $validated['email'];

        if (! empty($validated['password'])) {
            $accountant->password = Hash::make($validated['password']);
        }

        // 4. Sauvegarde et renvoie la réponse
        $accountant->save();

        return response()->json([
            'message'    => 'Comptable mis à jour avec succès',
            'accountant' => [
                'id'          => $accountant->id,
                'nom'         => $accountant->nom,
                'prenom'      => $accountant->prenom,
                'email'       => $accountant->email,
                'statut'      => $accountant->statut ?? 'actif',
                'entreprises' => $accountant->entreprises()->count(),
                'createdAt'   => $accountant->created_at->format('Y-m-d'),
            ],
        ], 200);
    }




public function getProfile(Request $request)
{
    $user = $request->user();
    return response()->json([
        'name' => $user->prenom . ' ' . $user->nom,
        'email' => $user->email,
    ]);
}




public function updateProfile(Request $request)
{
    $user = $request->user();

    $request->validate([
        'name' => 'required|string|max:255',
        'email' => 'required|email|max:255',
        'currentPassword' => 'nullable|string',
        'newPassword' => 'nullable|string|min:8|confirmed',
    ]);

    // Split name if needed or store as is
    $user->email = $request->email;

    // Pour le nom complet, tu peux faire explode et enregistrer nom/prenom séparément
    $nameParts = explode(' ', $request->name, 2);
    $user->prenom = $nameParts[0] ?? '';
    $user->nom = $nameParts[1] ?? '';

    if ($request->newPassword) {
        if (!Hash::check($request->currentPassword, $user->password)) {
            return response()->json(['error' => 'Mot de passe actuel incorrect'], 400);
        }
        $user->password = Hash::make($request->newPassword);
    }
    $user->save();

    return response()->json(['success' => true]);
}

public function getNotifications(Request $request)
{
    $user = $request->user();
    // Imaginons que tu stockes ça dans une colonne JSON `settings`
    $settings = $user->settings ?? [];
    return response()->json([
        'emailNotifications'      => $settings['emailNotifications'] ?? false,
        'newAccountantAlert'      => $settings['newAccountantAlert'] ?? false,
        'companyValidationAlert'  => $settings['companyValidationAlert'] ?? false,
    ]);
}

public function updateNotifications(Request $request)
{
    $request->validate([
        'emailNotifications'     => 'boolean',
        'newAccountantAlert'     => 'boolean',
        'companyValidationAlert' => 'boolean',
    ]);

    $user = $request->user();
    $settings = $user->settings ?? [];
    $settings['emailNotifications']     = $request->emailNotifications;
    $settings['newAccountantAlert']     = $request->newAccountantAlert;
    $settings['companyValidationAlert'] = $request->companyValidationAlert;
    $user->settings = $settings;
    $user->save();

    return response()->json(['message' => 'Notifications mises à jour']);
}





public function getSubscriptionInfo(Request $request): JsonResponse
{
    $user = $request->user();

    if (!($user instanceof Entreprise)) {
        return response()->json(['message' => 'Accès non autorisé pour ce type d\'utilisateur.'], 403);
    }

    $entreprise = $user;
    $abonnement = $entreprise->dernierAbonnement; // Assure-toi que cela retourne l'objet Abonnement complet

    if (!$abonnement) {
        return response()->json([
            'plan' => null, // Renvoyer null pour le plan si aucun abonnement
            'date_fin' => null,
            'status' => 'aucun',
            'montant' => null,
        ]);
    }

    $dateFin = Carbon::parse($abonnement->date_fin)->endOfDay();
    $aujourdhui = Carbon::now();
    $statutAbonnement = '';
    $joursAvantExpirationPourAlerte = 30;

    if ($dateFin->isPast()) {
        $statutAbonnement = 'expiré';
    } elseif ($dateFin->diffInDays($aujourdhui) <= $joursAvantExpirationPourAlerte) {
        $statutAbonnement = 'expire_bientot';
    } else {
        $statutAbonnement = 'actif';
    }

    // Assure-toi que $abonnement->plan est bien l'objet Plan associé,
    // et non une simple chaîne. Si 'plan' est une colonne de la table abonnement,
    // et non une relation, tu devras ajuster.
    // Si 'plan' est une relation Eloquent, tu peux la charger et la sérialiser.
    
    // Exemple si 'plan' est une relation (requires with('plan') sur dernierAbonnement)
    // $planData = $abonnement->plan ? $abonnement->plan->toArray() : null;

    // Si $abonnement->plan est juste une string contenant "Basic", "Premium", etc.
    // Alors le code PHP précédent était correct : 'plan_name' => ucfirst($abonnement->plan),
    // et il faut revenir à la version Flutter qui s'attend à 'plan_name'.

    // Mais puisque l'image montre un JSON complet, cela signifie que $abonnement->plan
    // est probablement déjà un objet ou une relation sérialisée.
    // Assumons que $abonnement->plan est une relation qui renvoie un objet Plan.

    return response()->json([
        'plan' => $abonnement->plan, // Cela sérialisera l'objet Plan en JSON.
                                     // Assure-toi que le modèle Plan a les attributs id, nom, etc.
                                     // Ou utilise $abonnement->plan->only(['id', 'nom', 'espace_max', 'prix'])
                                     // pour ne pas envoyer toutes les infos.
        'date_fin' => Carbon::parse($abonnement->date_fin)->toDateString(),
        'status' => $statutAbonnement,
        'montant' => $abonnement->montant, // Assure-toi que ceci est correct
    ]);
}



}
