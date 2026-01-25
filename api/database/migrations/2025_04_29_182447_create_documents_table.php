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
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_entreprise')->constrained('entreprises')->onDelete('cascade');
            $table->enum('type', ['facture_achat', 'facture_vente', 'bon_livraison']);
            $table->decimal('montant', 10, 2)->nullable();
            $table->date('date_document')->nullable();
            $table->string('nom_fichier');
            $table->string('chemin_fichier');
            $table->enum('statut', [ 'en_cours', 'traite', 'a_revoir'])->default('en_cours');
            $table->timestamp('uploaded_at')->useCurrent();
            $table->timestamps(); // created_at & updated_at
        });
        
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
