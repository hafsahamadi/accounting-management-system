<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;
use Illuminate\Support\Facades\Storage; 

class Abonnement extends Model
{
      use HasFactory;

    protected $fillable = [
        'id_entreprise',
        'plan_id',         // clé étrangère vers plans
        'date_debut',
        'date_fin',
        'montant',
        'statut',
        'etat_validation',
        'type',
        'justificatif_path',
    ];

    protected $casts = [
        'date_debut' => 'date:Y-m-d',
        'date_fin' => 'date:Y-m-d',
        'montant' => 'decimal:2',
        'statut' => 'string',
        'etat_validation' => 'string',
        'type' => 'string',
        'justificatif_path' => 'string',
    ];
 protected $appends = ['justificatif_url'];
    // Relation vers entreprise
    public function entreprise()
    {
        return $this->belongsTo(Entreprise::class, 'id_entreprise');
    }

    // Relation vers plan
    public function plan()
    {
        return $this->belongsTo(Plan::class, 'plan_id');
    }

    // Accesseurs de date (optionnel car déjà casté, mais pour forcer format)
    public function getDateDebutAttribute($value)
    {
        return $value ? Carbon::parse($value)->format('Y-m-d') : null;
    }

    public function getDateFinAttribute($value)
    {
        return $value ? Carbon::parse($value)->format('Y-m-d') : null;
    }
    
public function getJustificatifUrlAttribute()
{
    if ($this->justificatif_path) {
        // This will now use the APP_URL set in your .env
        return Storage::url($this->justificatif_path);
    }
    return null;
}
}
