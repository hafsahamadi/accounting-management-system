"use client"

import { useEffect, useState, useMemo, useCallback, type ChangeEvent } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  Building,
  Loader2,
  FileStack,
  FileWarning,
  Upload,
  Filter,
} from "lucide-react"
import RequireAuth from "@/components/RequireAuth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Gardez votre constante. Assurez-vous qu'elle pointe vers la racine de votre backend.
const API_BASE_URL = "http://192.168.1.14:8000"

type Document = {
  id: number
  name: string
  company: string
  type: string
  date: string
  status: string
  fileUrl: string
  taille_fichier?: number
  justificatifs_sum_taille_fichier?: number
}

type JustificatifPaiement = {
  id: number
  id_facture: number
  mode_paiement: "cheque" | "virement" | "espece" | "autre" | string
  date_justificatif: string | null
  chemin_fichier: string
  created_at: string
  updated_at: string
  taille_fichier?: number
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [companyFilter, setCompanyFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [justificatifs, setJustificatifs] = useState<JustificatifPaiement[]>([])
  const [justificatifsLoading, setJustificatifsLoading] = useState(false)
  const [justificatifsError, setJustificatifsError] = useState("")

  const [justificatifFile, setJustificatifFile] = useState<File | null>(null)
  const [isUploadingJustificatif, setIsUploadingJustificatif] = useState(false)
  const [uploadJustificatifError, setUploadJustificatifError] = useState("")

  const searchParams = useSearchParams()
  const companyParam = searchParams.get("company")

  useEffect(() => {
    if (companyParam) {
      setCompanyFilter(companyParam)
    }
  }, [companyParam])

  const getFileExtension = (filename?: string) => filename?.split(".").pop()?.toLowerCase() || ""

  const formatDate = (dateString: string | null) =>
    dateString
      ? new Date(dateString).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" })
      : "N/A"

  const formatFileSize = (bytes?: number, decimals = 2) => {
    if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return "N/A"
    if (bytes === 0) return "0 Octets"
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ["Octets", "Ko", "Mo", "Go", "To"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
  }

  const statusToBackend = (status: string) => {
    switch (status) {
      case "Traité":
        return "traite"
      case "Rejeté":
        return "a_revoir"
      case "En cours":
        return "en_cours"
      default:
        return status.toLowerCase().replace(" ", "_")
    }
  }

  const statusFromBackend = (status: string) => {
    switch (status) {
      case "traite":
        return "Traité"
      case "a_revoir":
        return "Rejeté"
      case "en_cours":
        return "En cours"
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")
    }
  }

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError("")
    console.log("Début de fetchDocuments...")

    let token = null
    if (typeof window !== "undefined") {
      token = sessionStorage.getItem("token")
    }

    console.log("[fetchDocuments] Token récupéré de sessionStorage:", token)

    if (!token) {
      console.error("[fetchDocuments] Token manquant dans sessionStorage. L'utilisateur doit se reconnecter.")
      setError("Authentification requise. Veuillez vous reconnecter (token non trouvé).")
      setLoading(false)
      return
    }

    // Assurez-vous que API_BASE_URL est valide
    if (!API_BASE_URL || !API_BASE_URL.startsWith("http")) {
      console.error("[fetchDocuments] API_BASE_URL est invalide:", API_BASE_URL)
      setError("Erreur de configuration client: l'URL de l'API est incorrecte.")
      setLoading(false)
      return
    }

    const fullApiUrl = `${API_BASE_URL}/api/documents/public` // Construction de l'URL complète

    try {
      console.log(`[fetchDocuments] Appel API GET vers: ${fullApiUrl}`)
      const res = await fetch(fullApiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })

      console.log("[fetchDocuments] Réponse API reçue. Statut:", res.status)

      if (!res.ok) {
        const errorBodyText = await res.text()
        console.error(`[fetchDocuments] Erreur API. Statut: ${res.status}, Corps: ${errorBodyText}`)
        if (res.status === 401) {
          setError("Session expirée ou token invalide. Veuillez vous reconnecter.")
        } else {
          setError(`Erreur serveur (${res.status}): ${errorBodyText.substring(0, 150)}...`)
        }
        setLoading(false)
        return
      }

      const responseData = await res.json()
      console.log("[fetchDocuments] Données API (brutes):", responseData)

      const docsArray = responseData.data || responseData // S'adapte si la réponse est {data: [...]} ou [...]

      if (!Array.isArray(docsArray)) {
        console.error("[fetchDocuments] Format de réponse API inattendu (docsArray n'est pas un tableau):", docsArray)
        setError("Format de données incorrect reçu du serveur.")
        setLoading(false)
        return
      }

      console.log("[fetchDocuments] Mappage des documents...")
      const mappedDocuments = docsArray.map((doc: any) => ({
        id: doc.id,
        name: doc.name || "Nom indisponible",
        company: doc.company_name || doc.company || "Entreprise inconnue", // Priorise company_name si présent
        type: doc.type || "Type inconnu",
        date: doc.date, // Assurez-vous que ce format est correct du backend
        status: statusFromBackend(doc.status),
        fileUrl:
          doc.chemin_fichier && !doc.chemin_fichier.startsWith("http")
            ? `${API_BASE_URL}${doc.chemin_fichier}`
            : doc.chemin_fichier,
        taille_fichier: doc.taille_fichier,
        justificatifs_sum_taille_fichier: doc.justificatifs_sum_taille_fichier,
      }))

      setDocuments(mappedDocuments)
      console.log("[fetchDocuments] Documents mis à jour dans l'état:", mappedDocuments.length, "documents chargés.")
    } catch (e: any) {
      console.error("[fetchDocuments] Erreur inattendue dans fetchDocuments:", e)
      // Si une erreur spécifique n'a pas déjà été définie par une réponse non-OK
      if (!error && e.message) {
        setError(e.message)
      } else if (!error) {
        setError("Une erreur réseau ou inconnue est survenue lors du chargement des documents.")
      }
    } finally {
      setLoading(false)
      console.log("Fin de fetchDocuments.")
    }
  }, []) // API_BASE_URL étant une constante hors du composant, elle n'est pas une dépendance.

  useEffect(() => {
    if (typeof window !== "undefined") {
      fetchDocuments()
    }
  }, [fetchDocuments])

  const fetchJustificatifs = useCallback(async (factureId: number) => {
    setJustificatifsLoading(true)
    setJustificatifsError("")
    console.log(`[fetchJustificatifs] Début pour facture ID: ${factureId}`)

    let token = null
    if (typeof window !== "undefined") {
      token = sessionStorage.getItem("token")
    }
    console.log("[fetchJustificatifs] Token récupéré:", token)

    if (!token) {
      console.error("[fetchJustificatifs] Token manquant.")
      setJustificatifsError("Authentification requise pour charger les justificatifs.")
      setJustificatifsLoading(false)
      return
    }

    const fullApiUrl = `${API_BASE_URL}/api/justificatifs/facture/${factureId}`

    try {
      console.log(`[fetchJustificatifs] Appel API GET vers: ${fullApiUrl}`)
      const res = await fetch(fullApiUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      })

      console.log("[fetchJustificatifs] Réponse API reçue. Statut:", res.status)
      if (!res.ok) {
        const errorText = await res.text()
        console.error(`[fetchJustificatifs] Erreur API. Statut: ${res.status}, Corps: ${errorText}`)
        if (res.status === 401) throw new Error("Session expirée. Veuillez vous reconnecter.")
        throw new Error(`API Justificatifs (${res.status}): ${errorText || "Erreur inconnue"}`)
      }
      const responseData = await res.json()
      const justifsArray = responseData.data || responseData

      if (!Array.isArray(justifsArray)) {
        console.error("[fetchJustificatifs] Format de réponse inattendu:", justifsArray)
        throw new Error("Format de données de justificatifs inattendu.")
      }

      setJustificatifs(
        justifsArray.map((justif: any) => ({
          ...justif,
          chemin_fichier:
            justif.chemin_fichier && !justif.chemin_fichier.startsWith("http")
              ? `${API_BASE_URL}${justif.chemin_fichier}`
              : justif.chemin_fichier,
        })),
      )
      console.log("[fetchJustificatifs] Justificatifs chargés:", justifsArray.length)
    } catch (e: any) {
      console.error("[fetchJustificatifs] Erreur:", e)
      setJustificatifsError(e.message)
      setJustificatifs([])
    } finally {
      setJustificatifsLoading(false)
      console.log("[fetchJustificatifs] Fin.")
    }
  }, [])

  useEffect(() => {
    if (selectedDocument && isDetailsOpen) {
      fetchJustificatifs(selectedDocument.id)
    } else {
      setJustificatifs([])
      setJustificatifsError("")
    }
  }, [selectedDocument, isDetailsOpen, fetchJustificatifs])

  const companies = useMemo(
    () => Array.from(new Set(documents.map((d) => d.company).filter(Boolean))).sort(),
    [documents],
  )
  const types = useMemo(() => Array.from(new Set(documents.map((d) => d.type).filter(Boolean))).sort(), [documents])
  const statuses = useMemo(
    () => Array.from(new Set(documents.map((d) => d.status).filter(Boolean))).sort(),
    [documents],
  )

  const filteredDocuments = useMemo(() => {
    return documents.filter(
      (d) =>
        (d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.company?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (companyFilter === "all" || d.company === companyFilter) &&
        (typeFilter === "all" || d.type === typeFilter) &&
        (statusFilter === "all" || d.status === statusFilter),
    )
  }, [documents, searchTerm, companyFilter, typeFilter, statusFilter])

  const viewDocument = (doc: Document) => {
    setSelectedDocument(doc)
    setIsDetailsOpen(true)
    setUploadJustificatifError("")
  }

  const updateDocumentStatus = async (id: number, newStatusApi: string, newStatusDisplay: string) => {
    console.log(`[updateDocumentStatus] Mise à jour doc ID ${id} vers statut API: ${newStatusApi}`)
    let token = null
    if (typeof window !== "undefined") token = sessionStorage.getItem("token")
    if (!token) {
      setError("Authentification requise pour cette action.")
      return
    }

    try {
      const fullApiUrl = `${API_BASE_URL}/api/documents/${id}/status`
      const response = await fetch(fullApiUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatusApi }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Erreur HTTP ${response.status}` }))
        console.error(`[updateDocumentStatus] Erreur API. Statut: ${response.status}, Data:`, errorData)
        if (response.status === 401) throw new Error("Session expirée. Veuillez vous reconnecter.")
        throw new Error(errorData.message || `Erreur lors de la mise à jour du statut (${response.status})`)
      }
      setDocuments((docs) => docs.map((d) => (d.id === id ? { ...d, status: newStatusDisplay } : d)))
      if (selectedDocument && selectedDocument.id === id) {
        setSelectedDocument((prev) => (prev ? { ...prev, status: newStatusDisplay } : null))
      }
      console.log(`[updateDocumentStatus] Statut mis à jour avec succès pour doc ID ${id}.`)
    } catch (e: any) {
      console.error("[updateDocumentStatus] Erreur:", e)
      setError("Erreur mise à jour statut: " + e.message)
    }
  }

  const handleJustificatifFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setJustificatifFile(event.target.files[0])
      setUploadJustificatifError("")
    } else {
      setJustificatifFile(null)
    }
  }

  const handleUploadJustificatif = async () => {
    if (!justificatifFile || !selectedDocument) return
    setIsUploadingJustificatif(true)
    setUploadJustificatifError("")
    console.log(
      `[handleUploadJustificatif] Upload pour doc ID ${selectedDocument.id}, fichier: ${justificatifFile.name}`,
    )

    let token = null
    if (typeof window !== "undefined") token = sessionStorage.getItem("token")
    if (!token) {
      setUploadJustificatifError("Authentification requise.")
      setIsUploadingJustificatif(false)
      return
    }

    const formData = new FormData()
    formData.append("id_facture", selectedDocument.id.toString())
    formData.append("document_justificatif", justificatifFile)

    try {
      const fullApiUrl = `${API_BASE_URL}/api/justificatifs`
      const res = await fetch(fullApiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }, // Content-Type est géré par le navigateur pour FormData
        body: formData,
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error(`[handleUploadJustificatif] Erreur API. Statut: ${res.status}, Corps: ${errorText}`)
        if (res.status === 401) throw new Error("Session expirée. Veuillez vous reconnecter.")
        throw new Error(`Upload Justificatif (${res.status}): ${errorText}`)
      }
      setJustificatifFile(null)
      const fileInput = document.getElementById("justificatif-upload") as HTMLInputElement
      if (fileInput) fileInput.value = ""

      console.log("[handleUploadJustificatif] Succès. Rechargement des justificatifs et documents.")
      fetchJustificatifs(selectedDocument.id)
      fetchDocuments() // Pour mettre à jour la taille totale des documents si le backend la recalcule.
    } catch (e: any) {
      console.error("[handleUploadJustificatif] Erreur:", e)
      setUploadJustificatifError("Erreur upload: " + e.message)
    } finally {
      setIsUploadingJustificatif(false)
    }
  }

  const handleRetryFetchDocuments = () => {
    console.log("[handleRetryFetchDocuments] Tentative de rechargement des documents...")
    fetchDocuments()
  }

  return (
    <RequireAuth>
      <DashboardLayout role="accountant">
        <div className="space-y-6 p-4 md:p-6">
          {/* Header avec style doux */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl p-3 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg">
                      <Building className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
                        Gestion des Documents
                      </CardTitle>
                      <CardDescription className="text-gray-600 mt-1">
                        Gérez vos documents clientes 
                      </CardDescription>
                    </div>
                  </div>
      </div>
          {/* Notification entreprise avec style doux */}
          {companyParam && (
            <div className="backdrop-blur-md bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/50 rounded-xl p-4 shadow-lg shadow-blue-100/50">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-md">
                  <Building className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-medium text-blue-800">
                  Affichage des documents pour :{" "}
                  <span className="font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {companyParam}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCompanyFilter("all")
                    if (typeof window !== "undefined") {
                      const url = new URL(window.location.href)
                      url.searchParams.delete("company")
                      window.history.replaceState({}, "", url.toString())
                    }
                  }}
                  className="ml-auto rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200"
                >
                  Voir tous
                </Button>
              </div>
            </div>
          )}

          {/* Barre de recherche et filtres avec style doux */}
          <div className="backdrop-blur-md bg-white/90 rounded-xl p-4 shadow-lg shadow-blue-100/20 border border-blue-100/50">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-3 flex-1">
                <div className="rounded-lg p-2 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-md">
                  <Search className="h-4 w-4 text-white" />
                </div>
                <Input
                  placeholder="Rechercher un document ou une entreprise..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm rounded-lg border-blue-200/50 focus:border-emerald-300 focus:ring-emerald-200/50"
                />
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-emerald-600" />
                  <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] rounded-lg border-blue-200/50">
                      <SelectValue placeholder="Entreprise" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="all">Toutes les entreprises</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company} value={company}>
                          {company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-lg border-blue-200/50">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all">Tous les types</SelectItem>
                    {types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-lg border-blue-200/50">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contenu principal avec style doux */}
          {loading ? (
            <div className="flex justify-center items-center h-60 backdrop-blur-md bg-white/90 rounded-xl shadow-lg shadow-blue-100/20">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-md">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
                <p className="text-gray-600 font-medium">Chargement des documents...</p>
              </div>
            </div>
          ) : error ? (
            <Alert
              variant="destructive"
              className="my-4 backdrop-blur-md bg-red-50/90 border-red-200/50 rounded-xl shadow-lg"
            >
              <div className="rounded-lg p-1 bg-red-500 shadow-md w-fit">
                <FileWarning className="h-4 w-4 text-white" />
              </div>
              <AlertTitle className="text-red-800 font-semibold">Erreur de chargement</AlertTitle>
              <AlertDescription className="text-red-700">
                {error}
                {error.includes("Session expirée") ||
                error.includes("token invalide") ||
                error.includes("Authentification requise") ? (
                  <Button
                    onClick={handleRetryFetchDocuments}
                    variant="link"
                    className="p-0 h-auto ml-2 text-red-600 hover:text-red-800 font-medium"
                  >
                    Réessayer de charger
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="backdrop-blur-md bg-white/90 rounded-xl shadow-lg shadow-blue-100/20 border border-blue-100/50 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50 border-b border-emerald-100/50">
                      <TableHead className="min-w-[200px] font-semibold text-emerald-800">Nom</TableHead>
                      <TableHead className="hidden sm:table-cell min-w-[150px] font-semibold text-emerald-800">
                        Entreprise
                      </TableHead>
                      <TableHead className="hidden md:table-cell min-w-[100px] font-semibold text-emerald-800">
                        Type
                      </TableHead>
                      <TableHead className="min-w-[120px] font-semibold text-emerald-800">Taille Totale</TableHead>
                      <TableHead className="hidden lg:table-cell min-w-[120px] font-semibold text-emerald-800">
                        Date Doc.
                      </TableHead>
                      <TableHead className="min-w-[100px] font-semibold text-emerald-800">Statut</TableHead>
                      <TableHead className="text-right min-w-[100px] font-semibold text-emerald-800">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.length > 0 ? (
                      filteredDocuments.map((doc) => {
                        const tailleTotale = (doc.taille_fichier || 0) + (doc.justificatifs_sum_taille_fichier || 0)
                        return (
                          <TableRow
                            key={doc.id}
                            className="hover:bg-gradient-to-r hover:from-emerald-50/30 hover:to-teal-50/30 transition-all duration-200"
                          >
                            <TableCell className="font-medium truncate" title={doc.name}>
                              {doc.name}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-gray-600">{doc.company}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge
                                variant="outline"
                                className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200/50"
                              >
                                {doc.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-sm">
                                <div className="rounded p-1 bg-gradient-to-r from-purple-400 to-pink-500 shadow-sm">
                                  <FileStack className="h-3 w-3 text-white" />
                                </div>
                                <span className="font-medium text-gray-700">{formatFileSize(tailleTotale)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-gray-600">{formatDate(doc.date)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  doc.status === "En cours"
                                    ? "default"
                                    : doc.status === "Traité"
                                      ? "secondary"
                                      : doc.status === "Rejeté"
                                        ? "destructive"
                                        : "outline"
                                }
                                className={
                                  doc.status === "En cours"
                                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md"
                                    : doc.status === "Traité"
                                      ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md"
                                      : doc.status === "Rejeté"
                                        ? "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md"
                                        : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700"
                                }
                              >
                                {doc.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => viewDocument(doc)}
                                  title="Voir détails"
                                  className="rounded-lg hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 hover:text-emerald-700 transition-all duration-200"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {doc.fileUrl && (
                                  <Button
                                    asChild
                                    variant="ghost"
                                    size="icon"
                                    title="Télécharger le document principal"
                                    className="rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700 transition-all duration-200"
                                  >
                                    <a href={doc.fileUrl} download={doc.name} target="_blank" rel="noopener noreferrer">
                                      <Download className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <div className="rounded-lg p-3 bg-gradient-to-r from-gray-100 to-gray-200">
                              <FileStack className="h-8 w-8 text-gray-400" />
                            </div>
                            <span className="font-medium">Aucun document trouvé.</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Dialog avec style doux */}
          <Dialog
            open={isDetailsOpen}
            onOpenChange={(open) => {
              setIsDetailsOpen(open)
              if (!open) setSelectedDocument(null)
            }}
          >
            <DialogContent className="max-w-2xl md:max-w-4xl max-h-[90vh] flex flex-col backdrop-blur-md bg-white/95 border-blue-200/50 shadow-2xl shadow-blue-200/20">
              <DialogHeader className="border-b border-blue-100/50 pb-4">
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
                  Détails du document: {selectedDocument?.name}
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Visualisez et traitez le document. Les justificatifs de paiement sont listés ci-dessous.
                </DialogDescription>
              </DialogHeader>

              <div className="grid md:grid-cols-3 gap-6 py-4 overflow-y-auto flex-1 pr-2">
                <div className="md:col-span-2 space-y-4">
                  <div className="border border-blue-200/50 rounded-xl p-2 h-96 md:h-[calc(90vh-320px)] flex items-center justify-center bg-gradient-to-br from-blue-50/30 to-indigo-50/30 backdrop-blur-sm shadow-inner">
                    {selectedDocument?.fileUrl ? (
                      getFileExtension(selectedDocument.fileUrl) === "pdf" ? (
                        <iframe
                          src={selectedDocument.fileUrl}
                          className="w-full h-full rounded-lg"
                          title="Aperçu PDF"
                        />
                      ) : (
                        <img
                          src={selectedDocument.fileUrl || "/placeholder.svg"}
                          alt="Aperçu du document"
                          className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
                        />
                      )
                    ) : (
                      <div className="text-center">
                        <div className="rounded-lg p-4 bg-gradient-to-r from-gray-100 to-gray-200 mb-3 w-fit mx-auto">
                          <FileWarning className="h-12 w-12 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">Aucun fichier à afficher pour le document principal</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-1 space-y-4">
                  <div className="backdrop-blur-sm bg-gradient-to-br from-emerald-50/50 to-teal-50/50 rounded-xl p-4 border border-emerald-200/50">
                    <h3 className="text-lg font-semibold text-emerald-800 border-b border-emerald-200/50 pb-2 mb-3">
                      Informations Document
                    </h3>
                    {selectedDocument && (
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <strong className="text-emerald-700">Nom:</strong>
                          <span className="text-gray-700 font-medium">{selectedDocument.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <strong className="text-emerald-700">Entreprise:</strong>
                          <span className="text-gray-700 font-medium">{selectedDocument.company}</span>
                        </div>
                        <div className="flex justify-between">
                          <strong className="text-emerald-700">Type:</strong>
                          <Badge
                            variant="outline"
                            className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200/50"
                          >
                            {selectedDocument.type}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <strong className="text-emerald-700">Date:</strong>
                          <span className="text-gray-700 font-medium">{formatDate(selectedDocument.date)}</span>
                        </div>
                        <div className="flex justify-between">
                          <strong className="text-emerald-700">Taille Doc.:</strong>
                          <span className="text-gray-700 font-medium">
                            {formatFileSize(selectedDocument.taille_fichier)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <strong className="text-emerald-700">Statut:</strong>
                          <Badge
                            variant={
                              selectedDocument.status === "En cours"
                                ? "default"
                                : selectedDocument.status === "Traité"
                                  ? "secondary"
                                  : selectedDocument.status === "Rejeté"
                                    ? "destructive"
                                    : "outline"
                            }
                            className={
                              selectedDocument.status === "En cours"
                                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md"
                                : selectedDocument.status === "Traité"
                                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md"
                                  : selectedDocument.status === "Rejeté"
                                    ? "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md"
                                    : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700"
                            }
                          >
                            {selectedDocument.status}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-3 space-y-4">
                  <Separator className="bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
                  <div className="backdrop-blur-sm bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-xl p-4 border border-blue-200/50">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <div className="rounded-lg p-1 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-sm">
                        <Upload className="h-4 w-4 text-white" />
                      </div>
                      Justificatifs de Paiement
                    </h3>
                    {justificatifsLoading ? (
                      <div className="flex items-center text-blue-600 bg-blue-50/50 rounded-lg p-3">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement des justificatifs...
                      </div>
                    ) : justificatifsError ? (
                      <Alert variant="destructive" className="py-2 px-3 text-sm bg-red-50/80 border-red-200/50">
                        <div className="rounded p-1 bg-red-500 shadow-sm w-fit">
                          <FileWarning className="h-4 w-4 text-white" />
                        </div>
                        <AlertDescription className="text-red-700">{justificatifsError}</AlertDescription>
                      </Alert>
                    ) : justificatifs.length > 0 ? (
                      <div className="rounded-lg border border-blue-200/50 overflow-hidden bg-white/50">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                              <TableHead className="font-semibold text-blue-800">Mode Paiement</TableHead>
                              <TableHead className="font-semibold text-blue-800">Date Justif.</TableHead>
                              <TableHead className="font-semibold text-blue-800">Taille</TableHead>
                              <TableHead className="text-right font-semibold text-blue-800">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {justificatifs.map((justif) => (
                              <TableRow
                                key={justif.id}
                                className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/30"
                              >
                                <TableCell className="font-medium capitalize">
                                  {justif.mode_paiement || "N/A"}
                                </TableCell>
                                <TableCell>{formatDate(justif.date_justificatif)}</TableCell>
                                <TableCell>{formatFileSize(justif.taille_fichier)}</TableCell>
                                <TableCell className="text-right">
                                  {justif.chemin_fichier && (
                                    <Button
                                      asChild
                                      variant="ghost"
                                      size="icon"
                                      title="Voir le justificatif"
                                      className="rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700"
                                    >
                                      <a href={justif.chemin_fichier} target="_blank" rel="noopener noreferrer">
                                        <Eye className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="rounded-lg p-4 bg-gradient-to-r from-gray-100 to-gray-200 mb-3 w-fit mx-auto">
                          <FileStack className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 font-medium">
                          Aucun justificatif de paiement trouvé pour ce document.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="sm:justify-between pt-4 border-t border-blue-100/50 mt-auto">
                <div className="flex flex-wrap gap-2">
                  {selectedDocument && selectedDocument.status !== "Traité" && selectedDocument.status !== "Rejeté" && (
                    <>
                      <Button
                        variant="destructive"
                        onClick={() =>
                          selectedDocument &&
                          updateDocumentStatus(selectedDocument.id, statusToBackend("Rejeté"), "Rejeté")
                        }
                        className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg"
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Rejeter
                      </Button>
                      <Button
                        onClick={() =>
                          selectedDocument &&
                          updateDocumentStatus(selectedDocument.id, statusToBackend("Traité"), "Traité")
                        }
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" /> Marquer comme traité
                      </Button>
                    </>
                  )}
                  {selectedDocument &&
                    (selectedDocument.status === "Traité" || selectedDocument.status === "Rejeté") && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          selectedDocument &&
                          updateDocumentStatus(selectedDocument.id, statusToBackend("En cours"), "En cours")
                        }
                        className="border-blue-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700"
                      >
                        Remettre en cours
                      </Button>
                    )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsDetailsOpen(false)}
                  className="border-blue-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700"
                >
                  Fermer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </RequireAuth>
  )
}
