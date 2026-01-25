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
        $table->dropColumn('plan');
    });
}

public function down(): void
{
    Schema::table('abonnements', function (Blueprint $table) {
        $table->enum('plan', ['premium', 'basic', 'standard'])->default('basic');
    });
}

};
