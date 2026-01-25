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
         Schema::table('entreprises', function (Blueprint $table) {
            $table->dropColumn('valide');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::table('entreprises', function (Blueprint $table) {
            // Si vous voulez pouvoir annuler la migration, vous devez recréer la colonne.
            // Pensez à la valeur par défaut que vous aviez ou à la logique de peuplement.
            $table->boolean('valide')->default(false)->after('statut'); // Ou l'emplacement d'origine
        });
    }
};
