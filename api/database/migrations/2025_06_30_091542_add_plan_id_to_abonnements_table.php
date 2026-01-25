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
       // $table->foreignId('plan_id')->after('id_entreprise')->constrained('plans')->onDelete('cascade');
    });
}

public function down(): void
{
    Schema::table('abonnements', function (Blueprint $table) {
        $table->dropForeign(['plan_id']);
        $table->dropColumn('plan_id');
    });
}

};
