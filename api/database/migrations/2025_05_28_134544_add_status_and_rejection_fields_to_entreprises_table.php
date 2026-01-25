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
    $table->string('statut')->default('en_attente')->after('id'); // ex: 'en_attente', 'validee', 'rejetee'
    $table->text('raison_rejet')->nullable()->after('statut');
  
});
    }

    /**
     * Reverse the migrations.
     */
      public function down()
    {
        Schema::table('entreprises', function (Blueprint $table) {
            $table->dropColumn('statut');
            $table->dropColumn('raison_rejet');
        });
    }
};
