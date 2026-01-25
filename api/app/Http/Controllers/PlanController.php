<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    public function index()
    {
        $plans = Plan::orderBy('prix')->get([
            'id',
            'nom',
            'espace_max',
            'prix',
            'created_at',
            'updated_at'
        ]);

        return response()->json($plans);
    }
}
