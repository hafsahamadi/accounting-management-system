<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB; // Important pour les requêtes brutes

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('entreprises', function (Blueprint $table) {
            // Option 1: Si vous êtes sûr que les valeurs existantes sont correctes
            // ou si vous avez un plan pour les remettre après.
            // On doit supprimer l'ancienne colonne si elle existe et a un type incompatible.
            if (Schema::hasColumn('entreprises', 'statut')) {
                $table->dropColumn('statut');
            }
        });

        // Recréer la colonne statut en tant qu'ENUM (Syntaxe MySQL)
        // Placez-la où vous le souhaitez (par exemple, after 'id_comptable')
        // Le default 'en_attente' est important pour les nouvelles entrées.
        DB::statement("ALTER TABLE entreprises ADD statut ENUM('en_attente', 'validee', 'rejetee') NOT NULL DEFAULT 'en_attente' AFTER `id_comptable`");
        // Adaptez `AFTER id_comptable` à la position souhaitée de la colonne.
        // Si vous n'utilisez pas `AFTER`, elle sera ajoutée à la fin.
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('entreprises', function (Blueprint $table) {
            // Pour annuler, on supprime la colonne ENUM
            // et on la recrée potentiellement comme string si c'était son état précédent.
            if (Schema::hasColumn('entreprises', 'statut')) {
                $table->dropColumn('statut');
            }
        });
        // Optionnel: Recréer comme string si vous voulez une annulation complète
        // Schema::table('entreprises', function (Blueprint $table) {
        //     $table->string('statut')->default('en_attente')->after('id_comptable');
        // });
    }
};