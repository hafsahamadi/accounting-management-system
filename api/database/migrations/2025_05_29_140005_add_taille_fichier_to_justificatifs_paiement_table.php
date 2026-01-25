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
        Schema::table('justificatifs_paiement', function (Blueprint $table) {
            // Ajoute la colonne pour stocker la taille du fichier en octets
            // 'after' est optionnel, c'est pour l'organisation de la table
            $table->unsignedBigInteger('taille_fichier')->nullable()->after('chemin_fichier');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('justificatifs_paiement', function (Blueprint $table) {
            $table->dropColumn('taille_fichier');
        });
    }
};