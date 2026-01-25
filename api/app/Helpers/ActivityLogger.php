<?php

namespace App\Helpers;

use App\Models\Activity;
use Illuminate\Support\Facades\Auth;

class ActivityLogger
{
public static function log(string $action, $user = null)
{
    $user = $user ?? Auth::user();

    Activity::create([
        'action' => $action,
        'nom' => $user?->nom ?? 'Inconnu',
        'prenom' => $user?->prenom ?? 'Inconnu',
    ]);
}
}

