<?php

namespace App\Http\Controllers;

use App\Models\Abonnement;
use App\Models\Entreprise;
use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Log; 
use Illuminate\Support\Facades\Auth;

use Carbon\Carbon;
use Illuminate\Support\Facades\Validator;

class AbonnementController extends Controller
{
    // Liste abonnements des entreprises du comptable connecté
    public function index(Request $request)
    {
        Log::info('AbonnementController@index: Début de la requête.');

        if (!Auth::check()) {
            Log::warning('AbonnementController@index: Utilisateur non authentifié. Renvoi 401.');
            return response()->json(['message' => 'Utilisateur non authentifié.'], 401);
        }

        $comptable = Auth::user();
        $comptableId = $comptable->id;
        Log::info('AbonnementController@index: Utilisateur authentifié. ID: ' . $comptable->id);

        $abonnements = Abonnement::query()
            ->whereHas('entreprise', function ($query) use ($comptableId) {
                $query->where('id_comptable', $comptableId);
            })
            ->with([
                'entreprise:id,nom_entreprise',
                'plan:id,nom,espace_max,prix',
            ])
            ->orderBy('created_at', 'desc')
            ->get();

        $abonnements->transform(function ($abonnement) {
            if ($abonnement->date_debut) {
                $abonnement->date_debut = Carbon::parse($abonnement->date_debut)->format('Y-m-d');
            }
            if ($abonnement->date_fin) {
                $abonnement->date_fin = Carbon::parse($abonnement->date_fin)->format('Y-m-d');
            }
            return $abonnement;
        });

        return response()->json($abonnements);
    }

    // Création d'un nouvel abonnement
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_entreprise' => [
                'required',
                'exists:entreprises,id',
                function ($attribute, $value, $fail) {
                    $activeSubscriptionExists = Abonnement::where('id_entreprise', $value)
                        ->where('statut', 'actif')
                        ->exists();

                    if ($activeSubscriptionExists) {
                        $entreprise = Entreprise::find($value);
                        $nomEntreprise = $entreprise ? $entreprise->nom_entreprise : 'cette entreprise';
                        $fail("L'entreprise \"{$nomEntreprise}\" a déjà un abonnement actif.");
                    }
                },
            ],
            'plan_id' => [
                'required',
                'exists:plans,id',
            ],
            'date_debut' => 'required|date_format:Y-m-d',
            'date_fin' => 'required|date_format:Y-m-d|after_or_equal:date_debut',
            'montant' => 'required|numeric|min:0',
            'etat_validation' => [
                'sometimes',
                Rule::in(['en_attente', 'valide', 'refuse']),
            ],
            'statut' => [
                'sometimes',
                Rule::in(['actif', 'expiré']),
            ],
            'type' => [
                'required',
                Rule::in(['initial', 'renouvellement', 'upgrade']),
            ],
            'justificatif_path' => 'sometimes|nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Erreurs de validation.', 'errors' => $validator->errors()], 422);
        }

        $validated = $validator->validated();

        $dateDebut = Carbon::parse($validated['date_debut']);
        $dateFin = Carbon::parse($validated['date_fin']);
        $today = Carbon::now();

        if ($dateFin->isPast()) {
            $validated['statut'] = 'expiré';
        } else {
            $validated['statut'] = 'actif';
        }

        if (!isset($validated['etat_validation'])) {
            $validated['etat_validation'] = 'en_attente';
        }

        $abonnement = Abonnement::create($validated);

        return response()->json($abonnement->load('entreprise', 'plan'), 201);
    }

    // Mise à jour d'un abonnement (inclut renouvellement)
    public function update(Request $request, Abonnement $abonnement)
    {
        Log::info('Requête reçue pour update abonnement', $request->all());

        if ($request->input('_action') === 'renew') {
            $today = Carbon::now();
            $currentEndDate = Carbon::parse($abonnement->date_fin);

            if ($currentEndDate->isPast()) {
                $abonnement->date_debut = $today->format('Y-m-d');
                $abonnement->date_fin = $today->copy()->addYear()->format('Y-m-d');
            } else {
                $abonnement->date_fin = $currentEndDate->copy()->addYear()->format('Y-m-d');
            }

            $abonnement->statut = 'actif';
            $abonnement->etat_validation = 'valide'; // Par exemple, pour re-validation admin
            $abonnement->save();

            return response()->json($abonnement->load('entreprise', 'plan'));
        }

        $validated = $request->validate([
            'id_entreprise' => 'sometimes|required|exists:entreprises,id',
            'plan_id' => 'sometimes|required|exists:plans,id',
            'date_debut' => 'sometimes|required|date_format:Y-m-d',
            'date_fin' => 'sometimes|required|date_format:Y-m-d|after_or_equal:date_debut',
            'montant' => 'sometimes|required|numeric|min:0',
            'etat_validation' => [
                'sometimes',
                Rule::in(['en_attente', 'valide', 'refuse']),
            ],
            'statut' => [
                'sometimes',
                Rule::in(['actif', 'expiré']),
            ],
            'type' => [
                'sometimes',
                Rule::in(['initial', 'renouvellement', 'upgrade']),
            ],
            'justificatif_path' => 'sometimes|nullable|string|max:255',
        ]);

        if (isset($validated['date_debut']) || isset($validated['date_fin'])) {
            $dateDebut = Carbon::parse($validated['date_debut'] ?? $abonnement->date_debut);
            $dateFin = Carbon::parse($validated['date_fin'] ?? $abonnement->date_fin);
            $today = Carbon::now();

            if ($dateFin->isPast()) {
                $validated['statut'] = 'expiré';
            } else {
                $validated['statut'] = 'actif';
            }
        }

        $abonnement->update($validated);

        return response()->json($abonnement->load('entreprise', 'plan'));
    }

    // Détail d'un abonnement
    public function show(Abonnement $abonnement)
    {
        $abonnement->load('entreprise', 'plan');

        if ($abonnement->date_debut) {
            $abonnement->date_debut = Carbon::parse($abonnement->date_debut)->format('Y-m-d');
        }
        if ($abonnement->date_fin) {
            $abonnement->date_fin = Carbon::parse($abonnement->date_fin)->format('Y-m-d');
        }

        return response()->json($abonnement);
    }

    // Liste tous les abonnements (admin)
    public function indexadmin(Request $request)
    {
        Log::info('AbonnementController@indexadmin: Récupération de tous les abonnements.');

        if (!Auth::check()) {
            Log::warning('AbonnementController@indexadmin: Utilisateur non authentifié.');
            return response()->json(['message' => 'Utilisateur non authentifié.'], 401);
        }

        $user = Auth::user();

        // Si nécessaire, vérifier rôle admin ici

        $abonnements = Abonnement::with(['entreprise:id,nom_entreprise', 'plan:id,nom,espace_max,prix'])
            ->orderBy('created_at', 'desc')
            ->get();

        $abonnements->transform(function ($abonnement) {
            if ($abonnement->date_debut) {
                $abonnement->date_debut = Carbon::parse($abonnement->date_debut)->format('Y-m-d');
            }
            if ($abonnement->date_fin) {
                $abonnement->date_fin = Carbon::parse($abonnement->date_fin)->format('Y-m-d');
            }
            return $abonnement;
        });

        return response()->json($abonnements);
    }


