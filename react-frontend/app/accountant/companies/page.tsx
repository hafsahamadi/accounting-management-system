"use client"

import { useEffect, useState, useMemo, useCallback, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import RequireAuth from "@/components/RequireAuth"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  MoreHorizontal,
  Building,
  FolderArchive,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
  Edit,
  Trash2,
  FileText,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const API_BASE = "http://192.168.1.14:8000/api"

type Company = {
  id: number
  nom_entreprise: string
  nom: string
  prenom: string
  ICE: string
  adresse: string
  email: string
  telephone: string
  RC: string
  IF: string
  nom_utilisateur: string
  document_count: number
  created_at: string
  mot_de_passe?: string
  statut: "en_attente" | "validee" | "rejetee" | string
  raison_rejet?: string
  taille_totale_documents_entreprise?: number
  statut_abonnement_from_backend?: "actif" | "expiré" | "expire bientot" | "aucun" | string
  statut_abonnement_calculated?: FeCalculatedStatus
  date_fin_abonnement?: string | null
}

type FeCalculatedStatus = "actif" | "expiré" | "expire bientot" | "unknown" | "aucun"

type NewCompanyFormFields = {
  nom_entreprise: string
  nom: string
  prenom: string
  email: string
  adresse: string
  telephone: string
  RC: string
  ICE: string
  IF: string
  nom_utilisateur: string
  mot_de_passe: string
}

const formatFileSize = (bytes?: number, decimals = 2) => {
  if (bytes === undefined || bytes === null) return "N/A"
  if (bytes === 0) return "0 Octets"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Octets", "Ko", "Mo", "Go", "To", "Po", "Eo", "Zo", "Yo"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  if (i >= sizes.length) return (bytes / Math.pow(k, sizes.length - 1)).toFixed(dm) + " " + sizes[sizes.length - 1]
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

const calculateDynamicAbonnementStatus = (endDateISO: string | null | undefined): FeCalculatedStatus => {
  if (!endDateISO) return "aucun"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDateISO)
  end.setHours(0, 0, 0, 0)
  const diffTime = end.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "expiré"
  if (diffDays <= 30) return "expire bientot"
  return "actif"
}

const getStatusBadge = (status: FeCalculatedStatus | string | undefined | null): ReactNode => {
  switch (status?.toLowerCase()) {
    case "actif":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs px-2 py-0.5">
          <CheckCircle className="w-3 h-3 mr-1" />
          Actif
        </Badge>
      )
    case "expiré":
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs px-2 py-0.5">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Expiré
        </Badge>
      )
    case "expire bientot":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs px-2 py-0.5">
          <Calendar className="w-3 h-3 mr-1" />
          Expire bientôt
        </Badge>
      )
    case "aucun":
      return (
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          Aucun
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          {status || "Inconnu"}
        </Badge>
      )
  }
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedCompanyForDeletion, setSelectedCompanyForDeletion] = useState<Company | null>(null)
  const [deletionReason, setDeletionReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [accountantId, setAccountantId] = useState<number | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [newCompany, setNewCompany] = useState<NewCompanyFormFields>({
    nom_entreprise: "",
    nom: "",
    prenom: "",
    email: "",
    adresse: "",
    telephone: "",
    RC: "",
    ICE: "",
    IF: "",
    nom_utilisateur: "",
    mot_de_passe: "",
  })

  const fetchCompaniesList = useCallback(async (tokenToUse?: string | null) => {
    const currentToken = tokenToUse || sessionStorage.getItem("token")
    if (!currentToken) {
      setFetchError("Token d'authentification manquant.")
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`${API_BASE}/entreprises/formatted`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
          Accept: "application/json",
        },
      })
      if (!res.ok) {
        const errorText = await res.text()
        console.error("Échec du chargement des entreprises:", res.status, errorText)
        throw new Error(`Échec du chargement des entreprises (HTTP ${res.status}): ${errorText.substring(0, 200)}`)
      }
      const rawDataFromApi: any[] = await res.json()

      if (!Array.isArray(rawDataFromApi)) {
        console.error("La réponse de l'API pour /entreprises/formatted n'est pas un tableau:", rawDataFromApi)
        throw new Error("Format de données incorrect reçu de l'API (attendait un tableau).")
      }

      if (rawDataFromApi.length === 0) {
        setCompanies([])
        setLoading(false)
        return
      }

      const mappedAndCalculated: Company[] = rawDataFromApi
        .map((item: any) => {
          const dateFinAbo = item.date_fin_abonnement
          const calculatedStatus = calculateDynamicAbonnementStatus(dateFinAbo)

          return {
            id: item.id,
            nom_entreprise: item.nom_entreprise || item.name || "Nom Indisponible",
            nom: item.nom || "",
            prenom: item.prenom || "",
            ICE: item.ICE || item.siret || "ICE Indisponible",
            adresse: item.adresse || item.address || "",
            email: item.email || item.contact || "",
            telephone: item.telephone || item.phone || "",
            RC: item.RC || "",
            IF: item.IF || "",
            nom_utilisateur: item.nom_utilisateur || item.username || "",
            document_count: item.document_count ?? item.documents ?? 0,
            created_at: item.created_at,
            statut: item.statut || "en_attente",
            raison_rejet: item.raison_rejet,
            taille_totale_documents_entreprise: item.taille_totale_documents_entreprise ?? 0,
            statut_abonnement_from_backend: item.statut_abonnement || "aucun",
            statut_abonnement_calculated: calculatedStatus,
            date_fin_abonnement: dateFinAbo,
            mot_de_passe: undefined,
          }
        })
        .filter((company) => typeof company.id !== "undefined")
      setCompanies(mappedAndCalculated)
    } catch (err: any) {
      console.error("Erreur dans fetchCompaniesList:", err)
      setFetchError(err.message || "Erreur inconnue lors de la récupération des entreprises.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadInitialData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const token = sessionStorage.getItem("token")

    if (!token) {
      setFetchError("Authentification requise. Veuillez vous reconnecter.")
      setLoading(false)
      return
    }

    let profileFetchedSuccessfully = false
    try {
      const profileRes = await fetch(`${API_BASE}/profile`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      })

      if (!profileRes.ok) {
        const errorText = await profileRes.text().catch(() => "Could not read error response text.")
        console.error("Failed to fetch profile:", profileRes.status, errorText)
        throw new Error(`Échec du chargement du profil (HTTP ${profileRes.status}): ${errorText.substring(0, 200)}`)
      }
      const profileData = await profileRes.json()
      profileFetchedSuccessfully = true

      if (profileData && profileData.id) {
        setAccountantId(profileData.id)
        await fetchCompaniesList(token)
      } else {
        console.error("User ID not found in profile data:", profileData)
        throw new Error("ID du comptable non trouvé dans les données du profil.")
      }
    } catch (err: any) {
      console.error("Erreur lors du chargement des données initiales (loadInitialData):", err)
      setFetchError(err.message || "Erreur inconnue lors du chargement des données.")
      if (!profileFetchedSuccessfully) {
        setLoading(false)
      }
    }
  }, [fetchCompaniesList])

  useEffect(() => {
    if (typeof window !== "undefined") {
      loadInitialData()
    }
  }, [loadInitialData])

  const filteredCompanies = useMemo(() => {
    if (!Array.isArray(companies)) return []
    return companies.filter(
      (company) =>
        company.nom_entreprise?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (company.ICE && company.ICE.toLowerCase().includes(searchTerm.toLowerCase())),
    )
  }, [companies, searchTerm])

  const valideesEtEnAttenteCompanies = useMemo(() => {
    return filteredCompanies.filter((company) => company.statut === "validee" || company.statut === "en_attente")
  }, [filteredCompanies])

  const rejeteeCompanies = useMemo(() => {
    return filteredCompanies.filter((company) => company.statut === "rejetee")
  }, [filteredCompanies])

  const handleAddCompany = async () => {
    const token = sessionStorage.getItem("token")
    if (!token) {
      setFetchError("Authentification requise.")
      return
    }
    if (!accountantId) {
      setFetchError("ID du comptable non disponible.")
      return
    }

    const payload = { ...newCompany, id_comptable: accountantId }

    if (!newCompany.nom_entreprise?.trim() || !newCompany.email?.trim() || !newCompany.mot_de_passe?.trim()) {
      alert("Veuillez remplir tous les champs obligatoires (Nom entreprise, Email, Mot de passe).")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newCompany.email)) {
      alert("Veuillez entrer une adresse email valide.")
      return
    }

    setLoading(true)
    setFetchError(null)

    try {
      const res = await fetch(`${API_BASE}/entreprises`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let errorData
        const contentType = res.headers.get("content-type")

        if (contentType && contentType.includes("application/json")) {
          try {
            errorData = await res.json()
          } catch (jsonError) {
            errorData = { message: `Erreur HTTP ${res.status}` }
          }
        } else {
          const errorText = await res.text()
          errorData = { message: `Erreur HTTP ${res.status}: ${errorText}` }
        }

        let errorMessage = `Échec de l'ajout (HTTP ${res.status}).`
        switch (res.status) {
          case 401:
            errorMessage = "Session expirée. Veuillez vous reconnecter."
            break
          case 403:
            errorMessage = "Accès interdit. Permissions insuffisantes."
            break
          case 422:
            errorMessage = "Données invalides."
            break
          case 500:
            errorMessage = "Erreur serveur. Veuillez réessayer plus tard."
            break
        }
        if (errorData.errors && Object.keys(errorData.errors).length > 0) {
          errorMessage += "\n\nDétails:"
          for (const [field, messages] of Object.entries(errorData.errors as Record<string, string[]>)) {
            errorMessage += `\n• ${field}: ${messages.join(", ")}`
          }
        } else if (errorData.message) {
          errorMessage += `\n\nMessage: ${errorData.message}`
        }
        alert(errorMessage)
        throw new Error(errorMessage)
      }

      const responseData = await res.json()
      alert(responseData.message || "Entreprise ajoutée avec succès !")
      await fetchCompaniesList(token)
      setNewCompany({
        nom_entreprise: "",
        nom: "",
        prenom: "",
        email: "",
        adresse: "",
        telephone: "",
        RC: "",
        ICE: "",
        IF: "",
        nom_utilisateur: "",
        mot_de_passe: "",
      })
      setIsAddDialogOpen(false)
    } catch (err: any) {
      console.error("Erreur handleAddCompany:", err)
      setFetchError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openEditDialog = async (company: Company) => {
    const token = sessionStorage.getItem("token")
    if (!token) {
      setFetchError("Authentification requise.")
      return
    }
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`${API_BASE}/entreprises/${company.id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Impossible de charger les détails (HTTP ${res.status}): ${errorText.substring(0, 100)}`)
      }
      const companyData = await res.json()
      setSelectedCompany({
        id: companyData.id,
        nom_entreprise: companyData.nom_entreprise || companyData.name,
        nom: companyData.nom,
        prenom: companyData.prenom,
        ICE: companyData.ICE || companyData.siret,
        adresse: companyData.adresse || companyData.address,
        email: companyData.email || companyData.contact,
        telephone: companyData.telephone || companyData.phone,
        RC: companyData.RC,
        IF: companyData.IF,
        nom_utilisateur: companyData.nom_utilisateur,
        mot_de_passe: "",
        document_count: companyData.document_count,
        created_at: companyData.created_at,
        statut: companyData.statut || "en_attente",
        raison_rejet: companyData.raison_rejet,
        taille_totale_documents_entreprise:
          companyData.taille_totale_documents_entreprise ?? company.taille_totale_documents_entreprise ?? 0,
        statut_abonnement_from_backend:
          companyData.statut_abonnement ?? company.statut_abonnement_from_backend ?? "aucun",
        date_fin_abonnement: companyData.date_fin_abonnement ?? company.date_fin_abonnement,
        statut_abonnement_calculated: calculateDynamicAbonnementStatus(
          companyData.date_fin_abonnement ?? company.date_fin_abonnement,
        ),
      })
      setIsEditDialogOpen(true)
    } catch (err: any) {
      console.error("Erreur openEditDialog:", err)
      setFetchError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCompany = async () => {
    if (!selectedCompany || !selectedCompany.id) return
    const token = sessionStorage.getItem("token")
    if (!token) {
      setFetchError("Authentification requise.")
      return
    }

    const {
      id,
      created_at,
      document_count,
      statut,
      raison_rejet,
      taille_totale_documents_entreprise,
      statut_abonnement_from_backend,
      statut_abonnement_calculated,
      date_fin_abonnement,
      ...editableFields
    } = selectedCompany
    const payload: any = { ...editableFields }
    if (!payload.mot_de_passe) {
      delete payload.mot_de_passe
    }

    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`${API_BASE}/entreprises/${selectedCompany.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: `Erreur HTTP ${res.status}`, errors: {} }))
        let errorMessage = `Échec MAJ (HTTP ${res.status}).`
        if (errorData.errors && Object.keys(errorData.errors).length > 0) {
          errorMessage += "\nErreurs:\n"
          for (const key in errorData.errors) {
            errorMessage += `- ${key}: ${(errorData.errors as Record<string, string[]>)[key].join(", ")}\n`
          }
        } else if (errorData.message) {
          errorMessage += `\nMessage: ${errorData.message}`
        }
        alert(errorMessage)
        throw new Error(errorMessage)
      }
      const responseData = await res.json()
      alert(responseData.message || "Entreprise mise à jour !")
      await fetchCompaniesList(token)
      setIsEditDialogOpen(false)
      setSelectedCompany(null)
    } catch (err: any) {
      console.error("Erreur handleUpdateCompany:", err)
      setFetchError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestDeletion = (company: Company) => {
    setSelectedCompanyForDeletion(company)
    setIsDeleteDialogOpen(true)
  }

  const submitDeletionRequest = async () => {
    if (!deletionReason.trim()) {
      alert("Veuillez indiquer une raison.")
      return
    }
    if (!selectedCompanyForDeletion) return
    const token = sessionStorage.getItem("token")
    if (!token) {
      setFetchError("Authentification requise.")
      return
    }
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`${API_BASE}/entreprises/${selectedCompanyForDeletion.id}/demande-suppression`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ raison: deletionReason }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || `Erreur ${res.status}`)
      }
      alert(data.message || "Demande de suppression envoyée.")
      setIsDeleteDialogOpen(false)
      setDeletionReason("")
      setSelectedCompanyForDeletion(null)
      await fetchCompaniesList(token)
    } catch (err: any) {
      console.error("Erreur submitDeletionRequest:", err)
      setFetchError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const addFormFields: Array<keyof NewCompanyFormFields> = [
    "nom_entreprise",
    "nom",
    "prenom",
    "email",
    "adresse",
    "telephone",
    "RC",
    "ICE",
    "IF",
    "nom_utilisateur",
    "mot_de_passe",
  ]

  const editFormFields: Array<
    keyof Omit<
      Company,
      | "id"
      | "document_count"
      | "created_at"
      | "statut"
      | "raison_rejet"
      | "taille_totale_documents_entreprise"
      | "statut_abonnement_from_backend"
      | "statut_abonnement_calculated"
      | "date_fin_abonnement"
    >
  > = [
    "nom_entreprise",
    "nom",
    "prenom",
    "email",
    "adresse",
    "telephone",
    "RC",
    "ICE",
    "IF",
    "nom_utilisateur",
    "mot_de_passe",
  ]

  if (fetchError && !loading && companies.length === 0) {
    return (
      <RequireAuth>
        <DashboardLayout role="accountant">
          <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] p-6">
              <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-red-200/20 max-w-md">
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="h-16 w-16 mb-4 text-red-400 mx-auto" />
                  <h3 className="text-xl font-semibold mb-2 text-red-600">Erreur de chargement</h3>
                  <p className="mb-6 text-red-500">{fetchError}</p>
                  <Button
                    onClick={() => typeof window !== "undefined" && loadInitialData()}
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

  if (loading && companies.length === 0 && !fetchError) {
    return (
      <RequireAuth>
        <DashboardLayout role="accountant">
          <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
            <div className="flex justify-center items-center h-[calc(100vh-150px)]">
              <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-emerald-200/20 p-8">
                <CardContent className="flex items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  <p className="text-gray-600 font-medium">Chargement des entreprises...</p>
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
      <DashboardLayout role="accountant">
        <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
          {/* Background decorative elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-emerald-200/30 to-teal-300/30 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-200/30 to-indigo-300/30 rounded-full blur-3xl"></div>
          </div>

          <div className="relative space-y-8 p-6">
            {/* Header Section */}
            <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-emerald-200/20">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl p-3 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg">
                      <Building className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
                        Gestion des Entreprises
                      </CardTitle>
                      <CardDescription className="text-gray-600 mt-1">
                        Gérez vos entreprises clientes sur Cleverbills
                      </CardDescription>
                    </div>
                  </div>

                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        disabled={loading}
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter Entreprise
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto backdrop-blur-md bg-white/95 border-0 shadow-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-gray-800">Nouvelle entreprise</DialogTitle>
                        <DialogDescription className="text-gray-600">
                          Ajoutez une nouvelle entreprise à votre portefeuille client.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={(e: FormEvent<HTMLFormElement>) => {
                          e.preventDefault()
                          handleAddCompany()
                        }}
                      >
                        <div className="grid gap-4 py-4">
                          {addFormFields.map((key) => (
                            <div className="grid grid-cols-4 items-center gap-4" key={key}>
                              <Label
                                htmlFor={key}
                                className="text-right col-span-1 capitalize text-sm font-medium text-gray-700"
                              >
                                {key.replace(/_/g, " ")}
                              </Label>
                              <Input
                                id={key}
                                type={key === "mot_de_passe" ? "password" : "text"}
                                value={newCompany[key]}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                  setNewCompany({
                                    ...newCompany,
                                    [key as keyof NewCompanyFormFields]: e.target.value,
                                  })
                                }
                                className="col-span-3 h-11 border-gray-200 focus:border-emerald-400 rounded-lg"
                              />
                            </div>
                          ))}
                        </div>
                        <DialogFooter className="gap-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsAddDialogOpen(false)}
                            disabled={loading}
                            className="border-gray-200 hover:bg-gray-50"
                          >
                            Annuler
                          </Button>
                          <Button
                            type="submit"
                            disabled={loading}
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                          >
                            {loading && isAddDialogOpen ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                            Ajouter
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
            </Card>

            {/* Search and Tabs Section */}
            <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-emerald-200/20">
              <CardContent className="p-6">
                <Tabs defaultValue="validees_attente" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-emerald-50/80 p-1.5 rounded-xl border border-emerald-100/50">
                    <TabsTrigger
                      value="validees_attente"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg transition-all duration-300 text-gray-700 hover:text-emerald-700 py-3 font-semibold"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Validées & En Attente ({valideesEtEnAttenteCompanies.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="rejetees"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg transition-all duration-300 text-gray-700 hover:text-red-700 py-3 font-semibold"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Rejetées ({rejeteeCompanies.length})
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-3 mb-6">
                    <div className="rounded-lg p-2 bg-gradient-to-r from-blue-100 to-indigo-100">
                      <Search className="h-4 w-4 text-blue-600" />
                    </div>
                    <Input
                      placeholder="Rechercher par nom ou ICE..."
                      className="max-w-sm h-11 border-gray-200 focus:border-emerald-400 rounded-lg"
                      value={searchTerm}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        {filteredCompanies.length} résultat{filteredCompanies.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>

                  <TabsContent value="validees_attente" className="space-y-4">
                    <div className="rounded-xl border border-gray-100/50 overflow-hidden backdrop-blur-sm bg-white/50">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50 hover:from-emerald-50/70 hover:to-teal-50/70">
                            <TableHead className="min-w-[180px] whitespace-nowrap font-semibold text-gray-700">
                              Nom Entreprise
                            </TableHead>
                            <TableHead className="hidden sm:table-cell min-w-[120px] whitespace-nowrap font-semibold text-gray-700">
                              ICE
                            </TableHead>
                            <TableHead className="hidden md:table-cell text-center min-w-[80px] whitespace-nowrap font-semibold text-gray-700">
                              Documents
                            </TableHead>
                            <TableHead className="text-center min-w-[130px] whitespace-nowrap font-semibold text-gray-700">
                              Capacité
                            </TableHead>
                            <TableHead className="min-w-[130px] whitespace-nowrap font-semibold text-gray-700">
                              Abonnement
                            </TableHead>
                            <TableHead className="min-w-[120px] whitespace-nowrap font-semibold text-gray-700">
                              Statut
                            </TableHead>
                            <TableHead className="hidden lg:table-cell min-w-[120px] whitespace-nowrap font-semibold text-gray-700">
                              Date d'ajout
                            </TableHead>
                            <TableHead className="text-right min-w-[100px] whitespace-nowrap font-semibold text-gray-700">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {valideesEtEnAttenteCompanies.length > 0 ? (
                            valideesEtEnAttenteCompanies.map((companyItem) => (
                              <TableRow
                                key={companyItem.id}
                                className="hover:bg-gradient-to-r hover:from-emerald-50/30 hover:to-teal-50/30 transition-all duration-200"
                              >
                                <TableCell className="font-medium py-3 text-gray-900">
                                  {companyItem.nom_entreprise}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell py-3 text-gray-700">
                                  {companyItem.ICE}
                                </TableCell>
                                <TableCell className="text-center py-3">
                                  <Link
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 hover:from-blue-200 hover:to-indigo-200 transition-all duration-200 font-medium"
                                    href={`/accountant/documents?company=${encodeURIComponent(companyItem.nom_entreprise)}`}
                                  >
                                    <FileText className="h-3 w-3" />
                                    {companyItem.document_count}
                                  </Link>
                                </TableCell>
                                <TableCell className="text-center py-3">
                                  <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                                    <FolderArchive className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    {formatFileSize(companyItem.taille_totale_documents_entreprise)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Link
                                    href={`/accountant/subscriptions?company=${encodeURIComponent(companyItem.nom_entreprise)}`}
                                    className="inline-block"
                                  >
                                    {getStatusBadge(companyItem.statut_abonnement_calculated)}
                                  </Link>
                                </TableCell>
                                <TableCell className="py-3">
                                  <Badge
                                    className={`text-xs px-2 py-0.5 capitalize ${
                                      companyItem.statut === "validee"
                                        ? "bg-green-100 text-green-700 hover:bg-green-100"
                                        : "bg-amber-100 text-amber-700 hover:bg-amber-100"
                                    }`}
                                  >
                                    {companyItem.statut === "validee"
                                      ? "Validée"
                                      : companyItem.statut
                                        ? companyItem.statut.replace("_", " ")
                                        : "Inconnu"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell py-3 text-gray-600">
                                  {companyItem.created_at
                                    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
                                        new Date(companyItem.created_at),
                                      )
                                    : "N/A"}
                                </TableCell>
                                <TableCell className="text-right py-3">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-lg hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50"
                                        disabled={loading}
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="backdrop-blur-md bg-white/95 border-0 shadow-xl"
                                    >
                                      <DropdownMenuItem asChild>
                                        <Link
                                          href={`/accountant/documents?company=${encodeURIComponent(companyItem.nom_entreprise)}`}
                                          className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
                                        >
                                          <FileText className="mr-2 h-4 w-4" />
                                          Voir les documents
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => openEditDialog(companyItem)}
                                        disabled={loading}
                                        className="hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50"
                                      >
                                        <Edit className="mr-2 h-4 w-4" />
                                        Modifier
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                        onClick={() => handleRequestDeletion(companyItem)}
                                        disabled={loading}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Demander suppression
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center h-32">
                                <div className="flex flex-col items-center gap-3">
                                  <Building className="h-12 w-12 text-gray-300" />
                                  <p className="text-gray-500 font-medium">
                                    {loading && companies.length === 0
                                      ? "Chargement..."
                                      : searchTerm
                                        ? "Aucune entreprise validée ou en attente ne correspond à votre recherche."
                                        : "Aucune entreprise validée ou en attente."}
                                  </p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="rejetees" className="space-y-4">
                    <div className="rounded-xl border border-red-100/50 overflow-hidden backdrop-blur-sm bg-red-50/20">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-red-50/50 to-red-50/50 hover:from-red-50/70 hover:to-red-50/70">
                            <TableHead className="min-w-[180px] whitespace-nowrap font-semibold text-gray-700">
                              Nom Entreprise
                            </TableHead>
                            <TableHead className="hidden sm:table-cell min-w-[120px] whitespace-nowrap font-semibold text-gray-700">
                              ICE
                            </TableHead>
                            <TableHead className="min-w-[200px] whitespace-nowrap font-semibold text-gray-700">
                              Raison du Rejet
                            </TableHead>
                            <TableHead className="hidden lg:table-cell min-w-[120px] whitespace-nowrap font-semibold text-gray-700">
                              Créée le
                            </TableHead>
                            <TableHead className="text-right min-w-[100px] whitespace-nowrap font-semibold text-gray-700">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rejeteeCompanies.length > 0 ? (
                            rejeteeCompanies.map((companyItem) => (
                              <TableRow
                                key={companyItem.id}
                                className="hover:bg-red-100/50 transition-all duration-200"
                              >
                                <TableCell className="font-medium py-3 text-gray-900">
                                  {companyItem.nom_entreprise}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell py-3 text-gray-700">
                                  {companyItem.ICE}
                                </TableCell>
                                <TableCell className="py-3 text-red-600">
                                  <TooltipProvider>
                                    <Tooltip delayDuration={100}>
                                      <TooltipTrigger asChild>
                                        <span className="block max-w-xs truncate">
                                          {companyItem.raison_rejet || "Aucune raison spécifiée"}
                                        </span>
                                      </TooltipTrigger>
                                      {companyItem.raison_rejet && companyItem.raison_rejet.length > 40 && (
                                        <TooltipContent className="max-w-xs z-50 bg-background border shadow-lg p-2 rounded-md">
                                          <p className="font-semibold text-foreground">Raison complète :</p>
                                          <p className="text-muted-foreground whitespace-pre-wrap">
                                            {companyItem.raison_rejet}
                                          </p>
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell py-3 text-gray-600">
                                  {companyItem.created_at
                                    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
                                        new Date(companyItem.created_at),
                                      )
                                    : "N/A"}
                                </TableCell>
                                <TableCell className="text-right py-3">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-lg hover:bg-red-50"
                                        disabled={loading}
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="backdrop-blur-md bg-white/95 border-0 shadow-xl"
                                    >
                                      <DropdownMenuItem
                                        onClick={() => openEditDialog(companyItem)}
                                        disabled={loading}
                                        className="hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50"
                                      >
                                        <Edit className="mr-2 h-4 w-4" />
                                        Modifier et Resoumettre
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center h-32">
                                <div className="flex flex-col items-center gap-3">
                                  <AlertTriangle className="h-12 w-12 text-gray-300" />
                                  <p className="text-gray-500 font-medium">
                                    {loading && companies.length === 0
                                      ? "Chargement..."
                                      : searchTerm
                                        ? "Aucune entreprise rejetée ne correspond à votre recherche."
                                        : "Aucune entreprise rejetée."}
                                  </p>
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
          </div>

          {/* Delete Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="backdrop-blur-md bg-white/95 border-0 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-gray-800">
                  Demander la suppression de l'entreprise
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Vous êtes sur le point de demander la suppression de l'entreprise "
                  {selectedCompanyForDeletion?.nom_entreprise}". Cette action est soumise à validation par
                  l'administrateur. Veuillez indiquer une raison.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e: FormEvent<HTMLFormElement>) => {
                  e.preventDefault()
                  submitDeletionRequest()
                }}
              >
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason" className="text-sm font-medium text-gray-700">
                      Raison de la demande (obligatoire)
                    </Label>
                    <Textarea
                      id="reason"
                      value={deletionReason}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDeletionReason(e.target.value)}
                      rows={3}
                      placeholder="Expliquez pourquoi cette entreprise doit être supprimée..."
                      className="border-gray-200 focus:border-red-400 rounded-lg"
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDeleteDialogOpen(false)}
                    disabled={loading}
                    className="border-gray-200 hover:bg-gray-50"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={!deletionReason.trim() || loading}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                  >
                    {loading && isDeleteDialogOpen ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                    Envoyer la demande
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px] backdrop-blur-md bg-white/95 border-0 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-gray-800">Modifier l'entreprise</DialogTitle>
                <DialogDescription className="text-gray-600">
                  Modifiez les informations de l'entreprise "{selectedCompany?.nom_entreprise}".
                </DialogDescription>
              </DialogHeader>
              {selectedCompany && (
                <form
                  onSubmit={(e: FormEvent<HTMLFormElement>) => {
                    e.preventDefault()
                    handleUpdateCompany()
                  }}
                >
                  <div className="grid gap-4 py-4">
                    {editFormFields.map((key) => (
                      <div className="grid grid-cols-4 items-center gap-4" key={key}>
                        <Label
                          htmlFor={`edit-${key}`}
                          className="text-right col-span-1 capitalize text-sm font-medium text-gray-700"
                        >
                          {(key as string).replace(/_/g, " ")}
                          {key === "mot_de_passe" && (
                            <span className="block text-xs text-gray-500">(Laisser vide pour ne pas changer)</span>
                          )}
                        </Label>
                        <Input
                          id={`edit-${key}`}
                          type={key === "mot_de_passe" ? "password" : "text"}
                          value={(
                            (selectedCompany[key as keyof typeof selectedCompany] as string | number) || ""
                          ).toString()}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setSelectedCompany((prev) =>
                              prev ? { ...prev, [key as keyof typeof selectedCompany]: e.target.value } : null,
                            )
                          }
                          className="col-span-3 h-11 border-gray-200 focus:border-emerald-400 rounded-lg"
                          autoComplete={key === "mot_de_passe" ? "new-password" : "off"}
                        />
                      </div>
                    ))}
                  </div>
                  <DialogFooter className="gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditDialogOpen(false)}
                      disabled={loading}
                      className="border-gray-200 hover:bg-gray-50"
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                    >
                      {loading && isEditDialogOpen ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </RequireAuth>
  )
}
