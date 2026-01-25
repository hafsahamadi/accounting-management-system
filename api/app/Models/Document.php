<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory; // Ajoutez si vous utilisez des factories
use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    use HasFactory; // Ajoutez si vous utilisez des factories

    protected $fillable = [
        'id_entreprise',
        'type',
        'montant',
        'date_document',
        'nom_fichier',
        'chemin_fichier',
        'statut',
        'taille_fichier',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array
     */
    protected $casts = [
        'id_entreprise' => 'integer',
        'montant' => 'decimal:2', // ou 'float'
        'date_document' => 'date', // ou 'datetime' selon ce que vous stockez
        'created_at' => 'datetime', // Indispensable pour le formatage
        'updated_at' => 'datetime', // Indispensable pour le formatage
        'uploaded_at' => 'datetime', // Si vous avez ce champ et l'utilisez (il était dans votre sélection de contrôleur)
    ];

    public function entreprise()
    {
        return $this->belongsTo(Entreprise::class, 'id_entreprise');
    }

    public function justificatifs()
    {
        return $this->hasMany(JustificatifPaiement::class, 'id_facture');
    }

    // Pour l'ajouter automatiquement à la sérialisation JSON du modèle
    protected $appends = ['taille_fichier_mo'];

    /**
     * Calcule et retourne la taille du fichier en Mégaoctets.
     *
     * @return float|null
     */
    public function getTailleFichierMoAttribute()
    {
        if ($this->taille_fichier) {
            // 1 Mo = 1024 Ko = 1024 * 1024 Octets
            return round($this->taille_fichier / (1024 * 1024), 2); // Arrondi à 2 décimales
        }
        return null;
    }


     public function getTailleTotaleDocumentAttribute()
    {
        $taillePrincipale = $this->taille_fichier ?? 0;
        // On charge la somme des tailles des justificatifs pour CE document
        // C'est moins performant que withSum direct, mais nécessaire pour l'accesseur
        // Si vous avez BEAUCOUP de justificatifs par document, envisagez une colonne dénormalisée sur 'documents'
        $tailleJustificatifs = $this->justificatifs()->sum('taille_fichier');
        return $taillePrincipale + ($tailleJustificatifs ?? 0);
    }

}