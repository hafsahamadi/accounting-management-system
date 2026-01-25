<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Enums\EntrepriseStatut;
class Entreprise extends Model
{

    use HasApiTokens, HasFactory;
   
    protected $fillable = [
        'nom_entreprise',
        'nom',
        'prenom',
        'email',
        'adresse',
        'telephone',
        'RC',
        'ICE',
        'IF',
        'nom_utilisateur',
        'mot_de_passe',
        'id_comptable',
        'statut', // Maintenant un ENUM
        'raison_rejet',
    ];

    protected $casts = [
    'statut' => EntrepriseStatut::class,
];

    public function comptable()
    {
        return $this->belongsTo(User::class, 'id_comptable');
    }

    public function documents()
    {
        return $this->hasMany(Document::class, 'id_entreprise');
    }

public function abonnements()
    {
        return $this->hasMany(Abonnement::class, 'id_entreprise');
    }
public function dernierAbonnement()
 {
    return $this->hasOne(Abonnement::class, 'id_entreprise')->latestOfMany(); 
 }
}
