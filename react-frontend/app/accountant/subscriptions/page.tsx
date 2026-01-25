"use client"

import { useState, useEffect, type ChangeEvent, type FormEvent, type ReactNode, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import RequireAuth from "@/components/RequireAuth"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Search,
  Eye,
  RefreshCw,
  Calendar,
  Building,
  AlertTriangle,
  CheckCircle,
  Loader2,
  PlusCircle,
  Filter,
  CreditCard,
  TrendingUp,
  Settings,
  Check,
  X,
  Clock,
  FileText,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// --- Utilisation de REACT_APP_API_URL ---
// API_BASE contiendra l'URL complète AVEC /api, ex: http://192.168.1.14:8000/api
const API_BASE = process.env.REACT_APP_API_URL || "http://192.168.1.14:8000/api"

// --- Définition des Types ---
interface EntrepriseFromAPI {
  id: number
  nom_entreprise?: string
  ICE?: string
}

interface EntrepriseSelectItem {
  id: number
  nom_entreprise: string
}

interface PlanFromAPI {
  id: number
  nom: string
  espace_max: number
  prix: number
}

type ApiStatus = "actif" | "expiré"
type ApiEtatValidation = "en_attente" | "valide" | "refuse"
type ApiType = "initial" | "renouvellement" | "upgrade"

interface SubscriptionFromAPI {
  id: number
  id_entreprise: number
  plan_id: number
  entreprise?: EntrepriseFromAPI
  plan?: PlanFromAPI
  date_debut: string
  date_fin: string
  montant: number
  statut: ApiStatus
  etat_validation: ApiEtatValidation
  type: ApiType
  justificatif_path?: string
}

type FeStatus = "actif" | "expiré" | "expire bientot" | "en_attente" | "valide" | "refuse" | "unknown"

interface SubscriptionFE {
  id: number
  companyId: number
  companyName: string
  ICE: string
  planId: number
  planName: string
  planPrice: number
  planStorage: number
  startDate: string
  endDate: string
  endDateISO: string
  amount: number
  status: FeStatus
  etatValidation: ApiEtatValidation
  type: ApiType
  justificatifPath?: string
}

interface ApiError {
  message?: string
  errors?: Record<string, string[]>
}

interface NewSubscriptionForm {
  id_entreprise: string
  plan_id: string
  date_debut: string
  date_fin: string
  montant: string
  type: ApiType
}

interface RenewalForm {
  plan_id: string
  date_debut: string
  date_fin: string
  montant: string
  type: ApiType
}

// --- Fonctions Helper Typées ---
const formatDateToDisplay = (dateString: string | null | undefined): string => {
  if (!dateString) return ""
  // Gérer le cas où la date est déjà au format DD/MM/YYYY
  if (dateString.includes("/") && dateString.split("/").length === 3 && dateString.split("/")[2].length === 4) {
    return dateString
  }
  // Tenter de parser YYYY-MM-DD
  const parts = dateString.split("-")
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  // Tenter de parser une date ISO complète
  try {
    const d = new Date(dateString)
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
    }
  } catch (e) {
    /* ignorer l'erreur de parsing */
  }
  return dateString // Retourner la chaîne originale si le format n'est pas reconnu
}

const formatDateToISO = (dateString: string): string => {
  if (!dateString) return ""
  // Si c'est déjà au format YYYY-MM-DD
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString
  }
  // Si c'est au format DD/MM/YYYY
  if (dateString.includes("/")) {
    const parts = dateString.split("/")
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
    }
  }
  return dateString
}

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return "N/A"
  return `${amount.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`
}

const getAuthToken = (): string | null => {
  // Essayer de récupérer le token uniquement depuis sessionStorage
  return sessionStorage.getItem("token")
}

