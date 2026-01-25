<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB; 

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // ÉTAPE 1 : Mettre à jour les données existantes.
        // On transforme tous les statuts 'aucun' en 'expiré' AVANT de modifier la colonne.
        // Utiliser DB::table est plus sûr dans les migrations que d'utiliser un modèle Eloquent.
        DB::table('abonnements')
            ->where('statut', 'aucun')
            ->update(['statut' => 'expiré']);

        // ÉTAPE 2 : Maintenant que plus aucune ligne n'utilise 'aucun', on peut modifier la colonne.
        Schema::table('abonnements', function (Blueprint $table) {
            $table->enum('statut', ['actif', 'expiré'])->default('actif')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Pour annuler, on fait l'inverse :
        // ÉTAPE 1 : On remet la colonne dans son état précédent pour qu'elle puisse accepter 'aucun'.
        Schema::table('abonnements', function (Blueprint $table) {
            $table->enum('statut', ['actif', 'expiré', 'aucun'])->default('actif')->change();
        });

        // NOTE : Il n'est pas possible de savoir quelles lignes étaient 'aucun' auparavant,
        // donc on ne fait pas de mise à jour de données dans la méthode down().
        // Le simple fait de restaurer la structure de la colonne est suffisant.
    }
};
