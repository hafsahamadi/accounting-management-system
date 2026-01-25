"use client"

import { useState, useEffect } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import RequireAuth from "@/components/RequireAuth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, Settings, Lock, Mail, Save, AlertCircle, CheckCircle, Loader2 } from "lucide-react"

const API_BASE = "http://192.168.1.14:8000/api"

export default function AccountantSettingsPage() {
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Chargement du profil au montage
  useEffect(() => {
    ;(async () => {
      try {
        setIsLoading(true)
        setError(null)

        const token = sessionStorage.getItem("token")

        if (!token) {
          setError("Session expirée, veuillez vous reconnecter")
          setIsLoading(false)
          return
        }

        const res = await fetch(`${API_BASE}/profile-web`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const { name, email } = await res.json()
        const [firstName, lastName = ""] = (name || "").split(" ", 2)

        setProfile((prev) => ({
          ...prev,
          firstName,
          lastName,
          email,
          phone: "",
        }))
      } catch (err) {
        console.error("Erreur chargement profil :", err)
        setError("Impossible de charger vos informations.")
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  const handleProfileChange = (key: string, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
    // Clear messages when user starts typing
    if (error) setError(null)
    if (success) setSuccess(null)
  }

  const handleSaveProfile = async () => {
    if (profile.newPassword && profile.newPassword !== profile.confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      setSuccess(null)

      const token = sessionStorage.getItem("token")

      const payload: any = {
        name: `${profile.firstName} ${profile.lastName}`.trim(),
        email: profile.email,
      }

      if (profile.newPassword) {
        payload.currentPassword = profile.currentPassword
        payload.newPassword = profile.newPassword
        payload.newPassword_confirmation = profile.confirmPassword
      }

      const res = await fetch(`${API_BASE}/profile/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || err.message || `HTTP ${res.status}`)
      }

      setSuccess("Profil mis à jour avec succès !")
      setProfile((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }))
    } catch (err: any) {
      console.error("Erreur mise à jour profil :", err)
      setError(err.message || "Erreur lors de la mise à jour de votre profil.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout role="accountant">
        <div className="flex justify-center items-center h-[calc(100vh-var(--header-height,80px))]">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-3 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
            <p className="text-xl font-medium text-gray-700">Chargement de vos paramètres...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <RequireAuth>
      <DashboardLayout role="accountant">
        <div className="p-4 md:p-6 space-y-6">
          {/* Header avec style doux */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-md">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
                Paramètres
              </h2>
            </div>
            <div className="w-32 h-0.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-400 rounded-full ml-14"></div>
          </div>

          {/* Messages d'état avec style doux */}
          {error && (
            <div className="backdrop-blur-md bg-red-50/90 border border-red-200/50 rounded-xl p-4 shadow-lg shadow-red-100/50">
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-1 bg-gradient-to-r from-red-500 to-rose-600 shadow-sm">
                  <AlertCircle className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-red-800 font-medium">{error}</p>
                </div>
                <button
                  className="rounded-lg p-1 hover:bg-red-100/50 transition-colors"
                  onClick={() => setError(null)}
                  aria-label="Fermer l'alerte"
                >
                  <svg
                    className="fill-current h-4 w-4 text-red-500"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {success && (
            <div className="backdrop-blur-md bg-green-50/90 border border-green-200/50 rounded-xl p-4 shadow-lg shadow-green-100/50">
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-1 bg-gradient-to-r from-green-500 to-emerald-600 shadow-sm">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-green-800 font-medium">{success}</p>
                </div>
                <button
                  className="rounded-lg p-1 hover:bg-green-100/50 transition-colors"
                  onClick={() => setSuccess(null)}
                  aria-label="Fermer l'alerte"
                >
                  <svg
                    className="fill-current h-4 w-4 text-green-500"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Tabs avec style doux */}
          <div className="backdrop-blur-md bg-white/90 rounded-xl shadow-lg shadow-blue-100/20 border border-blue-100/50 overflow-hidden">
            <Tabs defaultValue="profile" className="space-y-0">
            

              <TabsContent value="profile" className="p-0 m-0">
                <Card className="border-0 shadow-none bg-transparent">
                  <CardHeader className="bg-gradient-to-r from-emerald-50/30 to-teal-50/30 border-b border-emerald-100/30">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg p-2 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-md">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">
                          Informations Personnelles
                        </CardTitle>
                        <CardDescription className="text-gray-600">
                          Modifiez vos informations et votre mot de passe
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 p-6">
                    {/* Section informations personnelles */}
                    <div className="backdrop-blur-sm bg-gradient-to-br from-emerald-50/30 to-teal-50/30 rounded-xl p-4 border border-emerald-200/30">
                      <div className="flex items-center gap-2 mb-4">
                        <Mail className="h-4 w-4 text-emerald-600" />
                        <h4 className="font-medium text-emerald-800">Informations de base</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName" className="text-emerald-700 font-medium">
                            Prénom
                          </Label>
                          <Input
                            id="firstName"
                            value={profile.firstName}
                            onChange={(e) => handleProfileChange("firstName", e.target.value)}
                            className="rounded-lg border-blue-200/50 focus:border-emerald-300 focus:ring-emerald-200/50 bg-white/80"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName" className="text-emerald-700 font-medium">
                            Nom
                          </Label>
                          <Input
                            id="lastName"
                            value={profile.lastName}
                            onChange={(e) => handleProfileChange("lastName", e.target.value)}
                            className="rounded-lg border-blue-200/50 focus:border-emerald-300 focus:ring-emerald-200/50 bg-white/80"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 mt-4">
                        <Label htmlFor="email" className="text-emerald-700 font-medium">
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={profile.email}
                          onChange={(e) => handleProfileChange("email", e.target.value)}
                          className="rounded-lg border-blue-200/50 focus:border-emerald-300 focus:ring-emerald-200/50 bg-white/80"
                        />
                      </div>
                    </div>

                    {/* Section changement de mot de passe */}
                    <div className="backdrop-blur-sm bg-gradient-to-br from-blue-50/30 to-indigo-50/30 rounded-xl p-4 border border-blue-200/30">
                      <div className="flex items-center gap-2 mb-4">
                        <Lock className="h-4 w-4 text-blue-600" />
                        <h4 className="font-medium text-blue-800">Changer le mot de passe</h4>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="currentPassword" className="text-blue-700 font-medium">
                            Mot de passe actuel
                          </Label>
                          <Input
                            id="currentPassword"
                            type="password"
                            value={profile.currentPassword}
                            onChange={(e) => handleProfileChange("currentPassword", e.target.value)}
                            className="rounded-lg border-blue-200/50 focus:border-blue-300 focus:ring-blue-200/50 bg-white/80"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newPassword" className="text-blue-700 font-medium">
                            Nouveau mot de passe
                          </Label>
                          <Input
                            id="newPassword"
                            type="password"
                            value={profile.newPassword}
                            onChange={(e) => handleProfileChange("newPassword", e.target.value)}
                            className="rounded-lg border-blue-200/50 focus:border-blue-300 focus:ring-blue-200/50 bg-white/80"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword" className="text-blue-700 font-medium">
                            Confirmer le nouveau mot de passe
                          </Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            value={profile.confirmPassword}
                            onChange={(e) => handleProfileChange("confirmPassword", e.target.value)}
                            className="rounded-lg border-blue-200/50 focus:border-blue-300 focus:ring-blue-200/50 bg-white/80"
                          />
                        </div>
                        {profile.newPassword &&
                          profile.confirmPassword &&
                          profile.newPassword !== profile.confirmPassword && (
                            <div className="flex items-center gap-2 text-red-600 text-sm">
                              <AlertCircle className="h-4 w-4" />
                              <span>Les mots de passe ne correspondent pas</span>
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Bouton de sauvegarde avec style doux */}
                    <div className="pt-4 border-t border-emerald-100/50">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg rounded-lg py-3 font-medium transition-all duration-200"
                      >
                        {isSaving ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Sauvegarde en cours...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Save className="h-4 w-4" />
                            <span>Sauvegarder les modifications</span>
                          </div>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  )
}