const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export default function SubscriptionsPage(): ReactNode {
  const [subscriptions, setSubscriptions] = useState<SubscriptionFE[]>([])
  const [plans, setPlans] = useState<PlanFromAPI[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [planFilter, setPlanFilter] = useState<string>("all")
  const [validationFilter, setValidationFilter] = useState<string>("all")
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionFE | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false)
  const [isRenewalOpen, setIsRenewalOpen] = useState<boolean>(false)
  const [isRenewing, setIsRenewing] = useState<boolean>(false)
  const [companyFilter, setCompanyFilter] = useState("all")
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false)
  const [newSubscriptionData, setNewSubscriptionData] = useState<NewSubscriptionForm>({
    id_entreprise: "",
    plan_id: "",
    date_debut: "",
    date_fin: "",
    montant: "",
    type: "initial",
  })
  const [renewalData, setRenewalData] = useState<RenewalForm>({
    plan_id: "",
    date_debut: "",
    date_fin: "",
    montant: "",
    type: "renouvellement",
  })
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [renewalErrors, setRenewalErrors] = useState<Record<string, string>>({})
  const [isValidating, setIsValidating] = useState<boolean>(false)
  const [isRejecting, setIsRejecting] = useState<boolean>(false)
  const [processingSubscriptionId, setProcessingSubscriptionId] = useState<number | null>(null)

  const [entreprisesList, setEntreprisesList] = useState<EntrepriseSelectItem[]>([])
  const [isLoadingEntreprises, setIsLoadingEntreprises] = useState<boolean>(false)
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(false)

  const searchParams = useSearchParams()
  const companyParam = searchParams.get("company")

  useEffect(() => {
    if (companyParam) {
      setCompanyFilter(companyParam)
    }
  }, [companyParam])

  const calculateDynamicStatus = (
    endDateISO: string | null | undefined,
    apiStatus: ApiStatus,
    etatValidation: ApiEtatValidation,
  ): FeStatus => {
    // Si l'état de validation est en attente ou refusé, on le priorise
    if (etatValidation === "en_attente") return "en_attente"
    if (etatValidation === "refuse") return "refuse"
    if (etatValidation === "valide" && apiStatus === "actif") {
      // Calculer le statut basé sur la date
      if (!endDateISO) return "unknown"
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
    return apiStatus as FeStatus
  }

  const handleAuthError = (customError?: Error) => {
    const errorMessage = customError?.message || "Session expirée ou token invalide. Veuillez vous reconnecter."
    console.error("Authentication error:", errorMessage)
    setError(errorMessage)
  }

  const checkApiBaseUrl = () => {
    if (!API_BASE || !API_BASE.startsWith("http")) {
      console.error(
        "Erreur critique : REACT_APP_API_URL n'est pas défini correctement ou n'est pas une URL valide. Vérifiez votre .env et next.config.js.",
      )
      setError("Erreur de configuration du serveur.")
      setIsLoading(false)
      setIsLoadingEntreprises(false)
      setIsLoadingPlans(false)
      return false
    }
    return true
  }

  const fetchPlans = useCallback(async (): Promise<void> => {
    if (!checkApiBaseUrl()) return
    setIsLoadingPlans(true)

    try {
      const headers = getAuthHeaders()
      if (!headers.Authorization) {
        handleAuthError(new Error("Token non trouvé pour charger les plans."))
        setIsLoadingPlans(false)
        return
      }

      const response = await fetch(`${API_BASE}/plans`, {
        method: "GET",
        headers,
      })

      if (response.status === 401) {
        handleAuthError(new Error("Token invalide ou expiré (plans)."))
        setIsLoadingPlans(false)
        return
      }

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const data = (await response.json()) as PlanFromAPI[]
      setPlans(data)
    } catch (e: any) {
      console.error("Failed to fetch plans:", e)
      if (e.message.includes("Token invalide") || e.message.includes("401")) {
        handleAuthError(e)
      } else {
        setError(e.message || "Erreur lors du chargement des plans.")
      }
    } finally {
      setIsLoadingPlans(false)
    }
  }, [])

  const fetchEntreprises = useCallback(async (): Promise<void> => {
    if (!checkApiBaseUrl()) return
    setIsLoadingEntreprises(true)
    setFormErrors((prev) => ({ ...prev, id_entreprise: "" }))

    try {
      const headers = getAuthHeaders()
      if (!headers.Authorization) {
        handleAuthError(new Error("Token non trouvé pour charger les entreprises."))
        setIsLoadingEntreprises(false)
        return
      }

      const response = await fetch(`${API_BASE}/entreprises/listE`, {
        method: "GET",
        headers,
      })

      if (response.status === 401) {
        handleAuthError(new Error("Token invalide ou expiré (entreprises)."))
        setIsLoadingEntreprises(false)
        return
      }

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const data = (await response.json()) as EntrepriseSelectItem[]
      setEntreprisesList(data)
    } catch (e: any) {
      console.error("Failed to fetch entreprises:", e)
      if (e.message.includes("Token invalide") || e.message.includes("401")) {
        handleAuthError(e)
      } else {
        setFormErrors((prev) => ({
          ...prev,
          id_entreprise: `Erreur chargement entreprises: ${e.message}`,
        }))
      }
    } finally {
      setIsLoadingEntreprises(false)
    }
  }, [])

  const fetchSubscriptions = useCallback(async (): Promise<void> => {
    if (!checkApiBaseUrl()) return
    setIsLoading(true)
    setError(null)

    try {
      const headers = getAuthHeaders()
      if (!headers.Authorization) {
        handleAuthError(new Error("Token non trouvé pour charger les abonnements."))
        setIsLoading(false)
        return
      }

      // Utiliser indexadmin pour les admins
      const response = await fetch(`${API_BASE}/abonnements`, {
        method: "GET",
        headers,
      })

      if (response.status === 401) {
        handleAuthError(new Error("Token invalide ou expiré (abonnements)."))
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const data = (await response.json()) as SubscriptionFromAPI[]

      const adaptedData: SubscriptionFE[] = data.map((sub) => ({
        id: sub.id,
        companyId: sub.id_entreprise,
        companyName: sub.entreprise?.nom_entreprise || "N/A",
        ICE: sub.entreprise?.ICE || "N/A",
        planId: sub.plan_id,
        planName: sub.plan?.nom || "N/A",
        planPrice: sub.plan?.prix || 0,
        planStorage: sub.plan?.espace_max || 0,
        startDate: formatDateToDisplay(sub.date_debut),
        endDate: formatDateToDisplay(sub.date_fin),
        endDateISO: sub.date_fin,
        amount: sub.montant,
        status: calculateDynamicStatus(sub.date_fin, sub.statut, sub.etat_validation),
        etatValidation: sub.etat_validation,
        type: sub.type,
        justificatifPath: sub.justificatif_path,
      }))

      setSubscriptions(adaptedData)
    } catch (e: any) {
      console.error("Failed to fetch subscriptions:", e)
      if (e.message.includes("Token invalide") || e.message.includes("401")) {
        handleAuthError(e)
      } else {
        setError(e.message || "Erreur lors du chargement des abonnements.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const [activeSubscriptionCompanyIds, setActiveSubscriptionCompanyIds] = useState<number[]>([])

  useEffect(() => {
    const activeIds = subscriptions.filter((sub) => sub.status === "actif").map((sub) => sub.companyId)
    setActiveSubscriptionCompanyIds(activeIds)
  }, [subscriptions])

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setError("Aucun token d'authentification trouvé. Veuillez vous connecter.")
      setIsLoading(false)
      return
    }
    fetchSubscriptions()
    fetchEntreprises()
    fetchPlans()
  }, [fetchSubscriptions, fetchEntreprises, fetchPlans])

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setNewSubscriptionData((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }))
  }

  const handleRenewalInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setRenewalData((prev) => ({ ...prev, [name]: value }))
    if (renewalErrors[name]) setRenewalErrors((prev) => ({ ...prev, [name]: "" }))
  }

  const handleSelectChange = (name: keyof NewSubscriptionForm, value: string) => {
    setNewSubscriptionData((prev) => ({ ...prev, [name]: value as any }))
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }))

    // Auto-remplir le montant quand un plan est sélectionné
    if (name === "plan_id" && value) {
      const selectedPlan = plans.find((plan) => plan.id === Number(value))
      if (selectedPlan) {
        setNewSubscriptionData((prev) => ({ ...prev, montant: selectedPlan.prix.toString() }))
      }
    }
  }

  const handleRenewalSelectChange = (name: keyof RenewalForm, value: string) => {
    setRenewalData((prev) => ({ ...prev, [name]: value as any }))
    if (renewalErrors[name]) setRenewalErrors((prev) => ({ ...prev, [name]: "" }))

    // Auto-remplir le montant quand un plan est sélectionné pour le renouvellement
    if (name === "plan_id" && value) {
      const selectedPlan = plans.find((plan) => plan.id === Number(value))
      if (selectedPlan) {
        setRenewalData((prev) => ({ ...prev, montant: selectedPlan.prix.toString() }))
      }
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!newSubscriptionData.id_entreprise) errors.id_entreprise = "Veuillez sélectionner une entreprise."
    if (!newSubscriptionData.plan_id) errors.plan_id = "Le plan est requis."
    if (!newSubscriptionData.date_debut) errors.date_debut = "La date de début est requise."
    if (!newSubscriptionData.date_fin) errors.date_fin = "La date de fin est requise."
    else if (
      newSubscriptionData.date_debut &&
      newSubscriptionData.date_fin &&
      new Date(newSubscriptionData.date_fin) < new Date(newSubscriptionData.date_debut)
    ) {
      errors.date_fin = "La date de fin ne peut être antérieure à la date de début."
    }
    if (!newSubscriptionData.montant.trim()) errors.montant = "Le montant est requis."
    else if (Number.isNaN(Number(newSubscriptionData.montant))) errors.montant = "Le montant doit être un nombre."
    else if (Number(newSubscriptionData.montant) < 0) errors.montant = "Le montant ne peut être négatif."
    if (!newSubscriptionData.type) errors.type = "Le type est requis."
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateRenewalForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!renewalData.plan_id) errors.plan_id = "Le plan est requis."
    if (!renewalData.date_debut) errors.date_debut = "La date de début est requise."
    if (!renewalData.date_fin) errors.date_fin = "La date de fin est requise."
    else if (
      renewalData.date_debut &&
      renewalData.date_fin &&
      new Date(renewalData.date_fin) < new Date(renewalData.date_debut)
    ) {
      errors.date_fin = "La date de fin ne peut être antérieure à la date de début."
    }
    if (!renewalData.montant.trim()) errors.montant = "Le montant est requis."
    else if (Number.isNaN(Number(renewalData.montant))) errors.montant = "Le montant doit être un nombre."
    else if (Number(renewalData.montant) < 0) errors.montant = "Le montant ne peut être négatif."
    setRenewalErrors(errors)
    return Object.keys(errors).length === 0
  }


  // Fichier: SubscriptionsPage.tsx - à modifier


 

  

  const uniquePlansFromData: string[] =
    subscriptions.length > 0 ? [...new Set(subscriptions.map((sub) => sub.planName))] : []

  const filteredSubscriptions: SubscriptionFE[] = subscriptions.filter(
    (sub) =>
      (sub.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.ICE && sub.ICE.toLowerCase().includes(searchTerm.toLowerCase()))) &&
      (statusFilter === "all" || sub.status === statusFilter) &&
      (planFilter === "all" || sub.planName === planFilter) &&
      (validationFilter === "all" || sub.etatValidation === validationFilter) &&
      (companyFilter === "all" || sub.companyName === companyFilter),
  )

  const viewDetails = (subscription: SubscriptionFE): void => {
    setSelectedSubscription(subscription)
    setIsDetailsOpen(true)
  }

  const renewSubscription = (subscription: SubscriptionFE): void => {
    setSelectedSubscription(subscription)

    // Calculer les dates par défaut pour le renouvellement
    const today = new Date()
    const currentEndDate = new Date(subscription.endDateISO)

    let startDate: Date
    let endDate: Date

    if (currentEndDate < today) {
      // Si l'abonnement est expiré, commencer aujourd'hui
      startDate = today
      endDate = new Date(today)
      endDate.setFullYear(endDate.getFullYear() + 1)
    } else {
      // Si l'abonnement est encore valide, commencer à la fin de l'abonnement actuel
      startDate = new Date(currentEndDate)
      startDate.setDate(startDate.getDate() + 1) // Commencer le jour suivant
      endDate = new Date(startDate)
      endDate.setFullYear(endDate.getFullYear() + 1)
    }

    // Pré-remplir le formulaire de renouvellement
    setRenewalData({
      plan_id: subscription.planId.toString(),
      date_debut: startDate.toISOString().split("T")[0],
      date_fin: endDate.toISOString().split("T")[0],
      montant: subscription.planPrice.toString(),
      type: "renouvellement",
    })

    setRenewalErrors({})
    setIsRenewalOpen(true)
  }

  const getStatusBadge = (status: FeStatus | undefined | null): ReactNode => {
    switch (status?.toLowerCase()) {
      case "actif":
        return (
          <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md">
            <CheckCircle className="w-3 h-3 mr-1" />
            Actif
          </Badge>
        )
      case "expiré":
        return (
          <Badge variant="destructive" className="bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Expiré
          </Badge>
        )
      case "expire bientot":
        return (
          <Badge
            variant="secondary"
            className="bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-md hover:from-orange-500 hover:to-amber-600"
          >
            <Calendar className="w-3 h-3 mr-1" />
            Expire bientôt
          </Badge>
        )
      case "en_attente":
        return (
          <Badge
            variant="outline"
            className="bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border-yellow-300 shadow-md"
          >
            <Clock className="w-3 h-3 mr-1" />
            En attente
          </Badge>
        )
      case "valide":
        return (
          <Badge variant="default" className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md">
            <Check className="w-3 h-3 mr-1" />
            Validé
          </Badge>
        )
      case "refuse":
        return (
          <Badge variant="destructive" className="bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md">
            <X className="w-3 h-3 mr-1" />
            Refusé
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700">
            {status || "Inconnu"}
          </Badge>
        )
    }
  }

  const getValidationBadge = (etatValidation: ApiEtatValidation): ReactNode => {
    switch (etatValidation) {
      case "en_attente":
        return (
          <Badge
            variant="outline"
            className="bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border-yellow-300"
          >
            <Clock className="w-3 h-3 mr-1" />
            En attente
          </Badge>
        )
      case "valide":
        return (
          <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <Check className="w-3 h-3 mr-1" />
            Validé
          </Badge>
        )
      case "refuse":
        return (
          <Badge variant="destructive" className="bg-gradient-to-r from-red-500 to-rose-600 text-white">
            <X className="w-3 h-3 mr-1" />
            Refusé
          </Badge>
        )
    }
  }

  const getDaysRemaining = (endDateISO: string | null | undefined): number => {
    if (!endDateISO) return 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date(endDateISO)
    end.setHours(0, 0, 0, 0)
    const diffTime = end.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const activeCount = subscriptions.filter((sub) => sub.status === "actif").length
  const expiredCount = subscriptions.filter((sub) => sub.status === "expiré").length
  const expiringSoonCount = subscriptions.filter((sub) => sub.status === "expire bientot").length
  const pendingCount = subscriptions.filter((sub) => sub.etatValidation === "en_attente").length

  if (isLoading && !error) {
    return (
      <DashboardLayout role="accountant">
        <div className="flex justify-center items-center h-[calc(100vh-var(--header-height,80px))]">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-3 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
            <p className="text-xl font-medium text-gray-700">Chargement des abonnements...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (
    error &&
    (error.includes("Token") || error.includes("Session expirée") || error.includes("Authentification requise"))
  ) {
    return (
      <DashboardLayout role="accountant">
        <div className="flex flex-col justify-center items-center h-[calc(100vh-var(--header-height,80px))] p-6 text-center">
          <div className="backdrop-blur-md bg-red-50/90 border border-red-200/50 rounded-xl p-8 shadow-lg shadow-red-100/50 max-w-md">
            <div className="rounded-lg p-3 bg-gradient-to-r from-red-500 to-rose-600 shadow-md w-fit mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
            <p className="text-xl mb-2 font-semibold text-red-800">Problème d'authentification</p>
            <p className="text-md mb-4 text-red-700">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg"
            >
              Actualiser la page
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!isLoading && error && subscriptions.length === 0 && !isAddModalOpen) {
    return (
      <DashboardLayout role="accountant">
        <div className="flex flex-col justify-center items-center h-[calc(100vh-var(--header-height,80px))] p-6 text-center">
          <div className="backdrop-blur-md bg-red-50/90 border border-red-200/50 rounded-xl p-8 shadow-lg shadow-red-100/50 max-w-md">
            <div className="rounded-lg p-3 bg-gradient-to-r from-red-500 to-rose-600 shadow-md w-fit mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
            <p className="text-xl mb-2 font-semibold text-red-800">Erreur lors du chargement</p>
            <p className="text-md mb-4 text-red-700">{error}</p>
            <Button
              onClick={fetchSubscriptions}
              className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg"
            >
              Réessayer
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <RequireAuth>
      <DashboardLayout role="accountant">
        <div className="p-4 md:p-6 space-y-6">
          {/* Header avec style admin doux */}
         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="rounded-xl p-3 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg">
                  <Building className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
                    Gestion des Abonnements
                  </CardTitle>
                  <CardDescription className="text-gray-600 mt-1">Consultez les abonnements clients</CardDescription>
                </div>
              </div>
            </div>
          </div>

          {/* Alerte d'erreur avec style doux */}
          {error && (
            <div className="backdrop-blur-md bg-red-50/90 border border-red-200/50 rounded-xl p-4 shadow-lg shadow-red-100/50">
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-1 bg-gradient-to-r from-red-500 to-rose-600 shadow-sm">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <strong className="font-bold text-red-800">Erreur: </strong>
                  <span className="text-red-700">{error}</span>
                </div>
                <button
                  className="rounded-lg p-1 hover:bg-red-100/50 transition-colors"
                  onClick={() => setError(null)}
                  aria-label="Fermer l'alerte"
                >
                  <svg
                    className="fill-current h-5 w-5 text-red-500"
                    role="button"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <title>Fermer</title>
                    <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Notification entreprise avec style doux */}
          {companyParam && (
            <div className="backdrop-blur-md bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/50 rounded-xl p-4 shadow-lg shadow-blue-100/50">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-md">
                  <Building className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-blue-800">
                  Affichage de l'abonnement pour :{" "}
                  <span className="font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {companyParam}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCompanyFilter("all")
                    // Mettre à jour l'URL sans recharger la page
                    const currentUrl = new URL(window.location.href)
                    currentUrl.searchParams.delete("company")
                    window.history.pushState({}, "", currentUrl.toString())
                  }}
                  className="ml-auto rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200"
                >
                  Voir tous les abonnements
                </Button>
              </div>
            </div>
          )}

          {/* Cards statistiques avec style doux */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="backdrop-blur-md bg-white/90 border-green-200/50 shadow-lg shadow-green-100/20 hover:shadow-green-200/30 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-green-800">Abonnements Actifs</CardTitle>
                <div className="rounded-lg p-2 bg-gradient-to-r from-green-400 to-emerald-500 shadow-md">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  {activeCount}
                </div>
              </CardContent>
            </Card>
            <Card className="backdrop-blur-md bg-white/90 border-orange-200/50 shadow-lg shadow-orange-100/20 hover:shadow-orange-200/30 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-orange-800">Expirent Bientôt</CardTitle>
                <div className="rounded-lg p-2 bg-gradient-to-r from-orange-400 to-amber-500 shadow-md">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                  {expiringSoonCount}
                </div>
              </CardContent>
            </Card>
            <Card className="backdrop-blur-md bg-white/90 border-red-200/50 shadow-lg shadow-red-100/20 hover:shadow-red-200/30 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-red-800">Expirés</CardTitle>
                <div className="rounded-lg p-2 bg-gradient-to-r from-red-400 to-rose-500 shadow-md">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                  {expiredCount}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Barre de recherche et filtres avec style doux */}
          <div className="backdrop-blur-md bg-white/90 rounded-xl p-4 shadow-lg shadow-blue-100/20 border border-blue-100/50">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-3 flex-grow">
                <div className="rounded-lg p-2 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-md">
                  <Search className="h-4 w-4 text-white" />
                </div>
                <Input
                  placeholder="Rechercher par entreprise ou ICE..."
                  value={searchTerm}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border-blue-200/50 focus:border-emerald-300 focus:ring-emerald-200/50"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-emerald-600" />
                  <Select value={statusFilter} onValueChange={(value: string) => setStatusFilter(value)}>
                    <SelectTrigger className="w-full sm:w-[180px] rounded-lg border-blue-200/50">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="actif">Actif</SelectItem>
                      <SelectItem value="expire bientot">Expire bientôt</SelectItem>
                      <SelectItem value="expiré">Expiré</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select value={planFilter} onValueChange={(value: string) => setPlanFilter(value)}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-lg border-blue-200/50">
                    <SelectValue placeholder="Plan" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all">Tous les plans</SelectItem>
                    {uniquePlansFromData.map((planItem: string) => (
                      <SelectItem key={planItem} value={planItem}>
                        {planItem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tableau avec style admin doux */}
          <div className="backdrop-blur-md bg-white/90 rounded-xl shadow-lg shadow-indigo-100/20 border border-indigo-100/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border-b border-blue-100/50">
                    <TableHead className="font-semibold text-blue-800">Entreprise</TableHead>
                    <TableHead className="font-semibold text-blue-800">Plan</TableHead>
                    <TableHead className="font-semibold text-blue-800">Type</TableHead>
                    <TableHead className="font-semibold text-blue-800">Date de fin</TableHead>
                    <TableHead className="font-semibold text-blue-800">Jours restants</TableHead>
                    <TableHead className="font-semibold text-blue-800">Montant</TableHead>
                    <TableHead className="font-semibold text-blue-800">Validation</TableHead>
                    <TableHead className="font-semibold text-blue-800">Statut</TableHead>
                    <TableHead className="text-right font-semibold text-blue-800">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.length > 0 ? (
                    filteredSubscriptions.map((subscription: SubscriptionFE) => {
                      const daysRemaining = getDaysRemaining(subscription.endDateISO)
                      const isProcessing = processingSubscriptionId === subscription.id
                      return (
                        <TableRow
                          key={subscription.id}
                          className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/30 transition-all duration-200"
                        >
                          <TableCell className="font-medium whitespace-nowrap">{subscription.companyName}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <Badge
                                variant="outline"
                                className="bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border-indigo-200/50 mb-1"
                              >
                                {subscription.planName}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {subscription.planStorage} GB - {formatCurrency(subscription.planPrice)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {subscription.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-gray-600">{subscription.endDate}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {subscription.etatValidation === "en_attente" ? (
                              <span className="text-yellow-600 font-medium">En attente</span>
                            ) : subscription.etatValidation === "refuse" ? (
                              <span className="text-red-600 font-medium">Refusé</span>
                            ) : (
                              <span
                                className={
                                  daysRemaining < 0
                                    ? "text-red-600 font-medium"
                                    : daysRemaining <= 30 && daysRemaining >= 0
                                      ? "text-orange-600 font-medium"
                                      : "text-green-600 font-medium"
                                }
                              >
                                {daysRemaining < 0
                                  ? `Expiré (${Math.abs(daysRemaining)} j.)`
                                  : daysRemaining === 0
                                    ? "Aujourd'hui"
                                    : `${daysRemaining} j.`}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono whitespace-nowrap text-gray-700">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-blue-600" />
                              {formatCurrency(subscription.amount)}
                            </div>
                          </TableCell>
                          <TableCell>{getValidationBadge(subscription.etatValidation)}</TableCell>
                          <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => viewDetails(subscription)}
                                title="Voir détails"
                                className="rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700 transition-all duration-200"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                           
                             
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10">
                        <div className="flex flex-col items-center gap-3">
                          <div className="rounded-lg p-4 bg-gradient-to-r from-gray-100 to-gray-200">
                            <TrendingUp className="h-8 w-8 text-gray-400" />
                          </div>
                          <span className="font-medium text-gray-500">
                            {searchTerm || statusFilter !== "all" || planFilter !== "all" || validationFilter !== "all"
                              ? "Aucun abonnement ne correspond à vos filtres."
                              : "Aucun abonnement à afficher."}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Dialog détails avec style admin doux */}
          <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
            <DialogContent className="sm:max-w-2xl backdrop-blur-md bg-white/95 border-indigo-200/50 shadow-2xl shadow-indigo-200/20">
            
              <DialogHeader className="border-b border-indigo-100/50 pb-4">
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Détails de l'abonnement
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Informations complètes sur l'abonnement.
                </DialogDescription>
              </DialogHeader>
              {selectedSubscription && (
                <div className="grid gap-6 py-4">
                  {/* Informations de l'abonnement */}
                  <div className="backdrop-blur-sm bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-xl p-4 border border-blue-200/50">
                    <h4 className="font-medium mb-3 text-blue-800 flex items-center gap-2">
                      <div className="rounded p-1 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-sm">
                        <Building className="h-4 w-4 text-white" />
                      </div>
                      Informations de l'abonnement
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                      <div>
                        <p className="text-sm font-medium text-blue-700">Entreprise</p>
                        <p className="font-semibold text-gray-800">{selectedSubscription.companyName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-700">ICE</p>
                        <p className="font-semibold text-gray-800">{selectedSubscription.ICE}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-700">Plan</p>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant="outline"
                            className="bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border-indigo-200/50 w-fit"
                          >
                            {selectedSubscription.planName}
                          </Badge>
                          <span className="text-xs text-gray-600">
                            {selectedSubscription.planStorage} GB - {formatCurrency(selectedSubscription.planPrice)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-700">Type</p>
                        <Badge variant="outline" className="capitalize">
                          {selectedSubscription.type}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-700">Montant payé</p>
                        <p className="font-mono font-semibold text-gray-800">
                          {formatCurrency(selectedSubscription.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-700">Date de début</p>
                        <p className="font-semibold text-gray-800">{selectedSubscription.startDate}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-700">Date de fin</p>
                        <p className="font-semibold text-gray-800">{selectedSubscription.endDate}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-700">État de validation</p>
                        {getValidationBadge(selectedSubscription.etatValidation)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-700">Statut</p>
                        {getStatusBadge(selectedSubscription.status)}
                      </div>
                      {selectedSubscription.justificatifPath && (
                        <div className="sm:col-span-2">
                          <p className="text-sm font-medium text-blue-700 mb-2">Justificatif</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 bg-transparent"
                            onClick={() => window.open(selectedSubscription.justificatifPath, "_blank")}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Voir le justificatif
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter className="pt-4 border-t border-indigo-100/50">
                <Button
                  variant="outline"
                  onClick={() => setIsDetailsOpen(false)}
                  className="border-indigo-200 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:text-indigo-700"
                >
                  Fermer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog renouvellement amélioré avec formulaire éditable */}
        
        </div>
      </DashboardLayout>
    </RequireAuth>
  )
}
