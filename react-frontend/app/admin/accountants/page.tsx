"use client"

import type React from "react"

import { useEffect, useState, useCallback } from "react"
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
  UserPlus,
  Loader2,
  AlertTriangle,
  Users,
  Mail,
  Calendar,
  Building,
  Edit,
  Trash2,
} from "lucide-react"
import Link from "next/link"

const API_BASE = process.env.REACT_APP_API_URL || "http://192.168.1.14:8000/api"

interface Accountant {
  id: number
  nom: string
  prenom: string
  email: string
  entreprises_count?: number
  entreprises?: number
  statut: "actif" | "inactif"
  created_at: string
  createdAt?: string
}

interface AccountantForm {
  nom: string
  prenom: string
  email: string
  password?: string
}

export default function AccountantsPage() {
  const [accountants, setAccountants] = useState<Accountant[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const initialNewAccountantState: AccountantForm & { password_confirmation?: string } = {
    nom: "",
    prenom: "",
    email: "",
    password: "",
    password_confirmation: "",
  }
  const [newAccountant, setNewAccountant] = useState(initialNewAccountantState)

  const initialSelectedAccountantState: Omit<
    Accountant,
    "entreprises_count" | "entreprises" | "statut" | "created_at" | "createdAt"
  > & { password?: string; password_confirmation?: string } = {
    id: 0,
    nom: "",
    prenom: "",
    email: "",
  }
  const [selectedAccountant, setSelectedAccountant] = useState<typeof initialSelectedAccountantState | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const checkApiBaseUrl = () => {
    if (!API_BASE || !API_BASE.startsWith("http")) {
      console.error("Erreur critique : REACT_APP_API_URL n'est pas défini correctement.")
      setError("Erreur de configuration du serveur.")
      setLoading(false)
      return false
    }
    return true
  }

  const fetchAccountants = useCallback(async () => {
    if (!checkApiBaseUrl()) return
    setLoading(true)
    setError(null)
    try {
      const token = sessionStorage.getItem("token")
      if (!token) {
        setError("Authentification requise.")
        setLoading(false)
        return
      }

      const res = await fetch(`${API_BASE}/accountants`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: `Erreur HTTP ${res.status}` }))
        throw new Error(errorData.message || `Erreur ${res.status} lors du chargement des comptables.`)
      }

      const data = await res.json()
      setAccountants(data.accountants || data || [])
    } catch (error: any) {
      console.error("Erreur lors du chargement des comptables:", error)
      setError(error.message || "Une erreur inconnue est survenue.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccountants()
  }, [fetchAccountants])

  const filteredAccountants = accountants.filter(
    (a) =>
      a.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const validateForm = (isEdit = false): boolean => {
    const errors: Record<string, string> = {}
    const dataToValidate = isEdit ? selectedAccountant : newAccountant
    if (!dataToValidate) return false

    if (!dataToValidate.nom.trim()) errors.nom = "Le nom est requis."
    if (!dataToValidate.prenom.trim()) errors.prenom = "Le prénom est requis."
    if (!dataToValidate.email.trim()) errors.email = "L'email est requis."
    else if (!/\S+@\S+\.\S+/.test(dataToValidate.email)) errors.email = "L'email n'est pas valide."

    if (!isEdit && (!dataToValidate.password || dataToValidate.password.length < 8)) {
      errors.password = "Le mot de passe est requis et doit comporter au moins 8 caractères."
    }
    if (dataToValidate.password && (dataToValidate as any).password_confirmation !== dataToValidate.password) {
      errors.password_confirmation = "Les mots de passe ne correspondent pas."
    }
    if (isEdit && dataToValidate.password && !(dataToValidate as any).password_confirmation) {
      errors.password_confirmation = "Veuillez confirmer le nouveau mot de passe."
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleAddAccountant = async () => {
    if (!validateForm()) return
    if (!checkApiBaseUrl()) return
    setIsSubmitting(true)
    setError(null)

    try {
      const token = sessionStorage.getItem("token")
      if (!token) throw new Error("Authentification requise.")

      const payload = {
        nom: newAccountant.nom,
        prenom: newAccountant.prenom,
        email: newAccountant.email,
        password: newAccountant.password,
        password_confirmation: (newAccountant as any).password_confirmation,
      }

      const res = await fetch(`${API_BASE}/accountants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const responseData = await res.json()

      if (!res.ok) {
        if (res.status === 422 && responseData.errors) {
          const laravelErrors: Record<string, string> = {}
          for (const key in responseData.errors) laravelErrors[key] = responseData.errors[key][0]
          setFormErrors(laravelErrors)
          throw new Error("Erreurs de validation.")
        }
        throw new Error(responseData.message || "Échec de la création du comptable.")
      }

      alert("Comptable ajouté avec succès!")
      fetchAccountants()
      setNewAccountant(initialNewAccountantState)
      setIsAddDialogOpen(false)
    } catch (error: any) {
      console.error("Erreur lors de l'ajout du comptable:", error)
      setError(error.message)
      if (error.message !== "Erreurs de validation.") {
        alert(`Erreur: ${error.message}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAccountant = async (id: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce comptable ? Cette action est irréversible.")) return
    if (!checkApiBaseUrl()) return

    try {
      const token = sessionStorage.getItem("token")
      if (!token) throw new Error("Authentification requise.")

      const res = await fetch(`${API_BASE}/accountants/${id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: `Erreur HTTP ${res.status}` }))
        throw new Error(errorData.message || `Suppression échouée (${res.status})`)
      }
      alert("Comptable supprimé avec succès.")
      fetchAccountants()
    } catch (error: any) {
      console.error("Erreur lors de la suppression:", error)
      alert(`Erreur: ${error.message}`)
    }
  }

  const openEditDialog = (accountant: Accountant) => {
    setSelectedAccountant({
      id: accountant.id,
      nom: accountant.nom,
      prenom: accountant.prenom,
      email: accountant.email,
      password: "",
      password_confirmation: "",
    })
    setFormErrors({})
    setIsEditDialogOpen(true)
  }

  const handleUpdateAccountant = async () => {
    if (!selectedAccountant) return
    if (!validateForm(true)) return
    if (!checkApiBaseUrl()) return
    setIsSubmitting(true)
    setError(null)

    try {
      const token = sessionStorage.getItem("token")
      if (!token) throw new Error("Authentification requise.")

      const payload: any = {
        nom: selectedAccountant.nom,
        prenom: selectedAccountant.prenom,
        email: selectedAccountant.email,
      }

      if (selectedAccountant.password) {
        payload.password = selectedAccountant.password
        payload.password_confirmation = (selectedAccountant as any).password_confirmation
      }

      const res = await fetch(`${API_BASE}/accountants/${selectedAccountant.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      const responseData = await res.json()

      if (!res.ok) {
        if (res.status === 422 && responseData.errors) {
          const laravelErrors: Record<string, string> = {}
          for (const key in responseData.errors) laravelErrors[key] = responseData.errors[key][0]
          setFormErrors(laravelErrors)
          throw new Error("Erreurs de validation.")
        }
        throw new Error(responseData.message || "Échec de la mise à jour du comptable.")
      }

      alert("Comptable mis à jour avec succès!")
      fetchAccountants()
      setIsEditDialogOpen(false)
      setSelectedAccountant(null)
    } catch (error: any) {
      console.error("Erreur lors de la mise à jour:", error)
      setError(error.message)
      if (error.message !== "Erreurs de validation.") {
        alert(`Erreur: ${error.message}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, formType: "add" | "edit") => {
    const { name, value } = e.target
    if (formType === "add") {
      setNewAccountant((prev) => ({ ...prev, [name]: value }))
    } else if (formType === "edit" && selectedAccountant) {
      setSelectedAccountant((prev) => (prev ? { ...prev, [name]: value } : null))
    }
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }))
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
                  <p className="text-gray-600 font-medium">Chargement des comptables...</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </DashboardLayout>
      </RequireAuth>
    )
  }

  if (error && accountants.length === 0) {
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
                    onClick={fetchAccountants}
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
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        Gestion des Comptables
                      </CardTitle>
                      <CardDescription className="text-gray-600 mt-1">
                        Gérez les comptes comptables de votre plateforme
                      </CardDescription>
                    </div>
                  </div>

                  <Dialog
                    open={isAddDialogOpen}
                    onOpenChange={(isOpen) => {
                      setIsAddDialogOpen(isOpen)
                      if (!isOpen) {
                        setNewAccountant(initialNewAccountantState)
                        setFormErrors({})
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Ajouter un comptable
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="backdrop-blur-md bg-white/95 border-0 shadow-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-gray-800">
                          Ajouter un nouveau comptable
                        </DialogTitle>
                        <DialogDescription className="text-gray-600">
                          Créez un compte pour un nouveau comptable sur la plateforme.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          handleAddAccountant()
                        }}
                        className="grid gap-4 py-4"
                      >
                        <div className="grid gap-2">
                          <Label htmlFor="add-nom" className="text-sm font-medium text-gray-700">
                            Nom
                          </Label>
                          <Input
                            id="add-nom"
                            name="nom"
                            value={newAccountant.nom}
                            onChange={(e) => handleInputChange(e, "add")}
                            className={`h-11 ${formErrors.nom ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-blue-400"} rounded-lg`}
                          />
                          {formErrors.nom && <p className="text-xs text-red-500">{formErrors.nom}</p>}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="add-prenom" className="text-sm font-medium text-gray-700">
                            Prénom
                          </Label>
                          <Input
                            id="add-prenom"
                            name="prenom"
                            value={newAccountant.prenom}
                            onChange={(e) => handleInputChange(e, "add")}
                            className={`h-11 ${formErrors.prenom ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-blue-400"} rounded-lg`}
                          />
                          {formErrors.prenom && <p className="text-xs text-red-500">{formErrors.prenom}</p>}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="add-email" className="text-sm font-medium text-gray-700">
                            Email
                          </Label>
                          <Input
                            id="add-email"
                            name="email"
                            type="email"
                            value={newAccountant.email}
                            onChange={(e) => handleInputChange(e, "add")}
                            className={`h-11 ${formErrors.email ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-blue-400"} rounded-lg`}
                          />
                          {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="add-password" className="text-sm font-medium text-gray-700">
                            Mot de passe
                          </Label>
                          <Input
                            id="add-password"
                            name="password"
                            type="password"
                            value={newAccountant.password}
                            onChange={(e) => handleInputChange(e, "add")}
                            className={`h-11 ${formErrors.password ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-blue-400"} rounded-lg`}
                          />
                          {formErrors.password && <p className="text-xs text-red-500">{formErrors.password}</p>}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="add-password_confirmation" className="text-sm font-medium text-gray-700">
                            Confirmer le mot de passe
                          </Label>
                          <Input
                            id="add-password_confirmation"
                            name="password_confirmation"
                            type="password"
                            value={(newAccountant as any).password_confirmation}
                            onChange={(e) => handleInputChange(e, "add")}
                            className={`h-11 ${formErrors.password_confirmation ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-blue-400"} rounded-lg`}
                          />
                          {formErrors.password_confirmation && (
                            <p className="text-xs text-red-500">{formErrors.password_confirmation}</p>
                          )}
                        </div>
                        <DialogFooter className="gap-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsAddDialogOpen(false)}
                            disabled={isSubmitting}
                            className="border-gray-200 hover:bg-gray-50"
                          >
                            Annuler
                          </Button>
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                          >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Créer le compte
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
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
                    placeholder="Rechercher par nom, prénom ou email..."
                    className="max-w-sm h-11 border-gray-200 focus:border-blue-400 rounded-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      {filteredAccountants.length} résultat{filteredAccountants.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Error Display */}
            {error && !isAddDialogOpen && !isEditDialogOpen && (
              <Card className="backdrop-blur-md bg-red-50/90 border-0 shadow-xl shadow-red-200/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <p className="text-red-700 font-medium">{error}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Table Section */}
            <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-blue-200/20">
              <CardContent className="p-0">
                <div className="rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 hover:from-blue-50/70 hover:to-indigo-50/70">
                        <TableHead className="font-semibold text-gray-700">Nom</TableHead>
                        <TableHead className="font-semibold text-gray-700">Prénom</TableHead>
                        <TableHead className="font-semibold text-gray-700">Email</TableHead>
                        <TableHead className="text-center font-semibold text-gray-700">Entreprises</TableHead>
                        <TableHead className="font-semibold text-gray-700">Créé le</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAccountants.length > 0 ? (
                        filteredAccountants.map((accountant, index) => (
                          <TableRow
                            key={accountant.id}
                            className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/30 transition-all duration-200"
                          >
                            <TableCell className="font-medium text-gray-900">{accountant.nom}</TableCell>
                            <TableCell className="text-gray-700">{accountant.prenom}</TableCell>
                            <TableCell className="text-gray-600">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-gray-400" />
                                {accountant.email}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Link
                                href={`/admin/companies?accountantId=${accountant.id}&accountantName=${encodeURIComponent(`${accountant.prenom} ${accountant.nom}`)}`}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 hover:from-blue-200 hover:to-indigo-200 transition-all duration-200 font-medium"
                              >
                                <Building className="h-3 w-3" />
                                {accountant.entreprises_count ?? accountant.entreprises ?? 0}
                              </Link>
                            </TableCell>
                            <TableCell className="text-gray-600">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                {accountant.created_at
                                  ? new Date(accountant.created_at).toLocaleDateString("fr-FR")
                                  : accountant.createdAt
                                    ? new Date(accountant.createdAt).toLocaleDateString("fr-FR")
                                    : "N/A"}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="backdrop-blur-md bg-white/95 border-0 shadow-xl"
                                >
                                  <DropdownMenuItem
                                    onClick={() => openEditDialog(accountant)}
                                    className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Modifier
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteAccountant(accountant.id)}
                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <Users className="h-12 w-12 text-gray-300" />
                              <p className="text-gray-500 font-medium">
                                {searchTerm
                                  ? "Aucun comptable ne correspond à votre recherche."
                                  : "Aucun comptable trouvé."}
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

            {/* Edit Dialog */}
            <Dialog
              open={isEditDialogOpen}
              onOpenChange={(isOpen) => {
                setIsEditDialogOpen(isOpen)
                if (!isOpen) {
                  setSelectedAccountant(null)
                  setFormErrors({})
                }
              }}
            >
              <DialogContent className="backdrop-blur-md bg-white/95 border-0 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold text-gray-800">Modifier le comptable</DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Modifiez les informations de ce comptable.
                  </DialogDescription>
                </DialogHeader>
                {selectedAccountant && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleUpdateAccountant()
                    }}
                    className="grid gap-4 py-4"
                  >
                    <div className="grid gap-2">
                      <Label htmlFor="edit-nom" className="text-sm font-medium text-gray-700">
                        Nom
                      </Label>
                      <Input
                        id="edit-nom"
                        name="nom"
                        value={selectedAccountant.nom}
                        onChange={(e) => handleInputChange(e, "edit")}
                        className={`h-11 ${formErrors.nom ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-blue-400"} rounded-lg`}
                      />
                      {formErrors.nom && <p className="text-xs text-red-500">{formErrors.nom}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-prenom" className="text-sm font-medium text-gray-700">
                        Prénom
                      </Label>
                      <Input
                        id="edit-prenom"
                        name="prenom"
                        value={selectedAccountant.prenom}
                        onChange={(e) => handleInputChange(e, "edit")}
                        className={`h-11 ${formErrors.prenom ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-blue-400"} rounded-lg`}
                      />
                      {formErrors.prenom && <p className="text-xs text-red-500">{formErrors.prenom}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-email" className="text-sm font-medium text-gray-700">
                        Email
                      </Label>
                      <Input
                        id="edit-email"
                        name="email"
                        type="email"
                        value={selectedAccountant.email}
                        onChange={(e) => handleInputChange(e, "edit")}
                        className={`h-11 ${formErrors.email ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-blue-400"} rounded-lg`}
                      />
                      {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-password" className="text-sm font-medium text-gray-700">
                        Nouveau mot de passe (laisser vide pour ne pas changer)
                      </Label>
                      <Input
                        id="edit-password"
                        name="password"
                        type="password"
                        value={selectedAccountant.password || ""}
                        onChange={(e) => handleInputChange(e, "edit")}
                        className={`h-11 ${formErrors.password ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-blue-400"} rounded-lg`}
                      />
                      {formErrors.password && <p className="text-xs text-red-500">{formErrors.password}</p>}
                    </div>
                    {selectedAccountant.password && (
                      <div className="grid gap-2">
                        <Label htmlFor="edit-password_confirmation" className="text-sm font-medium text-gray-700">
                          Confirmer le nouveau mot de passe
                        </Label>
                        <Input
                          id="edit-password_confirmation"
                          name="password_confirmation"
                          type="password"
                          value={(selectedAccountant as any).password_confirmation || ""}
                          onChange={(e) => handleInputChange(e, "edit")}
                          className={`h-11 ${formErrors.password_confirmation ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-blue-400"} rounded-lg`}
                        />
                        {formErrors.password_confirmation && (
                          <p className="text-xs text-red-500">{formErrors.password_confirmation}</p>
                        )}
                      </div>
                    )}
                    <DialogFooter className="gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditDialogOpen(false)}
                        disabled={isSubmitting}
                        className="border-gray-200 hover:bg-gray-50"
                      >
                        Annuler
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                      >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Enregistrer
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  )
}
