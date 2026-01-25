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
        Schema::create('justificatifs_paiement', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_facture')->constrained('documents')->onDelete('cascade');
            $table->enum('mode_paiement', ['cheque', 'virement', 'espece', 'autre']);
            $table->date('date_justificatif')->nullable();
            $table->string('chemin_fichier');
            $table->timestamps(); // created_at & updated_at
        });
        
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('justificatifs_paiement');
    }
};
