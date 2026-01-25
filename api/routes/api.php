<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EntrepriseController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\AbonnementController;
use App\Http\Controllers\JustificatifPaiementController;
use App\Http\Controllers\ActivityController;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;


Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/login', [AuthController::class, 'login']);
Route::post('/entreprise/login', [AuthController::class, 'loginEntreprise']);

Route::middleware('auth:sanctum')->get('/stats', [AuthController::class, 'stats']);
Route::middleware('auth:sanctum')->post('/logout', [AuthController::class, 'logout']);
Route::middleware('auth:sanctum')->get('/accountants', [AuthController::class, 'index']);
Route::middleware('auth:sanctum')->get('/profile', [AuthController::class,'profile']);
Route::get('/entreprises/count', [EntrepriseController::class, 'countALLEntreprises']);
Route::middleware('auth:sanctum')->delete('/accountants/{id}', [AuthController::class, 'destroy']);
Route::middleware('auth:sanctum')->put('/accountants/{id}', [AuthController::class, 'update']);



Route::post  ('/abonnements',             [AbonnementController::class, 'store']);
Route::post  ('/abonnements/demande', [AbonnementController::class, 'storedemande']);
Route::get   ('/abonnements/{abonnement}',[AbonnementController::class, 'show']);
Route::put   ('/abonnements/{abonnement}',[AbonnementController::class, 'update']);
// routes/api.php



// Endpoint pour récupérer le cookie CSRF
Route::get('/sanctum/csrf-cookie', function () {
    return response()->json(['status' => 'CSRF cookie set']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/profile-web', [AuthController::class, 'getProfile']);
    Route::put('/profile/update', [AuthController::class, 'updateProfile']);

    Route::get('/admin/notifications', [AuthController::class, 'getNotifications']);
    Route::put('/admin/notifications', [AuthController::class, 'updateNotifications']);
    Route::get('/profile/subscription', [AuthController::class, 'getSubscriptionInfo']); 
    Route::get('/entreprises/count', [EntrepriseController::class, 'countALLEntreprises']);
    Route::get('/entreprises/countE', [EntrepriseController::class, 'countEntreprises']);
    Route::get('/documents/counte', [DocumentController::class, 'countDocuments']);
    
Route::get('/documents/traites', [DocumentController::class, 'getDocumentsTraites']);
Route::get('/documents/en-attente', [DocumentController::class, 'getDocumentsEnAttente']);
Route::get   ('/abonnements', [AbonnementController::class, 'index']);
Route::get   ('/abonnementss', [AbonnementController::class, 'indexadmin']);
Route::get('/plans', [App\Http\Controllers\PlanController::class, 'index']);

});



Route::middleware('auth:sanctum')->group(function () {
    Route::get('/documents/public', [DocumentController::class, 'indexPublic']);
Route::get('/pending-companies', [EntrepriseController::class, 'pending']);
Route::post('/companies/{id}/reject', [EntrepriseController::class, 'rejectCompany']);


Route::get('/documents/traites', [DocumentController::class, 'getDocumentsTraites']);
Route::get('/documents/en-attente', [DocumentController::class, 'getDocumentsEnAttente']);
Route::get('/documents/count', [DocumentController::class, 'countALLDocuments']);

});

Route::get('/pending-companies', [EntrepriseController::class, 'pending']);

Route::get('/entreprises/details', [EntrepriseController::class, 'indexWithComptablesAndDocuments']);


Route::get('/entreprises/demandes-suppression', [EntrepriseController::class, 'demandesSuppressionEnAttente']);





Route::middleware('auth:sanctum')->group(function () {
    // Stocker un nouveau justificatif
    Route::post('/justificatifs', [JustificatifPaiementController::class, 'store']);

    // Récupérer les justificatifs d’une facture
    Route::get('/justificatifs/facture/{factureId}', [JustificatifPaiementController::class, 'getByFacture']); // Celle-ci est commentée
});


Route::put('/entreprises/{id}/valider', [EntrepriseController::class, 'valider']);
Route::post('/entreprises/{id}/reject', [EntrepriseController::class, 'rejectCompany']);
Route::middleware('auth:sanctum')->get('/activities/recent', [ActivityController::class, 'recent']);
Route::middleware('auth:sanctum')->put('/documents/{id}/status', [DocumentController::class, 'updateStatus']);


Route::middleware('auth:sanctum')->group(function () {
    Route::get('/documents/all-recent', [DocumentController::class, 'getAllRecentDocuments']);
    Route::post('/accountants', [AuthController::class, 'store']);
    Route::get('/entreprises', [EntrepriseController::class, 'index']);
    Route::post('/entreprises', [EntrepriseController::class, 'store']);
    
    Route::post('/entreprises/{id}/demande-suppression', [EntrepriseController::class, 'demandeSuppression']);
    Route::get('/entreprises/formatted', [EntrepriseController::class, 'getFormattedCompanies']);
    Route::get('/entreprises/list', [EntrepriseController::class, 'list']);
    Route::delete('/entreprises/{company}', [EntrepriseController::class, 'destroy']);
    // Rejeter la demande de suppression (reset demande_suppression)
    Route::delete('/entreprises/demandes-suppression/{company}', [EntrepriseController::class, 'rejectRequest']);

  


    //mobile
    Route::get('/documents', [DocumentController::class, 'index']);
    Route::post('/documents', [DocumentController::class, 'store']);
    Route::get('/documents/status-counts', [DocumentController::class, 'getStatusCounts']);
    Route::get('/documents/recent-documents', [DocumentController::class, 'getRecentDocuments']);
    Route::get('/documents/activity-summary', [DocumentController::class, 'getActivitySummary']);
    Route::patch('/documents/{document}/rename', [DocumentController::class, 'rename']);
    Route::get('/documents/{document}/download', [DocumentController::class, 'download']);
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);
    Route::put('/profile/updatee', [EntrepriseController::class, 'updateMyProfile']); 
    Route::post('/profile/change-password', [EntrepriseController::class, 'changeMyPassword']);

});








Route::middleware('auth:sanctum')->group(function () {
 

    // 2. Détail d’une entreprise (seulement numérique)
    Route::get('/entreprises/{id}', [EntrepriseController::class, 'showEntreprise'])
         ->whereNumber('id');

    // 3. Mise à jour
    Route::put('/entreprises/{id}', [EntrepriseController::class, 'updateEntreprise'])
         ->whereNumber('id');
});


Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/entreprises/listE', [EntrepriseController::class, 'listForSelect']);

    
});

  

Route::get('/test', function () {
    return response()->json(['message' => 'API Laravel OK']);
});