public function storedemande(Request $request)
{
    $validator = Validator::make($request->all(), [
        'entreprise_id' => 'required|integer|exists:entreprises,id',
        'plan_id'       => 'required|string|in:basic,standard,premium',
        'file'          => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
    ]);

    if ($validator->fails()) {
        return response()->json(['message' => 'Erreurs de validation.', 'errors' => $validator->errors()], 422);
    }

    $data = $validator->validated();

    // --- LOGIQUE AMÉLIORÉE POUR RÉCUPÉRER LE PLAN ET SON PRIX ---
    
    // On récupère l'objet Plan complet en se basant sur son nom (ou slug)
    // Assurez-vous que votre table 'plans' a une colonne 'nom' avec 'basic', 'standard', 'premium'
    $plan = Plan::where('nom', $data['plan_id'])->first();

    if (!$plan) {
        return response()->json(['message' => 'Plan invalide ou introuvable.'], 422);
    }
    // Maintenant, nous avons l'ID du plan ET son prix !
    // Par exemple : $plan->id et $plan->prix

    try {
        $path = $request->file('file')->store('justificatifs', 'public');

        $demande = new Abonnement();
        $demande->id_entreprise      = $data['entreprise_id'];
        $demande->plan_id            = $plan->id; // On utilise l'ID du plan trouvé
        $demande->date_debut         = now()->format('Y-m-d');
        $demande->date_fin           = now()->addYear()->format('Y-m-d');
        
        // CORRECTION CLÉ : On utilise le prix du plan trouvé dans la base de données
        // Assurez-vous que votre colonne de prix s'appelle bien 'prix'. Si elle s'appelle 'montant', utilisez $plan->montant
        $demande->montant            = $plan->prix; 
        
        $demande->type               = 'initial';
        $demande->etat_validation    = 'en_attente';
        $demande->justificatif_path  = $path;
        
        // Le statut sera 'actif' par défaut si la date de fin est dans le futur
        $demande->statut             = 'actif'; 

        $demande->save();

        return response()->json([
            'message' => 'Demande d’abonnement envoyée avec succès',
            'demande' => $demande->load('plan') // Charger la relation pour une réponse complète
        ], 200);

    } catch (\Exception $e) {
        return response()->json([
            'message' => 'Une erreur est survenue lors du traitement de votre demande.',
            'error' => $e->getMessage()
        ], 500);
    }
}

}
