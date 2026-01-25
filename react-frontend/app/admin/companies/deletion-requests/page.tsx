"use client"

import { useEffect, useState, useCallback } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import RequireAuth from "@/components/RequireAuth"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, CheckCircle, XCircle, Eye, Loader2, AlertTriangle, Trash2, Calendar } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

const API_BASE = process.env.REACT_APP_API_URL || "http://192.168.1.14:8000/api"

interface DeletionRequest {
  id: number
  companyName: string
  ICE: string
  accountant: string
  requestDate: string
  reason: string
  documents?: number
  address?: string
  contact?: string
  phone?: string
  nom_entreprise?: string
  nom_comptable?: string
  date_demande_suppression?: string
  raison_suppression?: string
  nb_documents?: number
}

export default function DeletionRequestsPage() {
  const [reqs, setReqs] = useState<DeletionRequest[]>([])
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<DeletionRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const checkApiBaseUrl = () => {
    if (!API_BASE || !API_BASE.startsWith("http")) {
      console.error(
        "Erreur critique : REACT_APP_API_URL n'est pas défini correctement ou n'est pas une URL valide. Vérifiez votre .env et next.config.js.",
      )
      setError("Erreur de configuration du serveur.")
      setLoading(false)
      return false
    }
    return true
  }

  const fetchDeletionRequests = useCallback(async () => {
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
      const res = await fetch(`${API_BASE}/entreprises/demandes-suppression`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: `Erreur HTTP ${res.status}` }))
        throw new Error(errorData.message || `Erreur ${res.status} lors du chargement des demandes.`)
      }
      const data = await res.json()
      const mappedData = (data.demandes_suppression || data || []).map(
        (item: any): DeletionRequest => ({
          id: item.id,
          companyName: item.nom_entreprise || item.companyName || "N/A",
          ICE: item.ICE || "N/A",
          accountant: item.comptable?.nom
            ? `${item.comptable.prenom || ""} ${item.comptable.nom}`
            : item.accountant || "N/A",
          requestDate: item.date_demande_suppression
            ? new Date(item.date_demande_suppression).toLocaleDateString("fr-FR")
            : item.requestDate || "N/A",
          reason: item.raison_suppression || item.reason || "Aucune raison",
          documents: item.documents_count ?? item.nb_documents ?? item.documents ?? 0,
          address: item.adresse || item.address || "N/A",
          contact: item.email_contact || item.contact || "N/A",
          phone: item.telephone || item.phone || "N/A",
        }),
      )
      setReqs(mappedData)
    } catch (e: any) {
      console.error("Erreur chargement demandes:", e)
      setError(e.message || "Une erreur est survenue.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeletionRequests()
  }, [fetchDeletionRequests])

  const filtered = reqs.filter((r) => {
    const t = search.toLowerCase()
    return (
      r.companyName.toLowerCase().includes(t) ||
      r.accountant.toLowerCase().includes(t) ||
      (r.ICE && r.ICE.toLowerCase().includes(t))
    )
  })

  const handleApprove = async (request: DeletionRequest) => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir APPROUVER la suppression et donc SUPPRIMER définitivement l'entreprise "${request.companyName}" ? Cette action est irréversible.`,
      )
    )
      return
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
      const res = await fetch(`${API_BASE}/entreprises/${request.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `Erreur HTTP ${res.status}` }))
        throw new Error(err.message || "Erreur lors de la suppression de l'entreprise.")
      }
      alert("Entreprise supprimée avec succès ✔")
      fetchDeletionRequests()
    } catch (e: any) {
      console.error("Erreur handleApprove:", e)
      alert(e.message || "Une erreur est survenue lors de l'approbation.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async (request: DeletionRequest) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir REJETER la demande de suppression pour "${request.companyName}" ?`))
      return
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
      const res = await fetch(`${API_BASE}/entreprises/demandes-suppression/${request.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `Erreur HTTP ${res.status}` }))
        throw new Error(err.message || "Erreur lors du rejet de la demande.")
      }
      alert("Demande de suppression rejetée avec succès ✔")
      fetchDeletionRequests()
    } catch (e: any) {
      console.error("Erreur handleReject:", e)
      alert(e.message || "Une erreur est survenue lors du rejet.")
    } finally {
      setIsProcessing(false)
    }
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
                  <p className="text-gray-600 font-medium">Chargement des demandes de suppression...</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </DashboardLayout>
      </RequireAuth>
    )
  }

  if (error && reqs.length === 0) {
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
                    onClick={fetchDeletionRequests}
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
                  <div className="rounded-xl p-3 bg-gradient-to-r from-red-400 to-red-500 shadow-lg">
                    <Trash2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-red-600 via-red-600 to-red-700 bg-clip-text text-transparent">
                      Demandes de Suppression
                    </CardTitle>
                    <CardDescription className="text-gray-600 mt-1">
                      Gérez les demandes de suppression d'entreprises
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
                    placeholder="Rechercher par entreprise, ICE ou comptable..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm h-11 border-gray-200 focus:border-blue-400 rounded-lg"
                  />
                  {search && (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
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
                        fetchDeletionRequests()
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
                  <div className="rounded-lg p-2 bg-gradient-to-r from-red-100 to-red-200">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-800">
                      Demandes en attente de traitement
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      {filtered.length} demande{filtered.length > 1 ? "s" : ""} de suppression en attente
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-red-50/50 to-pink-50/50 hover:from-red-50/70 hover:to-pink-50/70">
                        <TableHead className="font-semibold text-gray-700">Entreprise</TableHead>
                        <TableHead className="hidden sm:table-cell font-semibold text-gray-700">ICE</TableHead>
                        <TableHead className="hidden md:table-cell font-semibold text-gray-700">Comptable</TableHead>
                        <TableHead className="hidden lg:table-cell font-semibold text-gray-700">Date Demande</TableHead>
                        <TableHead className="font-semibold text-gray-700">Raison</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => (
                        <TableRow
                          key={r.id}
                          className="hover:bg-gradient-to-r hover:from-red-50/30 hover:to-pink-50/30 transition-all duration-200"
                        >
                          <TableCell className="font-medium text-gray-900">{r.companyName}</TableCell>
                          <TableCell className="hidden sm:table-cell text-gray-700">{r.ICE}</TableCell>
                          <TableCell className="hidden md:table-cell text-gray-700">{r.accountant}</TableCell>
                          <TableCell className="hidden lg:table-cell whitespace-nowrap text-gray-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {r.requestDate}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-gray-700" title={r.reason}>
                            {r.reason}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setSelected(r)}
                                title="Voir détails"
                                disabled={isProcessing}
                                className="h-8 w-8 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                className="h-8 w-8 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg"
                                onClick={() => handleApprove(r)}
                                disabled={isProcessing}
                                title="Approuver la suppression"
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
                                onClick={() => handleReject(r)}
                                disabled={isProcessing}
                                title="Rejeter la demande"
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
                      {filtered.length === 0 && !loading && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10">
                            <div className="flex flex-col items-center gap-3">
                              <Trash2 className="h-12 w-12 text-gray-300" />
                              <p className="text-gray-500 font-medium">
                                {search
                                  ? "Aucune demande ne correspond à votre recherche."
                                  : "Aucune demande de suppression en attente."}
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
            <Dialog open={!!selected} onOpenChange={(isOpen) => !isOpen && setSelected(null)}>
              <DialogContent className="backdrop-blur-md bg-white/95 border-0 shadow-2xl sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold text-gray-800">
                    Détails de la demande de suppression
                  </DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Informations complètes sur l'entreprise et la demande.
                  </DialogDescription>
                </DialogHeader>
                {selected && (
                  <div className="space-y-3 p-4 text-sm [&>p]:grid [&>p]:grid-cols-3 [&>p]:items-start [&>p]:gap-4">
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Entreprise :</strong>
                      <span className="col-span-2 text-gray-900">{selected.companyName}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">ICE :</strong>
                      <span className="col-span-2 text-gray-700">{selected.ICE}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Adresse :</strong>
                      <span className="col-span-2 text-gray-700">{selected.address}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Contact (Email) :</strong>
                      <span className="col-span-2 text-gray-700">{selected.contact}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Téléphone :</strong>
                      <span className="col-span-2 text-gray-700">{selected.phone}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Comptable demandeur :</strong>
                      <span className="col-span-2 text-gray-700">{selected.accountant}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Date de la demande :</strong>
                      <span className="col-span-2 text-gray-700">{selected.requestDate}</span>
                    </p>
                    <p>
                      <strong className="text-right font-semibold text-gray-700">Nombre de documents :</strong>
                      <span className="col-span-2">
                        <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700">
                          {selected.documents}
                        </Badge>
                      </span>
                    </p>
                    <div className="col-span-3">
                      <strong className="font-semibold text-gray-700">Raison de la demande :</strong>
                      <div className="mt-2 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border">
                        <p className="whitespace-pre-wrap text-gray-800">{selected.reason}</p>
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelected(null)}
                    className="border-gray-200 hover:bg-gray-50"
                  >
                    Fermer
                  </Button>
                  {selected && (
                    <div className="flex gap-2">
                      <Button
                        className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                        onClick={() => {
                          handleReject(selected)
                          setSelected(null)
                        }}
                        disabled={isProcessing}
                      >
                        Rejeter
                      </Button>
                      <Button
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                        onClick={() => {
                          handleApprove(selected)
                          setSelected(null)
                        }}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Approuver
                      </Button>
                    </div>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  )
}
