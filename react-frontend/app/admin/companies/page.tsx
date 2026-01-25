"use client"

import { useState, useEffect, useMemo, type ReactNode } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Eye,
  AlertTriangle,
  CheckCircle,
  Loader2,
  MoreHorizontal,
  FolderArchive,
  Calendar,
  Building2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import RequireAuth from "@/components/RequireAuth"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.14:8000/api"

type FeCalculatedStatus = "actif" | "expiré" | "expire bientot" | "unknown" | "aucun"

type Company = {
  id: number
  entreprise_nom: string
  RC: string
  IF: string
  ICE?: string
  adresse: string
  email: string
  telephone: string
  responsable_nom: string
  responsable_prenom: string
  comptable_prenom: string
  comptable_nom: string
  total_documents: number
  statut: "en_attente" | "validee" | "rejetee" | string
  raison_rejet?: string
  created_at: string
  taille_totale_documents_entreprise?: number
  statut_abonnement_calculated?: FeCalculatedStatus
  date_fin_abonnement?: string | null
}

// --- Utilitaires ---
const formatFileSize = (bytes?: number, decimals = 2) => {
  if (bytes == null) return "N/A"
  if (bytes === 0) return "0 Octets"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Octets", "Ko", "Mo", "Go", "To"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

const formatDateToDisplaySimple = (dateString?: string | null) => {
  if (!dateString) return ""
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch (e) {
    return ""
  }
}

const calculateDynamicAbonnementStatus = (endDateISO?: string | null): FeCalculatedStatus => {
  if (!endDateISO) return "aucun"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDateISO)
  end.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return "expiré"
  if (diffDays <= 30) return "expire bientot"
  return "actif"
}

const getStatusBadge = (status?: FeCalculatedStatus): ReactNode => {
  switch (status) {
    case "actif":
      return (
        <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white text-xs px-2 py-0.5 shadow-sm">
          <CheckCircle className="w-3 h-3 mr-1" />
          Actif
        </Badge>
      )
    case "expiré":
      return (
        <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs px-2 py-0.5 shadow-sm">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Expiré
        </Badge>
      )
    case "expire bientot":
      return (
        <Badge className="bg-gradient-to-r from-orange-400 to-orange-500 text-white text-xs px-2 py-0.5 shadow-sm">
          <Calendar className="w-3 h-3 mr-1" />
          Expire bientôt
        </Badge>
      )
    case "aucun":
      return (
        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-white border-gray-200">
          Aucun
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-white border-gray-200">
          Inconnu
        </Badge>
      )
  }
}

