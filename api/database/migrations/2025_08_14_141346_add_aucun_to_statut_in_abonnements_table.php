<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // On indique à Laravel qu'on veut modifier la table 'abonnements'
        Schema::table('abonnements', function (Blueprint $table) {
            // On redéfinit la colonne 'statut' avec la nouvelle liste de valeurs
            // et on utilise ->change() pour appliquer la modification.
            $table->enum('statut', ['actif', 'expiré', 'aucun'])->default('actif')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Cette partie sert si on veut annuler la migration.
        // On remet la colonne comme elle était avant.
        Schema::table('abonnements', function (Blueprint $table) {
            $table->enum('statut', ['actif', 'expiré'])->default('expiré')->change();
        });
    }
};