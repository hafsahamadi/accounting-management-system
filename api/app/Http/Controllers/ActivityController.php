<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Activity;
class ActivityController extends Controller
{
public function recent(){

    $activities = Activity::latest()
        ->take(10)
        ->get(['action', 'nom', 'prenom', 'created_at']);

    return response()->json($activities);
}
 
}
