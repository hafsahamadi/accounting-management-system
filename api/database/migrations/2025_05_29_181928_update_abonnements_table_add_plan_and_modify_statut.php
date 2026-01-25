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
        Schema::table('abonnements', function (Blueprint $table) {
            // Ajouter la nouvelle colonne 'plan'
            // Il est bon de spécifier où l'ajouter avec ->after() pour l'ordre des colonnes
            $table->enum('plan', ['premium', 'basic', 'standard'])
                  ->default('basic')
                  ->after('id_entreprise'); // ou après une autre colonne pertinente

            // Modifier la colonne 'statut' existante pour ajouter la nouvelle valeur
            // Important: utiliser ->change() pour modifier une colonne existante
            $table->enum('statut', ['actif', 'expiré', 'expire bientot'])
                  ->default('expiré')
                  ->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('abonnements', function (Blueprint $table) {
            // Important: L'ordre ici est inversé par rapport à up()
            // et on remet la colonne 'statut' à son état précédent

            // Remettre 'statut' à son état d'origine avant la modification
            $table->enum('statut', ['actif', 'expiré']) // L'ancienne liste de valeurs
                  ->default('expiré')
                  ->change();

            // Supprimer la colonne 'plan'
            $table->dropColumn('plan');
        });
    }
};