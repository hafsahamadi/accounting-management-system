<?php

namespace App\Http\Controllers;

use App\Models\JustificatifPaiement;
use App\Models\Document; // Pour vérifier que le document parent existe
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class JustificatifPaiementController extends Controller
{
     public function store(Request $request)
    {
        $entreprise = $request->user();
        if (!$entreprise || !$entreprise->id) {
            return response()->json(['message' => 'Utilisateur entreprise non authentifié ou ID manquant.'], 401);
        }

        $validatedData = $request->validate([
            'id_facture' => 'required|exists:documents,id', // ID du document principal auquel lier
            'document_justificatif' => 'required|file|mimes:pdf,jpg,jpeg,png', // Le fichier du justificatif
            'mode_paiement' => 'nullable|sometimes|in:cheque,virement,espece,autre', // Optionnel
            'date_justificatif' => 'nullable|sometimes|date_format:Y-m-d', // Optionnel
        ]);

        // Vérifier que le document principal (id_facture) appartient à l'entreprise authentifiée
        $documentPrincipal = Document::where('id', $validatedData['id_facture'])
                                     ->where('id_entreprise', $entreprise->id)
                                     ->first();

        if (!$documentPrincipal) {
            return response()->json(['message' => 'Document principal non trouvé ou n\'appartient pas à cette entreprise.'], 404);
        }
  $file = $request->file('document_justificatif');
        $path = $request->file('document_justificatif')->store('justificatifs', 'public'); // Stocke dans storage/app/public/justificatifs
     $tailleFichierEnOctets = $file->getSize();
        $justificatif = JustificatifPaiement::create([
            'id_facture' => $validatedData['id_facture'],
            'mode_paiement' => $request->mode_paiement ?? 'autre', // Valeur par défaut si non fournie par Flutter
            'date_justificatif' => $request->date_justificatif, // Sera null si non fourni
            'chemin_fichier' => $path,
            'taille_fichier' => $tailleFichierEnOctets,
            // Vous pourriez ajouter 'nom_fichier' au modèle/migration JustificatifPaiement si vous voulez le stocker
            // 'nom_fichier' => $request->file('document_justificatif')->getClientOriginalName(),
        ]);

        return response()->json($justificatif, 201);
    }


public function getByFacture($factureId)
    {
        $justificatifs = JustificatifPaiement::where('id_facture', $factureId)
            ->get()
            ->map(function($j){
                $url = null;
                // Si chemin_fichier est déjà une URL complète (ex: si importé d'une autre source)
                if (Str::startsWith($j->chemin_fichier, ['http://', 'https://'])) {
                    $url = $j->chemin_fichier;
                } else {
                    // Sinon, construisez l'URL publique en utilisant Storage::url()
                    // Laravel va préfixer ceci avec la valeur de APP_URL si elle est définie,
                    // sinon avec '/storage'.
                    // Pour que cela fonctionne avec http://192.168.1.14:8000/storage/...,
                    // votre .env de Laravel DOIT avoir APP_URL=http://192.168.1.14:8000
                    $url = Storage::url($j->chemin_fichier);

                    // Si Storage::url() ne génère toujours pas l'URL complète avec l'IP
                    // (par exemple, si APP_URL n'est pas configuré avec l'IP),
                    // alors vous devrez construire l'URL manuellement comme ceci :
                    // $baseUrl = config('app.url'); // Utilise la valeur de APP_URL dans .env
                    // $url = $baseUrl . '/storage/' . $j->chemin_fichier;

                    // Encore mieux, si vous utilisez une IP spécifique pour l'API, définissez-la dans .env
                    // ex: API_BASE_URL=http://192.168.1.14:8000
                    // et utilisez :
                    // $apiBaseUrl = env('API_BASE_URL', config('app.url'));
                    // $url = $apiBaseUrl . '/storage/' . $j->chemin_fichier;
                }

                return [
                    'id'               => $j->id,
                    'id_facture'       => $j->id_facture,
                    'mode_paiement'    => $j->mode_paiement,
                    'date_justificatif'=> $j->date_justificatif?->format('Y-m-d'),
                    'chemin_fichier'   => $j->chemin_fichier ? Storage::url($j->chemin_fichier) : null,, // Ceci est l'URL que le frontend utilisera
                    'created_at'       => $j->created_at->toDateTimeString(),
                    'updated_at'       => $j->updated_at->toDateTimeString(),
                    'taille_fichier'   => $j->taille_fichier,
                ];
            });

        return response()->json(['data' => $justificatifs], 200);
    }

    // Supprimez ou modifiez la route 'accountant.justificatifs.show'
    // si elle ne sert qu'à générer des URLs incorrectes.
    // Si vous avez une route qui DOIT servir le fichier (ex: avec authentification),
    // alors assurez-vous qu'elle utilise Storage::download ou un équivalent.
    // Mais pour la simple ouverture dans le navigateur, une URL directe est préférable.

 

}