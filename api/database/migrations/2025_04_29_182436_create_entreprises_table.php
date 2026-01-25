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
       
        Schema::create('entreprises', function (Blueprint $table) {
            $table->id();
            $table->string('nom_entreprise', 100)->nullable();
            $table->string('nom', 100)->nullable();
            $table->string('prenom', 100)->nullable();
            $table->string('email', 100)->nullable();
            $table->string('adresse', 100)->nullable();
            $table->string('telephone', 100)->nullable();
            $table->string('RC', 100)->nullable();
            $table->string('ICE', 100)->nullable();
            $table->string('IF', 100)->nullable();
            $table->string('nom_utilisateur', 50)->unique();
            $table->string('mot_de_passe');
           
            $table->foreignId('id_comptable')->constrained('users')->onDelete('cascade');
            $table->boolean('valide')->default(false);
            $table->timestamps();
        });
        
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('entreprises');
    }
};
