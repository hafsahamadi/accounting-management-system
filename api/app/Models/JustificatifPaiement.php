<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JustificatifPaiement extends Model
{
    // On précise ici le nom réel de la table
    protected $table = 'justificatifs_paiement';

    protected $fillable = ['id_facture', 'mode_paiement', 'date_justificatif', 'chemin_fichier','taille_fichier',];

    public function facture()
    {
        return $this->belongsTo(Document::class, 'id_facture');
    }

    public function entreprise()
{
    return $this->facture->entreprise();
}

}
