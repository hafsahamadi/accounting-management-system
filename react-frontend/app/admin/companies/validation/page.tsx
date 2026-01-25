"use client"

import { useEffect, useState, useCallback } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import RequireAuth from "@/components/RequireAuth"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, CheckCircle, XCircle, Eye, Loader2, AlertTriangle, Building2, Clock } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const API_BASE = process.env.REACT_APP_API_URL || "http://192.168.1.14:8000/api"

interface Company {
  id: number
  nom_entreprise: string
  ICE: string
  RC?: string
  IF?: string
  comptable?: { nom: string; prenom: string; email: string }
  accountantName?: string
  created_at?: string
  requestDate?: string
  adresse?: string
  email_contact?: string
  telephone?: string
  name?: string
  siret?: string
  accountant?: string
}

export default function CompanyValidationPage() {
  const [pendingCompanies, setPendingCompanies] = useState<Company[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [selectedCompanyForRejection, setSelectedCompanyForRejection] = useState<Company | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const checkApiBaseUrl = () => {
    if (!API_BASE || !API_BASE.startsWith("http")) {
      console.error(
        "Erreur critique : REACT_APP_API_URL n'est pas défini correctement. Vérifiez .env et next.config.js.",
      )
      setError("Erreur de configuration du serveur.")
      setLoading(false)
      return false
    }
    return true
  }

  const fetchPendingCompanies = useCallback(async () => {
    if (!checkApiBaseUrl()) return
    setLoading(true)
    setError(null)
    const token = sessionStorage.getItem("token")
    if (!token) {
      setError("Authentification requise.")
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`${API_BASE}/pending-companies`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: `Erreur HTTP ${res.status}` }))
        throw new Error(errorData.message || `Erreur ${res.status} lors du chargement des entreprises en attente.`)
      }
      const data = await res.json()
      const mappedData = (Array.isArray(data) ? data : data.companies || data.pending_companies || []).map(
        (item: any): Company => ({
          id: item.id,
          nom_entreprise: item.nom_entreprise || item.name || "N/A",
          ICE: item.ICE || item.siret || "N/A",
          RC: item.RC,
          IF: item.IF,
          comptable: item.comptable,
          accountantName: item.comptable
            ? `${item.comptable.prenom || ""} ${item.comptable.nom || ""}`.trim()
            : item.accountant || "N/A",
          created_at: item.created_at,
          requestDate: item.created_at ? new Date(item.created_at).toLocaleDateString("fr-FR") : "N/A",
          adresse: item.adresse,
          email_contact: item.email,
          telephone: item.telephone,
        }),
      )
      setPendingCompanies(mappedData)
    } catch (error: any) {
      console.error("Erreur lors du chargement des entreprises:", error)
      setError(error.message || "Une erreur inconnue est survenue.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPendingCompanies()
  }, [fetchPendingCompanies])

  const filteredCompanies = pendingCompanies.filter(
    (company) =>
      (company.nom_entreprise || company.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company.accountantName || company.accountant || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company.ICE || company.siret || "").toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleValidate = async (id: number) => {
    if (!checkApiBaseUrl()) return
    if (!window.confirm("Êtes-vous sûr de vouloir VALIDER cette entreprise ?")) return
    setIsProcessing(true)
    setError(null)
    const token = sessionStorage.getItem("token")
    if (!token) {
      alert("Authentification requise.")
      setIsProcessing(false)
      return
    }
    try {
      const res = await fetch(`${API_BASE}/entreprises/${id}/valider`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      })
      const responseData = await res.json()

      if (!res.ok) {
        console.error("Échec de la validation:", responseData.message || res.statusText)
        throw new Error(responseData.message || "Échec de la validation")
      }

      alert(responseData.message || "Entreprise validée avec succès !")
      fetchPendingCompanies()
    } catch (error: any) {
      console.error("Erreur lors de la validation:", error)
      alert(`Erreur: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const openRejectDialog = (company: Company) => {
    setSelectedCompanyForRejection(company)
    setRejectionReason("")
    setIsRejectDialogOpen(true)
  }

  const confirmRejection = async () => {
    if (!selectedCompanyForRejection || !rejectionReason.trim()) {
      alert("Veuillez sélectionner une entreprise et fournir une raison de rejet valide.")
      return
    }
    if (!checkApiBaseUrl()) return
    setIsProcessing(true)
    setError(null)
    const token = sessionStorage.getItem("token")
    if (!token) {
      alert("Authentification requise.")
      setIsProcessing(false)
      return
    }
    try {
      const res = await fetch(`${API_BASE}/entreprises/${selectedCompanyForRejection.id}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ reason: rejectionReason }),
      })
      const responseData = await res.json()

      if (!res.ok) {
        console.error("Échec du rejet:", responseData.message || res.statusText)
        throw new Error(responseData.message || "Échec du rejet")
      }

      alert(responseData.message || "Entreprise rejetée avec succès !")
      fetchPendingCompanies()
      setIsRejectDialogOpen(false)
      setSelectedCompanyForRejection(null)
      setRejectionReason("")
    } catch (error: any) {
      console.error("Erreur lors du rejet:", error)
      alert(`Erreur: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const viewDetails = (company: Company) => {
    setSelectedCompany(company)
    setIsDetailsOpen(true)
  }

  if (loading) {
    return (
      <RequireAuth>
        <DashboardLayout role="admin">
          <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
            <div className="flex justify-center items-center h-[calc(100vh-150px)]">
              <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-blue-200/20 p-8">
                <CardContent className="flex items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-gray-600 font-medium">Chargement des entreprises en attente...</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </DashboardLayout>
      </RequireAuth>
    )
  }

  if (error && pendingCompanies.length === 0) {
    return (
      <RequireAuth>
        <DashboardLayout role="admin">
          <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] p-6">
              <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-red-200/20 max-w-md">
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="h-16 w-16 mb-4 text-red-400 mx-auto" />
                  <h3 className="text-xl font-semibold mb-2 text-red-600">Erreur de chargement</h3>
                  <p className="mb-6 text-red-500">{error}</p>
                  <Button
                    onClick={fetchPendingCompanies}
                    className="bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white"
                  >
                    Réessayer
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </DashboardLayout>
      </RequireAuth>
    )
  }

  return (
    <RequireAuth>
      <DashboardLayout role="admin">
        <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
          {/* Background decorative elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-indigo-300/30 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-200/30 to-pink-200/30 rounded-full blur-3xl"></div>
          </div>

          <div className="relative space-y-8 p-6">
            {/* Header Section */}
            <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-blue-200/20">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-xl p-3 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Validation des Entreprises
                    </CardTitle>
                    <CardDescription className="text-gray-600 mt-1">
                      Validez ou rejetez les nouvelles entreprises en attente
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Search Section */}
            <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-blue-200/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg p-2 bg-gradient-to-r from-blue-100 to-indigo-100">
                    <Search className="h-4 w-4 text-blue-600" />
                  </div>
                  <Input
                    placeholder="Rechercher par nom, ICE, ou comptable..."
                    className="max-w-sm h-11 border-gray-200 focus:border-blue-400 rounded-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      {filteredCompanies.length} résultat{filteredCompanies.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
              <Card className="backdrop-blur-md bg-red-50/90 border-0 shadow-xl shadow-red-200/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <p className="text-red-700 font-medium">{error}</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        setError(null)
                        fetchPendingCompanies()
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      Réessayer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Content */}
            <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-blue-200/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg p-2 bg-gradient-to-r from-yellow-100 to-orange-100">
                    <Clock className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-800">
                      Entreprises en attente de validation
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      {filteredCompanies.length} entreprise{filteredCompanies.length > 1 ? "s" : ""} en attente
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 hover:from-blue-50/70 hover:to-indigo-50/70">
                        <TableHead className="font-semibold text-gray-700">Nom Entreprise</TableHead>
                        <TableHead className="hidden sm:table-cell font-semibold text-gray-700">ICE</TableHead>
                        <TableHead className="hidden md:table-cell font-semibold text-gray-700">Comptable</TableHead>
                        <TableHead className="hidden lg:table-cell font-semibold text-gray-700">Date Demande</TableHead>
                        <TableHead className="font-semibold text-gray-700">Statut</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCompanies.map((company) => (
                        <TableRow
                          key={company.id}
                          className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/30 transition-all duration-200"
                        >
                          <TableCell className="font-medium text-gray-900">
                            {company.nom_entreprise || company.name}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-gray-700">
                            {company.ICE || company.siret}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-gray-700">
                            {company.accountantName || company.accountant}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell whitespace-nowrap text-gray-600">
                            {company.requestDate}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-sm">
                              <Clock className="w-3 h-3 mr-1" />
                              En attente
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => viewDetails(company)}
                                title="Voir détails"
                                disabled={isProcessing}
                                className="h-8 w-8 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                className="h-8 w-8 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg"
                                onClick={() => handleValidate(company.id)}
                                disabled={isProcessing}
                                title="Valider l'entreprise"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                className="h-8 w-8 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
                                onClick={() => openRejectDialog(company)}
                                disabled={isProcessing}
                                title="Rejeter l'entreprise"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredCompanies.length === 0 && !loading && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10">
                            <div className="flex flex-col items-center gap-3">
                              <Building2 className="h-12 w-12 text-gray-300" />
                              <p className="text-gray-500 font-medium">
                                {searchTerm
                                  ? "Aucune entreprise en attente ne correspond à votre recherche."
                                  : "Aucune entreprise en attente de validation."}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
              <DialogContent className="backdrop-blur-md bg-white/95 border-0 shadow-2xl sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold text-gray-800">
                    Détails de l'entreprise en attente
                  </DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Informations soumises pour validation.
                  </DialogDescription>
                </DialogHeader>
                {selectedCompany && (
                  <div className="grid gap-3 py-4 text-sm [&>p]:grid [&>p]:grid-cols-3 [&>p]:items-start [&>p]:gap-4">
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Nom Entreprise :</strong>
                      <span className="col-span-2 text-gray-900">
                        {selectedCompany.nom_entreprise || selectedCompany.name}
                      </span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">ICE :</strong>
                      <span className="col-span-2 text-gray-700">{selectedCompany.ICE || selectedCompany.siret}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">RC :</strong>
                      <span className="col-span-2 text-gray-700">{selectedCompany.RC || "N/A"}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">IF :</strong>
                      <span className="col-span-2 text-gray-700">{selectedCompany.IF || "N/A"}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Adresse :</strong>
                      <span className="col-span-2 text-gray-700">{selectedCompany.adresse || "N/A"}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Email Contact :</strong>
                      <span className="col-span-2 text-gray-700">{selectedCompany.email_contact || "N/A"}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Téléphone :</strong>
                      <span className="col-span-2 text-gray-700">{selectedCompany.telephone || "N/A"}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Comptable :</strong>
                      <span className="col-span-2 text-gray-700">
                        {selectedCompany.accountantName || selectedCompany.accountant}
                      </span>
                    </p>
                    {selectedCompany.comptable && (
                      <p>
                        <strong className="text-right font-semibold text-gray-700">Email Comptable :</strong>
                        <span className="col-span-2 text-gray-700">{selectedCompany.comptable.email || "N/A"}</span>
                      </p>
                    )}
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Date de demande :</strong>
                      <span className="col-span-2 text-gray-700">{selectedCompany.requestDate}</span>
                    </p>
                  </div>
                )}
                <DialogFooter className="sm:justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsDetailsOpen(false)}
                    disabled={isProcessing}
                    className="border-gray-200 hover:bg-gray-50"
                  >
                    Fermer
                  </Button>
                  {selectedCompany && (
                    <div className="flex gap-2">
                      <Button
                        className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                        onClick={() => {
                          openRejectDialog(selectedCompany)
                          setIsDetailsOpen(false)
                        }}
                        disabled={isProcessing}
                      >
                        Rejeter
                      </Button>
                      <Button
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                        onClick={() => {
                          handleValidate(selectedCompany.id)
                          setIsDetailsOpen(false)
                        }}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Valider
                      </Button>
                    </div>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Rejection Dialog */}
            <Dialog
              open={isRejectDialogOpen}
              onOpenChange={(isOpen) => {
                setIsRejectDialogOpen(isOpen)
                if (!isOpen) {
                  setSelectedCompanyForRejection(null)
                  setRejectionReason("")
                }
              }}
            >
              <DialogContent className="backdrop-blur-md bg-white/95 border-0 shadow-2xl sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold text-gray-800">Rejeter l'entreprise</DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Veuillez spécifier la raison du rejet pour "
                    {selectedCompanyForRejection?.nom_entreprise || selectedCompanyForRejection?.name}".
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    confirmRejection()
                  }}
                  className="grid gap-4 py-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="rejectionReason" className="font-semibold text-gray-700">
                      Raison du rejet (obligatoire)
                    </Label>
                    <Textarea
                      id="rejectionReason"
                      placeholder="Expliquez pourquoi cette entreprise est rejetée..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="min-h-[100px] border-gray-200 focus:border-red-400 rounded-lg"
                    />
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsRejectDialogOpen(false)}
                      disabled={isProcessing}
                      className="border-gray-200 hover:bg-gray-50"
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                      disabled={isProcessing || !rejectionReason.trim()}
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Confirmer le rejet
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  )
}
