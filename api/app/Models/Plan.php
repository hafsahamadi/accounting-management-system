<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    use HasFactory;

    protected $fillable = ['nom', 'espace_max', 'prix'];

    // Relation avec abonnements (facultatif mais utile)
    public function abonnements()
    {
        return $this->hasMany(Abonnement::class, 'plan_id');
    }
}