export default function AdminCompaniesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const accountantParam = searchParams.get("accountantName")?.toLowerCase() || "all"

  const [companies, setCompanies] = useState<Company[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [accountantFilter, setAccountantFilter] = useState(accountantParam)
  const [accountants, setAccountants] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isActionModalOpen, setIsActionModalOpen] = useState(false)
  const [actionType, setActionType] = useState<"validate" | "reject" | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")

  const fetchAllCompaniesDetails = async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const token = sessionStorage.getItem("token")
      const headers: HeadersInit = { Accept: "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch(`${API_BASE}/entreprises/details`, { headers })
      if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`)
      const json = await res.json()
      const data: any[] = Array.isArray(json.entreprises) ? json.entreprises : []

      const list = data.map((item): Company => {
        const dateFin = item.date_fin_abonnement
        return {
          id: item.id,
          entreprise_nom: item.entreprise_nom || item.name || "N/A",
          RC: item.RC,
          IF: item.IF,
          ICE: item.ICE || item.siret,
          adresse: item.adresse || item.address,
          email: item.email || item.contact,
          telephone: item.telephone || item.phone,
          responsable_nom: item.responsable_nom || item.nom,
          responsable_prenom: item.responsable_prenom || item.prenom,
          comptable_prenom: item.comptable_prenom,
          comptable_nom: item.comptable_nom,
          total_documents: item.total_documents ?? item.document_count ?? 0,
          statut: item.statut || "en_attente",
          raison_rejet: item.raison_rejet,
          created_at: item.created_at,
          taille_totale_documents_entreprise: item.taille_totale_documents_entreprise ?? 0,
          statut_abonnement_calculated: calculateDynamicAbonnementStatus(dateFin),
          date_fin_abonnement: dateFin,
        }
      })
      setCompanies(list)
      const uniq = Array.from(
        new Set(list.map((c) => `${c.comptable_prenom || ""} ${c.comptable_nom || ""}`.trim())),
      ).filter((n) => n)
      setAccountants(uniq)
    } catch (err: any) {
      setFetchError(err.message || "Une erreur inconnue est survenue")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllCompaniesDetails()
  }, [])
  useEffect(() => {
    setAccountantFilter(accountantParam)
  }, [accountantParam])

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const st = searchTerm.toLowerCase()
      const fullAcct = `${company.comptable_prenom || ""} ${company.comptable_nom || ""}`.toLowerCase()
      const matchesSearch =
        company.entreprise_nom.toLowerCase().includes(st) ||
        (company.ICE || "").toLowerCase().includes(st) ||
        (company.responsable_nom || "").toLowerCase().includes(st) ||
        (company.responsable_prenom || "").toLowerCase().includes(st) ||
        fullAcct.includes(st)
      const matchesAcct = accountantFilter === "all" || fullAcct === accountantFilter
      return matchesSearch && matchesAcct
    })
  }, [companies, searchTerm, accountantFilter])

  const valideesEtEnAttente = filteredCompanies.filter((c) => c.statut === "validee" || c.statut === "en_attente")
  const rejetees = filteredCompanies.filter((c) => c.statut === "rejetee")

  const handleAccountantFilterChange = (value: string) => {
    setAccountantFilter(value)
    const params = new URLSearchParams(window.location.search)
    if (value !== "all") {
      params.set("accountant", value)
    } else {
      params.delete("accountant")
    }
    const search = params.toString()
    const query = search ? `?${search}` : ""
    router.replace(`${window.location.pathname}${query}`, { scroll: false })
  }

  const clearAllFilters = () => {
    setSearchTerm("")
    handleAccountantFilterChange("all")
  }

  const viewCompanyDetails = (company: Company) => {
    setSelectedCompany(company)
    setIsDetailsOpen(true)
  }
  const openActionModal = (company: Company, type: "validate" | "reject") => {
    setSelectedCompany(company)
    setActionType(type)
    setRejectionReason("")
    setIsActionModalOpen(true)
  }

  const handleCompanyAction = async () => {
    if (!selectedCompany || !actionType) return
    const token = sessionStorage.getItem("token")
    if (!token) {
      setFetchError("Token d'authentification manquant.")
      return
    }

    const url = `${API_BASE}/entreprises/${selectedCompany.id}/${actionType === "validate" ? "valider" : "rejeter"}`
    const body = actionType === "reject" ? { raison_rejet: rejectionReason } : undefined

    setLoading(true)
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || `Erreur lors de l'action sur l'entreprise.`)
      alert(data.message || "Action effectuée avec succès.")
      setIsActionModalOpen(false)
      await fetchAllCompaniesDetails()
    } catch (err: any) {
      setFetchError(err.message)
      alert(`Erreur: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const getPageTitle = () =>
    accountantFilter !== "all" ? `Entreprises de ${accountantFilter}` : "Toutes les Entreprises"
  const getPageDescription = () =>
    accountantFilter !== "all"
      ? `Affichage des entreprises gérées par ${accountantFilter}.`
      : "Gérez et consultez toutes les entreprises inscrites."

  if (loading && companies.length === 0) {
    return (
      <RequireAuth>
        <DashboardLayout role="admin">
          <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
            <div className="flex justify-center items-center h-[calc(100vh-150px)]">
              <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-blue-200/20 p-8">
                <CardContent className="flex items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-gray-600 font-medium">Chargement des entreprises...</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </DashboardLayout>
      </RequireAuth>
    )
  }

  if (fetchError && companies.length === 0) {
    return (
      <RequireAuth>
        <DashboardLayout role="admin">
          <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] p-6">
              <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-red-200/20 max-w-md">
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="h-16 w-16 mb-4 text-red-400 mx-auto" />
                  <h3 className="text-xl font-semibold mb-2 text-red-600">Erreur de chargement</h3>
                  <p className="mb-6 text-red-500">{fetchError}</p>
                  <Button
                    onClick={fetchAllCompaniesDetails}
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
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl p-3 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        {getPageTitle()}
                      </CardTitle>
                      <CardDescription className="text-gray-600 mt-1">{getPageDescription()}</CardDescription>
                    </div>
                  </div>

                  {accountantFilter !== "all" && (
                    <Button
                      variant="outline"
                      onClick={clearAllFilters}
                      className="bg-white border-gray-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:border-blue-200"
                    >
                      Voir toutes les entreprises
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Search and Filter Section */}
            <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-blue-200/20">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <div className="rounded-lg p-2 bg-gradient-to-r from-blue-100 to-indigo-100 absolute left-3 top-1/2 -translate-y-1/2">
                      <Search className="h-4 w-4 text-blue-600" />
                    </div>
                    <Input
                      placeholder="Rechercher (Nom, ICE, Responsable, Comptable)..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-12 h-11 border-gray-200 focus:border-blue-400 rounded-lg max-w-md"
                    />
                  </div>
                  <Select value={accountantFilter} onValueChange={handleAccountantFilterChange}>
                    <SelectTrigger className="w-full md:w-[250px] h-11 border-gray-200 focus:border-blue-400 rounded-lg">
                      <SelectValue placeholder="Filtrer par comptable" />
                    </SelectTrigger>
                    <SelectContent className="backdrop-blur-md bg-white/95 border-0 shadow-xl">
                      <SelectItem value="all">Tous les comptables</SelectItem>
                      {accountants.map((accountant, index) => (
                        <SelectItem key={index} value={accountant.toLowerCase()}>
                          {accountant}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(searchTerm || accountantFilter !== "all") && (
                  <div className="flex items-center gap-2 mt-4">
                    {searchTerm && (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Recherche: "{searchTerm}"</Badge>
                    )}
                    {accountantFilter !== "all" && (
                      <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                        Comptable: {accountantFilter}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Error Display */}
            {fetchError && !isActionModalOpen && (
              <Card className="backdrop-blur-md bg-red-50/90 border-0 shadow-xl shadow-red-200/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <p className="text-red-700 font-medium">{fetchError}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabs Section */}
            <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-blue-200/20">
              <CardContent className="p-6">
                <Tabs defaultValue="validees_attente" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-blue-50 to-indigo-50 p-1 rounded-lg">
                    <TabsTrigger
                      value="validees_attente"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Validées & En Attente ({valideesEtEnAttente.length})
                      </div>
                    </TabsTrigger>
                    <TabsTrigger
                      value="rejetees"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Rejetées ({rejetees.length})
                      </div>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="validees_attente" className="mt-6">
                    <div className="rounded-lg overflow-hidden border-0 shadow-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 hover:from-blue-50/70 hover:to-indigo-50/70">
                            <TableHead className="font-semibold text-gray-700">Nom Entreprise</TableHead>
                            <TableHead className="hidden sm:table-cell font-semibold text-gray-700">ICE</TableHead>
                            <TableHead className="font-semibold text-gray-700">Comptable</TableHead>
                            <TableHead className="hidden md:table-cell text-center font-semibold text-gray-700">
                              Capacité
                            </TableHead>
                            <TableHead className="hidden lg:table-cell text-center font-semibold text-gray-700">
                              Documents
                            </TableHead>
                            <TableHead className="font-semibold text-gray-700">Abonnement</TableHead>
                            <TableHead className="font-semibold text-gray-700">Statut Compte</TableHead>
                            <TableHead className="hidden xl:table-cell font-semibold text-gray-700">Créée le</TableHead>
                            <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {valideesEtEnAttente.length > 0 ? (
                            valideesEtEnAttente.map((company) => (
                              <TableRow
                                key={company.id}
                                className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/30 transition-all duration-200"
                              >
                                <TableCell className="font-medium text-gray-900">{company.entreprise_nom}</TableCell>
                                <TableCell className="hidden sm:table-cell text-gray-700">
                                  {company.ICE || "-"}
                                </TableCell>
                                <TableCell className="text-gray-700">
                                  {`${company.comptable_prenom || ""} ${company.comptable_nom || ""}`.trim()}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-center">
                                  <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                                    <div className="rounded-md p-1 bg-gradient-to-r from-blue-100 to-indigo-100">
                                      <FolderArchive className="h-3 w-3 text-blue-600" />
                                    </div>
                                    {formatFileSize(company.taille_totale_documents_entreprise)}
                                  </div>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-center">
                                  <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 hover:from-blue-200 hover:to-indigo-200">
                                    {company.total_documents}
                                  </Badge>
                                </TableCell>
                                <TableCell>{getStatusBadge(company.statut_abonnement_calculated)}</TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      company.statut === "validee"
                                        ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
                                        : "bg-gradient-to-r from-yellow-400 to-yellow-500 text-white"
                                    }
                                  >
                                    {company.statut.replace("_", " ")}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden xl:table-cell text-gray-600">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                    {formatDateToDisplaySimple(company.created_at)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
                                        disabled={loading}
                                      >
                                        <span className="sr-only">Ouvrir le menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="backdrop-blur-md bg-white/95 border-0 shadow-xl"
                                    >
                                      <DropdownMenuItem
                                        onSelect={() => viewCompanyDetails(company)}
                                        className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
                                      >
                                        <Eye className="mr-2 h-4 w-4" /> Voir détails
                                      </DropdownMenuItem>
                                      {company.statut === "en_attente" && (
                                        <>
                                          <DropdownMenuItem
                                            onSelect={() => openActionModal(company, "validate")}
                                            className="text-green-600 hover:bg-green-50 hover:text-green-700"
                                          >
                                            <CheckCircle className="mr-2 h-4 w-4" /> Valider
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onSelect={() => openActionModal(company, "reject")}
                                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                          >
                                            <AlertTriangle className="mr-2 h-4 w-4" /> Rejeter
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={9} className="h-32 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <Building2 className="h-12 w-12 text-gray-300" />
                                  <p className="text-gray-500 font-medium">Aucune entreprise à afficher.</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="rejetees" className="mt-6">
                    <div className="rounded-lg overflow-hidden border-0 shadow-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-red-50/50 to-pink-50/50 hover:from-red-50/70 hover:to-pink-50/70">
                            <TableHead className="font-semibold text-gray-700">Nom Entreprise</TableHead>
                            <TableHead className="font-semibold text-gray-700">Comptable</TableHead>
                            <TableHead className="font-semibold text-gray-700">Raison du Rejet</TableHead>
                            <TableHead className="hidden lg:table-cell font-semibold text-gray-700">Créée le</TableHead>
                            <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rejetees.length > 0 ? (
                            rejetees.map((company) => (
                              <TableRow
                                key={company.id}
                                className="bg-red-50/30 hover:bg-gradient-to-r hover:from-red-50/50 hover:to-pink-50/50 transition-all duration-200"
                              >
                                <TableCell className="font-medium text-gray-900">{company.entreprise_nom}</TableCell>
                                <TableCell className="text-gray-700">
                                  {`${company.comptable_prenom || ""} ${company.comptable_nom || ""}`.trim()}
                                </TableCell>
                                <TableCell className="text-red-600">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="block max-w-xs truncate">{company.raison_rejet || "N/A"}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{company.raison_rejet}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-gray-600">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                    {formatDateToDisplaySimple(company.created_at)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-lg hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50"
                                        disabled={loading}
                                      >
                                        <span className="sr-only">Ouvrir le menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="backdrop-blur-md bg-white/95 border-0 shadow-xl"
                                    >
                                      <DropdownMenuItem
                                        onSelect={() => viewCompanyDetails(company)}
                                        className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
                                      >
                                        <Eye className="mr-2 h-4 w-4" /> Voir détails
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onSelect={() => openActionModal(company, "validate")}
                                        className="text-green-600 hover:bg-green-50 hover:text-green-700"
                                      >
                                        <CheckCircle className="mr-2 h-4 w-4" /> Valider (Réactiver)
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="h-32 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <Building2 className="h-12 w-12 text-gray-300" />
                                  <p className="text-gray-500 font-medium">Aucune entreprise rejetée.</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
              <DialogContent className="backdrop-blur-md bg-white/95 border-0 shadow-2xl sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold text-gray-800">
                    Détails de: {selectedCompany?.entreprise_nom}
                  </DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Informations complètes sur l'entreprise.
                  </DialogDescription>
                </DialogHeader>
                {selectedCompany && (
                  <div className="grid gap-3 py-4 text-sm [&>div]:grid [&>div]:grid-cols-3 [&>div]:items-start [&>div]:gap-4">
                    <div>
                      <Label className="text-right font-semibold text-gray-700">Nom</Label>
                      <span className="col-span-2 text-gray-900">{selectedCompany.entreprise_nom}</span>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">RC</Label>
                      <span className="col-span-2 text-gray-700">{selectedCompany.RC || "-"}</span>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">IF</Label>
                      <span className="col-span-2 text-gray-700">{selectedCompany.IF || "-"}</span>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">ICE</Label>
                      <span className="col-span-2 text-gray-700">{selectedCompany.ICE || "-"}</span>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">Adresse</Label>
                      <span className="col-span-2 text-gray-700">{selectedCompany.adresse}</span>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">Email</Label>
                      <span className="col-span-2 text-gray-700">{selectedCompany.email}</span>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">Téléphone</Label>
                      <span className="col-span-2 text-gray-700">{selectedCompany.telephone}</span>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">Responsable</Label>
                      <span className="col-span-2 text-gray-700">
                        {selectedCompany.responsable_prenom} {selectedCompany.responsable_nom}
                      </span>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">Comptable</Label>
                      <span className="col-span-2 text-gray-700">
                        {selectedCompany.comptable_prenom} {selectedCompany.comptable_nom}
                      </span>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">Statut Compte</Label>
                      <span className="col-span-2 font-medium capitalize text-gray-900">
                        {(selectedCompany.statut || "N/A").replace("_", " ")}
                      </span>
                    </div>
                    {selectedCompany.statut === "rejetee" && (
                      <div>
                        <Label className="text-right font-semibold text-gray-700">Raison Rejet</Label>
                        <span className="col-span-2 whitespace-pre-wrap text-red-600">
                          {selectedCompany.raison_rejet}
                        </span>
                      </div>
                    )}
                    <div>
                      <Label className="text-right font-semibold text-gray-700">Documents</Label>
                      <span className="col-span-2 text-gray-700">{selectedCompany.total_documents}</span>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">Capacité</Label>
                      <span className="col-span-2 text-gray-700">
                        {formatFileSize(selectedCompany.taille_totale_documents_entreprise)}
                      </span>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">Abonnement</Label>
                      <div className="col-span-2">{getStatusBadge(selectedCompany.statut_abonnement_calculated)}</div>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">Fin Abon.</Label>
                      <span className="col-span-2 text-gray-700">
                        {formatDateToDisplaySimple(selectedCompany.date_fin_abonnement) || "N/A"}
                      </span>
                    </div>
                    <div>
                      <Label className="text-right font-semibold text-gray-700">Créée le</Label>
                      <span className="col-span-2 text-gray-700">
                        {selectedCompany.created_at
                          ? new Date(selectedCompany.created_at).toLocaleString("fr-FR")
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDetailsOpen(false)}
                    className="border-gray-200 hover:bg-gray-50"
                  >
                    Fermer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Action Modal */}
            <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
              <DialogContent className="backdrop-blur-md bg-white/95 border-0 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold text-gray-800">
                    {actionType === "validate" ? "Valider" : "Rejeter"} "{selectedCompany?.entreprise_nom}"
                  </DialogTitle>
                  <DialogDescription className="text-gray-600">
                    {actionType === "validate"
                      ? "Confirmez-vous la validation de cette entreprise ? Elle pourra alors accéder à la plateforme."
                      : "Veuillez fournir une raison pour le rejet. Elle sera visible par le responsable."}
                  </DialogDescription>
                </DialogHeader>
                {actionType === "reject" && (
                  <div className="grid gap-4 py-4">
                    <Label htmlFor="rejectionReason" className="font-semibold text-gray-700">
                      Raison du rejet (obligatoire)
                    </Label>
                    <Input
                      id="rejectionReason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Ex: Informations manquantes, documents incorrects..."
                      className="h-11 border-gray-200 focus:border-red-400 rounded-lg"
                    />
                  </div>
                )}
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsActionModalOpen(false)}
                    disabled={loading}
                    className="border-gray-200 hover:bg-gray-50"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleCompanyAction}
                    disabled={loading || (actionType === "reject" && !rejectionReason.trim())}
                    className={
                      actionType === "reject"
                        ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                        : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                    }
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {actionType === "validate" ? "Confirmer la Validation" : "Confirmer le Rejet"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  )
}
