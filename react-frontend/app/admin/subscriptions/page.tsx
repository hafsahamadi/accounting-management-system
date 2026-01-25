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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
  Edit3,
  Save,
  CalendarDays,
  Calculator,
  Info,
  Percent,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// --- Utilisation de REACT_APP_API_URL ---
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
  justificatif_url?: string
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
  justificatif_url?: string
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
  notes: string
  use_auto_calculation: boolean
  discount_percentage: number
  custom_price: string
}

interface PriceCalculation {
  originalPrice: number
  remainingDays: number
  totalDays: number
  usagePercentage: number
  discountAmount: number
  finalPrice: number
  calculationMethod: "prorata" | "discount" | "custom"
  explanation: string
}

// --- Fonctions Helper Typées ---
const formatDateToDisplay = (dateString: string | null | undefined): string => {
  if (!dateString) return ""
  if (dateString.includes("/") && dateString.split("/").length === 3 && dateString.split("/")[2].length === 4) {
    return dateString
  }
  const parts = dateString.split("-")
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  try {
    const d = new Date(dateString)
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
    }
  } catch (e) {
    /* ignorer l'erreur de parsing */
  }
  return dateString
}

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return "N/A"
  return `${amount.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`
}

const getAuthToken = (): string | null => {
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

// Fonction de calcul intelligent du prix de renouvellement
const calculateRenewalPrice = (
  subscription: SubscriptionFE,
  newPlanPrice: number,
  useAutoCalculation: boolean,
  discountPercentage = 0,
  customPrice = 0,
): PriceCalculation => {
  const today = new Date()
  const startDate = new Date(subscription.endDateISO)
  const endDate = new Date(subscription.endDateISO)

  // Calculer les jours restants (si l'abonnement n'est pas encore expiré)
  const remainingDays = Math.max(0, Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))

  // Calculer la durée totale de l'abonnement original (approximation: 365 jours)
  const totalDays = 365

  // Calculer le pourcentage d'utilisation
  const usagePercentage = Math.max(0, Math.min(100, ((totalDays - remainingDays) / totalDays) * 100))

  let finalPrice = newPlanPrice
  let calculationMethod: "prorata" | "discount" | "custom" = "prorata"
  let explanation = ""

  if (!useAutoCalculation && customPrice > 0) {
    // Prix personnalisé
    finalPrice = customPrice
    calculationMethod = "custom"
    explanation = `Prix personnalisé défini manuellement`
  } else if (useAutoCalculation) {
    // Calcul automatique basé sur l'utilisation
    if (remainingDays > 0) {
      // L'abonnement n'est pas encore expiré - calcul prorata
      const prorataAmount = (remainingDays / totalDays) * newPlanPrice
      finalPrice = Math.max(newPlanPrice * 0.2, newPlanPrice - prorataAmount) // Minimum 20% du prix
      explanation = `Calcul prorata: ${remainingDays} jours restants sur ${totalDays} jours. Réduction de ${formatCurrency(prorataAmount)}`
    } else {
      // L'abonnement est expiré - appliquer une réduction basée sur l'utilisation
      const daysOverdue = Math.abs(remainingDays)
      if (daysOverdue <= 30) {
        // Expiré depuis moins de 30 jours - réduction de 30%
        finalPrice = newPlanPrice * 0.7
        explanation = `Abonnement expiré depuis ${daysOverdue} jours. Réduction de 30%`
      } else if (daysOverdue <= 90) {
        // Expiré depuis 30-90 jours - réduction de 50%
        finalPrice = newPlanPrice * 0.5
        explanation = `Abonnement expiré depuis ${daysOverdue} jours. Réduction de 50%`
      } else {
        // Expiré depuis plus de 90 jours - réduction de 70%
        finalPrice = newPlanPrice * 0.3
        explanation = `Abonnement expiré depuis ${daysOverdue} jours. Réduction de 70%`
      }
    }
  } else if (discountPercentage > 0) {
    // Réduction manuelle
    finalPrice = newPlanPrice * (1 - discountPercentage / 100)
    calculationMethod = "discount"
    explanation = `Réduction de ${discountPercentage}% appliquée`
  }

  const discountAmount = newPlanPrice - finalPrice

  return {
    originalPrice: newPlanPrice,
    remainingDays,
    totalDays,
    usagePercentage,
    discountAmount,
    finalPrice: Math.round(finalPrice * 100) / 100, // Arrondir à 2 décimales
    calculationMethod,
    explanation,
  }
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
    notes: "",
    use_auto_calculation: true,
    discount_percentage: 0,
    custom_price: "",
  })
  const [priceCalculation, setPriceCalculation] = useState<PriceCalculation | null>(null)
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
    if (etatValidation === "en_attente") return "en_attente"
    if (etatValidation === "refuse") return "refuse"
    if (etatValidation === "valide" && apiStatus === "actif") {
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
      console.error("Erreur critique : REACT_APP_API_URL n'est pas défini correctement.")
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
      const response = await fetch(`${API_BASE}/abonnementss`, {
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
        justificatif_url: sub.justificatif_url,
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

  // Recalculer le prix quand les données changent
  useEffect(() => {
    if (selectedSubscription && renewalData.plan_id) {
      const selectedPlan = plans.find((plan) => plan.id === Number(renewalData.plan_id))
      if (selectedPlan) {
        const calculation = calculateRenewalPrice(
          selectedSubscription,
          selectedPlan.prix,
          renewalData.use_auto_calculation,
          renewalData.discount_percentage,
          Number(renewalData.custom_price) || 0,
        )
        setPriceCalculation(calculation)

        // Mettre à jour le montant dans le formulaire
        if (renewalData.use_auto_calculation || renewalData.custom_price) {
          setRenewalData((prev) => ({ ...prev, montant: calculation.finalPrice.toString() }))
        }
      }
    }
  }, [
    selectedSubscription,
    renewalData.plan_id,
    renewalData.use_auto_calculation,
    renewalData.discount_percentage,
    renewalData.custom_price,
    plans,
  ])

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setNewSubscriptionData((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }))
  }

  const handleRenewalInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setRenewalData((prev) => ({ ...prev, [name]: value }))
    if (renewalErrors[name]) setRenewalErrors((prev) => ({ ...prev, [name]: "" }))
  }

  const handleSelectChange = (name: keyof NewSubscriptionForm, value: string) => {
    setNewSubscriptionData((prev) => ({ ...prev, [name]: value as any }))
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }))
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

  const handleAddSubscription = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validateForm()) return
    if (!checkApiBaseUrl()) return
    setIsSubmitting(true)
    setError(null)
    setFormErrors({})
    const payload = {
      ...newSubscriptionData,
      id_entreprise: Number(newSubscriptionData.id_entreprise),
      plan_id: Number(newSubscriptionData.plan_id),
      montant: Number(newSubscriptionData.montant),
    }
    try {
      const headers = getAuthHeaders()
      if (!headers.Authorization) {
        handleAuthError(new Error("Token non trouvé pour ajouter un abonnement."))
        setIsSubmitting(false)
        return
      }
      const response = await fetch(`${API_BASE}/abonnements`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
      const responseData = await response.json()
      if (response.status === 401) {
        handleAuthError(new Error("Token invalide ou expiré (ajout abonnement)."))
        setIsSubmitting(false)
        return
      }
      if (!response.ok) {
        if (response.status === 422 && responseData.errors) {
          const laravelErrors: Record<string, string> = {}
          for (const key in responseData.errors) laravelErrors[key] = responseData.errors[key][0]
          setFormErrors(laravelErrors)
          throw new Error("Erreurs de validation.")
        }
        throw new Error(responseData.message || `HTTP error! status: ${response.status}`)
      }
      alert("Abonnement ajouté avec succès !")
      setIsAddModalOpen(false)
      setNewSubscriptionData({
        id_entreprise: "",
        plan_id: "",
        date_debut: "",
        date_fin: "",
        montant: "",
        type: "initial",
      })
      await fetchSubscriptions()
    } catch (e: any) {
      console.error("Failed to add subscription:", e)
      if (e.message.includes("Token invalide") || e.message.includes("401")) {
        handleAuthError(e)
      } else {
        setError(e.message || "Erreur lors de l'ajout de l'abonnement.")
        if (e.message !== "Erreurs de validation.") {
          alert(`Erreur : ${e.message || "Erreur inconnue"}`)
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const initializeRenewalData = (subscription: SubscriptionFE) => {
    const today = new Date()
    const startDate = new Date(subscription.endDateISO) < today ? today : new Date(subscription.endDateISO)
    const endDate = new Date(startDate)
    endDate.setFullYear(endDate.getFullYear() + 1)

    setRenewalData({
      plan_id: subscription.planId.toString(),
      date_debut: startDate.toISOString().split("T")[0],
      date_fin: endDate.toISOString().split("T")[0],
      montant: subscription.planPrice.toString(),
      notes: `Renouvellement automatique de l'abonnement ${subscription.planName} pour ${subscription.companyName}`,
      use_auto_calculation: true,
      discount_percentage: 0,
      custom_price: "",
    })
  }

  const confirmRenewal = async (): Promise<void> => {
    if (!selectedSubscription) return
    if (!validateRenewalForm()) return
    if (!checkApiBaseUrl()) return

    setIsRenewing(true)
    setError(null)

    try {
      const headers = getAuthHeaders()
      if (!headers.Authorization) {
        handleAuthError(new Error("Token non trouvé pour renouveler l'abonnement."))
        setIsRenewing(false)
        return
      }

      const payload = {
        id_entreprise: selectedSubscription.companyId,
        plan_id: Number(renewalData.plan_id),
        date_debut: renewalData.date_debut,
        date_fin: renewalData.date_fin,
        montant: Number(renewalData.montant),
        type: "renouvellement" as ApiType,
        notes: renewalData.notes,
        previous_subscription_id: selectedSubscription.id,
        price_calculation: priceCalculation,
          _action: "renew"
      }

      const response = await fetch(
      `${API_BASE}/abonnements/${selectedSubscription.id}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      }
    );

     
const responseData = await response.json(); // ✅ lire une seule fois

if (response.status === 401) {
  handleAuthError(new Error("Token invalide ou expiré (renouvellement)."));
  setIsRenewing(false);
  return;
}

if (!response.ok) {
  if (response.status === 422 && responseData.errors) {
  console.error("Validation errors:", responseData.errors); // <--- AJOUT

  const laravelErrors: Record<string, string> = {}
  for (const key in responseData.errors) {
    laravelErrors[key] = responseData.errors[key][0]
  }
  setRenewalErrors(laravelErrors)
  throw new Error("Erreurs de validation du renouvellement.")
}

  throw new Error(responseData.message || `HTTP error! status: ${response.status}`);
}


      alert("Abonnement renouvelé avec succès !")
      setIsRenewalOpen(false)
      setRenewalData({
        plan_id: "",
        date_debut: "",
        date_fin: "",
        montant: "",
        notes: "",
        use_auto_calculation: true,
        discount_percentage: 0,
        custom_price: "",
      })
      setRenewalErrors({})
      setPriceCalculation(null)
      await fetchSubscriptions()
    } catch (e: any) {
      console.error("Failed to renew subscription:", e)
      if (e.message.includes("Token invalide") || e.message.includes("401")) {
        handleAuthError(e)
      } else {
        setError(e.message || "Une erreur inconnue est survenue lors du renouvellement.")
        if (e.message !== "Erreurs de validation du renouvellement.") {
          alert(`Erreur lors du renouvellement : ${e.message || "Erreur inconnue"}`)
        }
      }
    } finally {
      setIsRenewing(false)
    }
  }

  const validateSubscription = async (subscriptionId: number): Promise<void> => {
    if (!checkApiBaseUrl()) return
    setIsValidating(true)
    setProcessingSubscriptionId(subscriptionId)
    setError(null)
    try {
      const headers = getAuthHeaders()
      if (!headers.Authorization) {
        handleAuthError(new Error("Token non trouvé pour valider l'abonnement."))
        setIsValidating(false)
        setProcessingSubscriptionId(null)
        return
      }
      const response = await fetch(`${API_BASE}/abonnements/${subscriptionId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          etat_validation: "valide",
        }),
      })
      const responseData = await response.json()
      if (response.status === 401) {
        handleAuthError(new Error("Token invalide ou expiré (validation)."))
        setIsValidating(false)
        setProcessingSubscriptionId(null)
        return
      }
      if (!response.ok) {
        throw new Error(responseData.message || `HTTP error! status: ${response.status}`)
      }
      alert("Abonnement validé avec succès !")
      await fetchSubscriptions()
    } catch (e: any) {
      console.error("Failed to validate subscription:", e)
      if (e.message.includes("Token invalide") || e.message.includes("401")) {
        handleAuthError(e)
      } else {
        setError(e.message || "Erreur lors de la validation de l'abonnement.")
        alert(`Erreur lors de la validation : ${e.message || "Erreur inconnue"}`)
      }
    } finally {
      setIsValidating(false)
      setProcessingSubscriptionId(null)
    }
  }

  const rejectSubscription = async (subscriptionId: number): Promise<void> => {
    if (!checkApiBaseUrl()) return
    setIsRejecting(true)
    setProcessingSubscriptionId(subscriptionId)
    setError(null)
    try {
      const headers = getAuthHeaders()
      if (!headers.Authorization) {
        handleAuthError(new Error("Token non trouvé pour rejeter l'abonnement."))
        setIsRejecting(false)
        setProcessingSubscriptionId(null)
        return
      }
      const response = await fetch(`${API_BASE}/abonnements/${subscriptionId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          etat_validation: "refuse",
        }),
      })
      const responseData = await response.json()
      if (response.status === 401) {
        handleAuthError(new Error("Token invalide ou expiré (rejet)."))
        setIsRejecting(false)
        setProcessingSubscriptionId(null)
        return
      }
      if (!response.ok) {
        throw new Error(responseData.message || `HTTP error! status: ${response.status}`)
      }
      alert("Abonnement rejeté avec succès !")
      await fetchSubscriptions()
    } catch (e: any) {
      console.error("Failed to reject subscription:", e)
      if (e.message.includes("Token invalide") || e.message.includes("401")) {
        handleAuthError(e)
      } else {
        setError(e.message || "Erreur lors du rejet de l'abonnement.")
        alert(`Erreur lors du rejet : ${e.message || "Erreur inconnue"}`)
      }
    } finally {
      setIsRejecting(false)
      setProcessingSubscriptionId(null)
    }
  }

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
    initializeRenewalData(subscription)
    setRenewalErrors({})
    setPriceCalculation(null)
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
      <DashboardLayout role="admin">
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
      <DashboardLayout role="admin">
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
      <DashboardLayout role="admin">
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
      <DashboardLayout role="admin">
        <div className="p-4 md:p-6 space-y-6">
          {/* Header avec style admin doux */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-xl p-3 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Gestion des Abonnements
                </CardTitle>
                <CardDescription className="text-gray-600 mt-1">
                  Administration complète des abonnements clients avec calcul intelligent des prix
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  fetchEntreprises()
                  fetchPlans()
                  setIsAddModalOpen(true)
                }}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg"
              >
                <PlusCircle className="h-4 w-4 mr-2" /> Ajouter Abonnement
              </Button>
            </div>
          </div>

          {/* Alerte d'erreur avec style doux */}
          {error && !isAddModalOpen && (
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

          {/* Dialog d'ajout avec style admin doux */}
          <Dialog
            open={isAddModalOpen}
            onOpenChange={(isOpen) => {
              setIsAddModalOpen(isOpen)
              if (!isOpen) {
                setNewSubscriptionData({
                  id_entreprise: "",
                  plan_id: "",
                  date_debut: "",
                  date_fin: "",
                  montant: "",
                  type: "initial",
                })
                setFormErrors({})
              }
            }}
          >
            <DialogContent className="sm:max-w-lg backdrop-blur-md bg-white/95 border-indigo-200/50 shadow-2xl shadow-indigo-200/20">
              <DialogHeader className="border-b border-indigo-100/50 pb-4">
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Ajouter un nouvel abonnement
                </DialogTitle>
                <DialogDescription className="text-gray-600">Remplissez les informations.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSubscription} className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="id_entreprise" className="text-blue-700 font-medium">
                    Entreprise
                  </Label>
                  <Select
                    value={newSubscriptionData.id_entreprise}
                    onValueChange={(value) => handleSelectChange("id_entreprise", value)}
                    name="id_entreprise"
                    disabled={isLoadingEntreprises}
                  >
                    <SelectTrigger
                      className={`rounded-lg border-indigo-200/50 ${formErrors.id_entreprise ? "border-red-500" : ""}`}
                    >
                      <SelectValue
                        placeholder={
                          isLoadingEntreprises ? "Chargement des entreprises..." : "Sélectionner une entreprise"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      {isLoadingEntreprises ? (
                        <div className="flex items-center justify-center p-2">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement...
                        </div>
                      ) : entreprisesList.length === 0 ? (
                        <SelectItem value="no-data" disabled>
                          Aucune entreprise trouvée
                        </SelectItem>
                      ) : (
                        entreprisesList.map((entreprise) => (
                          <SelectItem
                            key={entreprise.id}
                            value={String(entreprise.id)}
                            disabled={activeSubscriptionCompanyIds.includes(entreprise.id)}
                          >
                            {entreprise.nom_entreprise}
                            {activeSubscriptionCompanyIds.includes(entreprise.id) && (
                              <span className="ml-2 text-xs text-muted-foreground">(Abonnement actif)</span>
                            )}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {formErrors.id_entreprise && <p className="text-red-500 text-xs">{formErrors.id_entreprise}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plan_id" className="text-blue-700 font-medium">
                    Plan
                  </Label>
                  <Select
                    value={newSubscriptionData.plan_id}
                    onValueChange={(value) => handleSelectChange("plan_id", value)}
                    name="plan_id"
                    disabled={isLoadingPlans}
                  >
                    <SelectTrigger
                      className={`rounded-lg border-indigo-200/50 ${formErrors.plan_id ? "border-red-500" : ""}`}
                    >
                      <SelectValue placeholder={isLoadingPlans ? "Chargement des plans..." : "Sélectionner un plan"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      {isLoadingPlans ? (
                        <div className="flex items-center justify-center p-2">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement...
                        </div>
                      ) : plans.length === 0 ? (
                        <SelectItem value="no-data" disabled>
                          Aucun plan trouvé
                        </SelectItem>
                      ) : (
                        plans.map((plan) => (
                          <SelectItem key={plan.id} value={String(plan.id)}>
                            {plan.nom} - {formatCurrency(plan.prix)} ({plan.espace_max} GB)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {formErrors.plan_id && <p className="text-red-500 text-xs">{formErrors.plan_id}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type" className="text-blue-700 font-medium">
                    Type d'abonnement
                  </Label>
                  <Select
                    value={newSubscriptionData.type}
                    onValueChange={(value) => handleSelectChange("type", value as ApiType)}
                    name="type"
                  >
                    <SelectTrigger
                      className={`rounded-lg border-indigo-200/50 ${formErrors.type ? "border-red-500" : ""}`}
                    >
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="initial">Initial</SelectItem>
                      <SelectItem value="renouvellement">Renouvellement</SelectItem>
                      <SelectItem value="upgrade">Upgrade</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.type && <p className="text-red-500 text-xs">{formErrors.type}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="date_debut" className="text-blue-700 font-medium">
                      Date début
                    </Label>
                    <Input
                      id="date_debut"
                      name="date_debut"
                      type="date"
                      value={newSubscriptionData.date_debut}
                      onChange={handleInputChange}
                      className={`rounded-lg border-indigo-200/50 ${formErrors.date_debut ? "border-red-500" : ""}`}
                    />
                    {formErrors.date_debut && <p className="text-red-500 text-xs">{formErrors.date_debut}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date_fin" className="text-blue-700 font-medium">
                      Date fin
                    </Label>
                    <Input
                      id="date_fin"
                      name="date_fin"
                      type="date"
                      value={newSubscriptionData.date_fin}
                      onChange={handleInputChange}
                      className={`rounded-lg border-indigo-200/50 ${formErrors.date_fin ? "border-red-500" : ""}`}
                    />
                    {formErrors.date_fin && <p className="text-red-500 text-xs">{formErrors.date_fin}</p>}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="montant" className="text-blue-700 font-medium">
                    Montant (DH)
                  </Label>
                  <Input
                    id="montant"
                    name="montant"
                    type="number"
                    step="0.01"
                    value={newSubscriptionData.montant}
                    onChange={handleInputChange}
                    className={`rounded-lg border-indigo-200/50 ${formErrors.montant ? "border-red-500" : ""}`}
                  />
                  {formErrors.montant && <p className="text-red-500 text-xs">{formErrors.montant}</p>}
                </div>
                <DialogFooter className="pt-4 border-t border-indigo-100/50">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={isSubmitting}
                    className="border-indigo-200 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || isLoadingEntreprises || isLoadingPlans}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Ajouter
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Notification entreprise avec style admin doux */}
          {companyParam && (
            <div className="backdrop-blur-md bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-200/50 rounded-xl p-4 shadow-lg shadow-indigo-100/50">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-gradient-to-r from-indigo-400 to-purple-500 shadow-md">
                  <Building className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-indigo-800">
                  Affichage de l'abonnement pour :{" "}
                  <span className="font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {companyParam}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCompanyFilter("all")
                    const currentUrl = new URL(window.location.href)
                    currentUrl.searchParams.delete("company")
                    window.history.pushState({}, "", currentUrl.toString())
                  }}
                  className="ml-auto rounded-lg hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200"
                >
                  Voir tous les abonnements
                </Button>
              </div>
            </div>
          )}

          {/* Cards statistiques avec style admin doux */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
            <Card className="backdrop-blur-md bg-white/90 border-yellow-200/50 shadow-lg shadow-yellow-100/20 hover:shadow-yellow-200/30 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-yellow-800">En Attente</CardTitle>
                <div className="rounded-lg p-2 bg-gradient-to-r from-yellow-400 to-amber-500 shadow-md">
                  <Clock className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                  {pendingCount}
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

          {/* Barre de recherche et filtres avec style admin doux */}
          <div className="backdrop-blur-md bg-white/90 rounded-xl p-4 shadow-lg shadow-indigo-100/20 border border-indigo-100/50">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-3 flex-grow">
                <div className="rounded-lg p-2 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-md">
                  <Search className="h-4 w-4 text-white" />
                </div>
                <Input
                  placeholder="Rechercher par entreprise ou ICE..."
                  value={searchTerm}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border-indigo-200/50 focus:border-blue-300 focus:ring-blue-200/50"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-blue-600" />
                  <Select value={statusFilter} onValueChange={(value: string) => setStatusFilter(value)}>
                    <SelectTrigger className="w-full sm:w-[180px] rounded-lg border-indigo-200/50">
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
                <Select value={validationFilter} onValueChange={(value: string) => setValidationFilter(value)}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-lg border-indigo-200/50">
                    <SelectValue placeholder="Validation" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all">Toutes validations</SelectItem>
                    <SelectItem value="en_attente">En attente</SelectItem>
                    <SelectItem value="valide">Validé</SelectItem>
                    <SelectItem value="refuse">Refusé</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={planFilter} onValueChange={(value: string) => setPlanFilter(value)}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-lg border-indigo-200/50">
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
                              {subscription.etatValidation === "en_attente" && (
                                <>
                                  <Button
                                    size="icon"
                                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg rounded-lg"
                                    onClick={() => validateSubscription(subscription.id)}
                                    disabled={isProcessing}
                                    title="Valider"
                                  >
                                    {isValidating && isProcessing ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="destructive"
                                    className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg rounded-lg"
                                    onClick={() => rejectSubscription(subscription.id)}
                                    disabled={isProcessing}
                                    title="Rejeter"
                                  >
                                    {isRejecting && isProcessing ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <X className="h-4 w-4" />
                                    )}
                                  </Button>
                                </>
                              )}
                              {(subscription.status === "expiré" || subscription.status === "expire bientot") &&
                                subscription.etatValidation === "valide" && (
                                  <Button
                                    size="icon"
                                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg rounded-lg"
                                    onClick={() => renewSubscription(subscription)}
                                    disabled={isRenewing && selectedSubscription?.id === subscription.id}
                                    title="Renouveler"
                                  >
                                    {isRenewing && selectedSubscription?.id === subscription.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
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
                      {selectedSubscription.justificatif_url && (
                        <div className="sm:col-span-2">
                          <p className="text-sm font-medium text-blue-700 mb-2">Justificatif</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 bg-transparent"
                            onClick={() => window.open(selectedSubscription.justificatif_url, "_blank")}
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

          {/* Dialog renouvellement amélioré avec calcul intelligent des prix */}
          <Dialog open={isRenewalOpen} onOpenChange={setIsRenewalOpen}>
            <DialogContent className="sm:max-w-4xl backdrop-blur-md bg-white/95 border-indigo-200/50 shadow-2xl shadow-indigo-200/20 max-h-[90vh] overflow-y-auto">
              <DialogHeader className="border-b border-indigo-100/50 pb-4">
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                  <div className="rounded p-1 bg-gradient-to-r from-indigo-400 to-purple-500 shadow-sm">
                    <RefreshCw className="h-5 w-5 text-white" />
                  </div>
                  Renouveler l'abonnement - Calcul Intelligent
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Configurez le renouvellement avec calcul automatique du prix pour "{selectedSubscription?.companyName}
                  ".
                </DialogDescription>
              </DialogHeader>
              {selectedSubscription && (
                <div className="grid gap-6 py-4">
                  {/* Informations actuelles */}
                  <div className="backdrop-blur-sm bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-xl p-4 border border-indigo-200/50">
                    <h4 className="font-medium mb-3 text-indigo-800 flex items-center gap-2">
                      <div className="rounded p-1 bg-gradient-to-r from-indigo-400 to-purple-500 shadow-sm">
                        <Building className="h-4 w-4 text-white" />
                      </div>
                      Abonnement actuel
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-indigo-700 font-medium">Plan actuel:</span>
                        <p className="font-semibold text-gray-800">{selectedSubscription.planName}</p>
                      </div>
                      <div>
                        <span className="text-indigo-700 font-medium">Date de fin:</span>
                        <p className="font-semibold text-gray-800">{selectedSubscription.endDate}</p>
                      </div>
                      <div>
                        <span className="text-indigo-700 font-medium">Montant payé:</span>
                        <p className="font-semibold text-gray-800">{formatCurrency(selectedSubscription.amount)}</p>
                      </div>
                      <div>
                        <span className="text-indigo-700 font-medium">Statut:</span>
                        <div className="mt-1">{getStatusBadge(selectedSubscription.status)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Formulaire de renouvellement */}
                  <div className="backdrop-blur-sm bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-xl p-4 border border-blue-200/50">
                    <h4 className="font-medium mb-4 text-blue-800 flex items-center gap-2">
                      <div className="rounded p-1 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-sm">
                        <Edit3 className="h-4 w-4 text-white" />
                      </div>
                      Configuration du renouvellement
                    </h4>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="renewal_plan_id" className="text-blue-700 font-medium">
                          Plan pour le renouvellement
                        </Label>
                        <Select
                          value={renewalData.plan_id}
                          onValueChange={(value) => handleRenewalSelectChange("plan_id", value)}
                          disabled={isLoadingPlans}
                        >
                          <SelectTrigger
                            className={`rounded-lg border-blue-200/50 ${renewalErrors.plan_id ? "border-red-500" : ""}`}
                          >
                            <SelectValue placeholder={isLoadingPlans ? "Chargement..." : "Sélectionner un plan"} />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg">
                            {isLoadingPlans ? (
                              <div className="flex items-center justify-center p-2">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement...
                              </div>
                            ) : (
                              plans.map((plan) => (
                                <SelectItem key={plan.id} value={String(plan.id)}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{plan.nom}</span>
                                    <span className="text-xs text-gray-500">
                                      {formatCurrency(plan.prix)} - {plan.espace_max} GB
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {renewalErrors.plan_id && <p className="text-red-500 text-xs">{renewalErrors.plan_id}</p>}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label
                            htmlFor="renewal_date_debut"
                            className="text-blue-700 font-medium flex items-center gap-1"
                          >
                            <CalendarDays className="h-4 w-4" />
                            Date de début
                          </Label>
                          <Input
                            id="renewal_date_debut"
                            name="date_debut"
                            type="date"
                            value={renewalData.date_debut}
                            onChange={handleRenewalInputChange}
                            className={`rounded-lg border-blue-200/50 ${renewalErrors.date_debut ? "border-red-500" : ""}`}
                          />
                          {renewalErrors.date_debut && (
                            <p className="text-red-500 text-xs">{renewalErrors.date_debut}</p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label
                            htmlFor="renewal_date_fin"
                            className="text-blue-700 font-medium flex items-center gap-1"
                          >
                            <CalendarDays className="h-4 w-4" />
                            Date de fin
                          </Label>
                          <Input
                            id="renewal_date_fin"
                            name="date_fin"
                            type="date"
                            value={renewalData.date_fin}
                            onChange={handleRenewalInputChange}
                            className={`rounded-lg border-blue-200/50 ${renewalErrors.date_fin ? "border-red-500" : ""}`}
                          />
                          {renewalErrors.date_fin && <p className="text-red-500 text-xs">{renewalErrors.date_fin}</p>}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="renewal_notes" className="text-blue-700 font-medium">
                          Notes (optionnel)
                        </Label>
                        <Textarea
                          id="renewal_notes"
                          name="notes"
                          value={renewalData.notes}
                          onChange={handleRenewalInputChange}
                          placeholder="Ajoutez des notes sur ce renouvellement..."
                          className="rounded-lg border-blue-200/50 min-h-[80px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section de calcul du prix */}
                  <div className="backdrop-blur-sm bg-gradient-to-br from-amber-50/50 to-orange-50/50 rounded-xl p-4 border border-amber-200/50">
                    <h4 className="font-medium mb-4 text-amber-800 flex items-center gap-2">
                      <div className="rounded p-1 bg-gradient-to-r from-amber-400 to-orange-500 shadow-sm">
                        <Calculator className="h-4 w-4 text-white" />
                      </div>
                      Calcul du prix de renouvellement
                    </h4>

                    <div className="grid gap-4">
                      {/* Option de calcul automatique */}
                      <div className="flex items-center justify-between p-3 bg-white/50 rounded-lg border border-amber-200/30">
                        <div className="flex items-center gap-3">
                          <div className="rounded p-1 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-sm">
                            <Calculator className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <Label htmlFor="auto_calculation" className="text-amber-700 font-medium">
                              Calcul automatique intelligent
                            </Label>
                            <p className="text-xs text-amber-600">
                              Prix ajusté selon l'utilisation et le temps restant
                            </p>
                          </div>
                        </div>
                        <Switch
                          id="auto_calculation"
                          checked={renewalData.use_auto_calculation}
                          onCheckedChange={(checked) =>
                            setRenewalData((prev) => ({ ...prev, use_auto_calculation: checked, custom_price: "" }))
                          }
                        />
                      </div>

                      {/* Options manuelles */}
                      {!renewalData.use_auto_calculation && (
                        <div className="grid gap-3">
                          <div className="grid gap-2">
                            <Label
                              htmlFor="discount_percentage"
                              className="text-amber-700 font-medium flex items-center gap-1"
                            >
                              <Percent className="h-4 w-4" />
                              Réduction (%)
                            </Label>
                            <Input
                              id="discount_percentage"
                              name="discount_percentage"
                              type="number"
                              min="0"
                              max="100"
                              value={renewalData.discount_percentage}
                              onChange={(e) =>
                                setRenewalData((prev) => ({
                                  ...prev,
                                  discount_percentage: Number(e.target.value),
                                  custom_price: "",
                                }))
                              }
                              className="rounded-lg border-amber-200/50"
                              placeholder="Ex: 30 pour 30%"
                            />
                          </div>

                          <div className="text-center text-amber-600 font-medium">OU</div>

                          <div className="grid gap-2">
                            <Label
                              htmlFor="custom_price"
                              className="text-amber-700 font-medium flex items-center gap-1"
                            >
                              <CreditCard className="h-4 w-4" />
                              Prix personnalisé (DH)
                            </Label>
                            <Input
                              id="custom_price"
                              name="custom_price"
                              type="number"
                              step="0.01"
                              value={renewalData.custom_price}
                              onChange={(e) =>
                                setRenewalData((prev) => ({
                                  ...prev,
                                  custom_price: e.target.value,
                                  discount_percentage: 0,
                                }))
                              }
                              className="rounded-lg border-amber-200/50"
                              placeholder="Entrez le prix exact"
                            />
                          </div>
                        </div>
                      )}

                      {/* Affichage du calcul */}
                      {priceCalculation && (
                        <Alert className="border-green-200 bg-green-50/50">
                          <Info className="h-4 w-4" />
                          <AlertTitle className="text-green-800">Calcul du prix</AlertTitle>
                          <AlertDescription className="text-green-700">
                            <div className="grid gap-2 mt-2">
                              <div className="flex justify-between">
                                <span>Prix original du plan:</span>
                                <span className="font-semibold">{formatCurrency(priceCalculation.originalPrice)}</span>
                              </div>
                              {priceCalculation.discountAmount > 0 && (
                                <div className="flex justify-between text-orange-600">
                                  <span>Réduction appliquée:</span>
                                  <span className="font-semibold">
                                    -{formatCurrency(priceCalculation.discountAmount)}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between text-lg font-bold text-green-800 border-t border-green-200 pt-2">
                                <span>Prix final:</span>
                                <span>{formatCurrency(priceCalculation.finalPrice)}</span>
                              </div>
                              <div className="text-sm text-green-600 mt-2 p-2 bg-green-100/50 rounded">
                                <strong>Explication:</strong> {priceCalculation.explanation}
                              </div>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Montant final */}
                      <div className="grid gap-2">
                        <Label htmlFor="renewal_montant" className="text-amber-700 font-medium flex items-center gap-1">
                          <CreditCard className="h-4 w-4" />
                          Montant final (DH)
                        </Label>
                        <Input
                          id="renewal_montant"
                          name="montant"
                          type="number"
                          step="0.01"
                          value={renewalData.montant}
                          onChange={handleRenewalInputChange}
                          className={`rounded-lg border-amber-200/50 font-bold text-lg ${renewalErrors.montant ? "border-red-500" : ""}`}
                          readOnly={renewalData.use_auto_calculation}
                        />
                        {renewalErrors.montant && <p className="text-red-500 text-xs">{renewalErrors.montant}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Résumé du renouvellement */}
                  <div className="backdrop-blur-sm bg-gradient-to-br from-green-50/50 to-emerald-50/50 rounded-xl p-4 border border-green-200/50">
                    <h4 className="font-medium mb-3 text-green-800 flex items-center gap-2">
                      <div className="rounded p-1 bg-gradient-to-r from-green-400 to-emerald-500 shadow-sm">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      Résumé du renouvellement
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-green-700 font-medium">Nouveau plan:</span>
                        <p className="font-semibold text-gray-800">
                          {renewalData.plan_id
                            ? plans.find((p) => p.id === Number(renewalData.plan_id))?.nom || "Plan sélectionné"
                            : "Aucun plan sélectionné"}
                        </p>
                      </div>
                      <div>
                        <span className="text-green-700 font-medium">Durée:</span>
                        <p className="font-semibold text-gray-800">
                          {renewalData.date_debut && renewalData.date_fin
                            ? `${Math.ceil((new Date(renewalData.date_fin).getTime() - new Date(renewalData.date_debut).getTime()) / (1000 * 60 * 60 * 24))} jours`
                            : "Non définie"}
                        </p>
                      </div>
                      <div>
                        <span className="text-green-700 font-medium">Montant à payer:</span>
                        <p className="font-semibold text-gray-800 text-lg">
                          {renewalData.montant ? formatCurrency(Number(renewalData.montant)) : "Non défini"}
                        </p>
                      </div>
                      <div>
                        <span className="text-green-700 font-medium">Type:</span>
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                          Renouvellement
                        </Badge>
                      </div>
                      {priceCalculation && priceCalculation.discountAmount > 0 && (
                        <div className="col-span-2">
                          <span className="text-green-700 font-medium">Économie réalisée:</span>
                          <p className="font-semibold text-green-600 text-lg">
                            {formatCurrency(priceCalculation.discountAmount)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter className="pt-4 border-t border-indigo-100/50">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsRenewalOpen(false)
                    setRenewalData({
                      plan_id: "",
                      date_debut: "",
                      date_fin: "",
                      montant: "",
                      notes: "",
                      use_auto_calculation: true,
                      discount_percentage: 0,
                      custom_price: "",
                    })
                    setRenewalErrors({})
                    setPriceCalculation(null)
                  }}
                  disabled={isRenewing}
                  className="border-indigo-200 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50"
                >
                  Annuler
                </Button>
                <Button
                  onClick={confirmRenewal}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg"
                  disabled={
                    isRenewing ||
                    !renewalData.plan_id ||
                    !renewalData.date_debut ||
                    !renewalData.date_fin ||
                    !renewalData.montant
                  }
                >
                  {isRenewing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Renouvellement en cours...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Confirmer le renouvellement
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </RequireAuth>
  )
}
