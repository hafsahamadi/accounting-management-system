<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('abonnements', function (Blueprint $table) {
            $table->enum('etat_validation', ['en_attente', 'valide', 'refuse'])
                  ->default('en_attente')
                  ->after('statut');
            
            $table->string('justificatif_path')->nullable()->after('etat_validation');
            
            $table->enum('type', ['initial', 'renouvellement', 'upgrade'])
                  ->default('initial')
                  ->after('justificatif_path');
        });
    }

    public function down(): void
    {
        Schema::table('abonnements', function (Blueprint $table) {
            $table->dropColumn('etat_validation');
            $table->dropColumn('justificatif_path');
            $table->dropColumn('type');
        });
    }
};
