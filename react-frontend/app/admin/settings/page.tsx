"use client"

import { useState, useEffect } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import RequireAuth from "@/components/RequireAuth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { User, Bell, Settings, Lock, Mail, Loader2, AlertTriangle } from "lucide-react"

const API_BASE = "http://192.168.1.14:8000/api"

export default function AccountantSettingsPage() {
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [notifications, setNotifications] = useState({
    emailNotifications: false,
    newAccountantAlert: false,
    companyValidationAlert: false,
  })

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const [resProfile, resNotif] = await Promise.all([
          fetch(`${API_BASE}/profile-web`, {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem("token")}`,
            },
          }),
          fetch(`${API_BASE}/admin/notifications`, {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem("token")}`,
            },
          }),
        ])

        if (!resProfile.ok) throw new Error(`Profil HTTP ${resProfile.status}`)
        if (!resNotif.ok) throw new Error(`Notif HTTP ${resNotif.status}`)

        const { name, email } = await resProfile.json()
        const notifData = await resNotif.json()

        const [firstName, lastName = ""] = (name || "").split(" ", 2)

        setProfile({
          firstName,
          lastName,
          email,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        })

        setNotifications({
          emailNotifications: !!notifData.emailNotifications,
          newAccountantAlert: !!notifData.newAccountantAlert,
          companyValidationAlert: !!notifData.companyValidationAlert,
        })
      } catch (err: any) {
        console.error(err)
        setErrorMessage(err.message || "Erreur de chargement")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleProfileChange = (key: keyof typeof profile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  const handleNotificationChange = (key: keyof typeof notifications, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveProfile = async () => {
    if (profile.newPassword && profile.newPassword !== profile.confirmPassword) {
      alert("Les mots de passe ne correspondent pas")
      return
    }
    setIsSaving(true)
    try {
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
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || err.message || `HTTP ${res.status}`)
      }
      alert("Profil mis à jour avec succès !")
      setProfile((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }))
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de la mise à jour du profil")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`${API_BASE}/admin/notifications`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify(notifications),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      alert("Notifications enregistrées")
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de la mise à jour des notifications")
    } finally {
      setIsSaving(false)
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
                  <p className="text-gray-600 font-medium">Chargement des paramètres...</p>
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
                    <Settings className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Paramètres
                    </CardTitle>
                    <CardDescription className="text-gray-600 mt-1">
                      Gérez votre profil 
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Error Display */}
            {errorMessage && (
              <Card className="backdrop-blur-md bg-red-50/90 border-0 shadow-xl shadow-red-200/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <p className="text-red-700 font-medium">{errorMessage}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Content */}
            <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-blue-200/20">
              <CardContent className="p-6">
                <Tabs defaultValue="profile" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-blue-50 to-indigo-50 p-1 rounded-lg">
                    <TabsTrigger
                      value="profile"
                      className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >
                      <User className="h-4 w-4" />
                      Profil
                    </TabsTrigger>
                    {/* <TabsTrigger
                      value="notifications"
                      className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >
                     <Bell className="h-4 w-4" />
                      Notifications
                     
                    </TabsTrigger>
                     */}
                  </TabsList>

                  {/* Profile Tab */}
                  <TabsContent value="profile" className="space-y-6">
                    <Card className="backdrop-blur-md bg-white/80 border-0 shadow-lg shadow-blue-100/20">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg p-2 bg-gradient-to-r from-blue-100 to-indigo-100">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold text-gray-800">
                              Informations Personnelles
                            </CardTitle>
                            <CardDescription className="text-gray-600">
                              Modifiez vos informations personnelles
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Name Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName" className="font-semibold text-gray-700">
                              Nom
                            </Label>
                            <Input
                              id="firstName"
                              value={profile.firstName}
                              onChange={(e) => handleProfileChange("firstName", e.target.value)}
                              className="h-11 border-gray-200 focus:border-blue-400 rounded-lg"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName" className="font-semibold text-gray-700">
                              Prénom
                            </Label>
                            <Input
                              id="lastName"
                              value={profile.lastName}
                              onChange={(e) => handleProfileChange("lastName", e.target.value)}
                              className="h-11 border-gray-200 focus:border-blue-400 rounded-lg"
                            />
                          </div>
                        </div>

                        {/* Email Field */}
                        <div className="space-y-2">
                          <Label htmlFor="email" className="font-semibold text-gray-700">
                            Email
                          </Label>
                          <div className="relative">
                            <div className="rounded-lg p-2 bg-gradient-to-r from-blue-100 to-indigo-100 absolute left-3 top-1/2 -translate-y-1/2">
                              <Mail className="h-4 w-4 text-blue-600" />
                            </div>
                            <Input
                              id="email"
                              type="email"
                              value={profile.email}
                              onChange={(e) => handleProfileChange("email", e.target.value)}
                              className="pl-12 h-11 border-gray-200 focus:border-blue-400 rounded-lg"
                            />
                          </div>
                        </div>

                      </CardContent>
                    </Card>

                    {/* Password Change Section */}
                    <Card className="backdrop-blur-md bg-white/80 border-0 shadow-lg shadow-blue-100/20">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg p-2 bg-gradient-to-r from-orange-100 to-red-100">
                            <Lock className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold text-gray-800">
                              Changer le mot de passe
                            </CardTitle>
                            <CardDescription className="text-gray-600">
                              Modifiez votre mot de passe de connexion
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="currentPassword" className="font-semibold text-gray-700">
                            Mot de passe actuel
                          </Label>
                          <Input
                            id="currentPassword"
                            type="password"
                            value={profile.currentPassword}
                            onChange={(e) => handleProfileChange("currentPassword", e.target.value)}
                            className="h-11 border-gray-200 focus:border-orange-400 rounded-lg"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newPassword" className="font-semibold text-gray-700">
                            Nouveau mot de passe
                          </Label>
                          <Input
                            id="newPassword"
                            type="password"
                            value={profile.newPassword}
                            onChange={(e) => handleProfileChange("newPassword", e.target.value)}
                            className="h-11 border-gray-200 focus:border-orange-400 rounded-lg"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword" className="font-semibold text-gray-700">
                            Confirmer le nouveau mot de passe
                          </Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            value={profile.confirmPassword}
                            onChange={(e) => handleProfileChange("confirmPassword", e.target.value)}
                            className="h-11 border-gray-200 focus:border-orange-400 rounded-lg"
                          />
                        </div>
                           <Button
                          onClick={handleSaveProfile}
                          disabled={isSaving}
                          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white h-11 shadow-lg"
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Sauvegarder le profil
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Notifications Tab 
                  <TabsContent value="notifications" className="space-y-6">
                    <Card className="backdrop-blur-md bg-white/80 border-0 shadow-lg shadow-blue-100/20">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg p-2 bg-gradient-to-r from-green-100 to-emerald-100">
                            <Bell className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold text-gray-800">
                              Préférences de Notifications
                            </CardTitle>
                            <CardDescription className="text-gray-600">
                              Configurez vos notifications et alertes
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {(["emailNotifications", "newAccountantAlert", "companyValidationAlert"] as const).map(
                          (key) => (
                            <div
                              key={key}
                              className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200"
                            >
                              <div className="flex-1">
                                <Label className="font-semibold text-gray-800 cursor-pointer">
                                  {
                                    {
                                      emailNotifications: "Notifications par email",
                                      newAccountantAlert: "Alerte nouveau comptable",
                                      companyValidationAlert: "Alerte validation entreprise",
                                    }[key]
                                  }
                                </Label>
                                <p className="text-sm text-gray-600 mt-1">
                                  {
                                    {
                                      emailNotifications: "Recevoir les notifications par email",
                                      newAccountantAlert: "Être notifié lors de l'ajout d'un nouveau comptable",
                                      companyValidationAlert: "Être notifié lors de la validation d'une entreprise",
                                    }[key]
                                  }
                                </p>
                              </div>
                              <Switch
                                checked={notifications[key]}
                                onCheckedChange={(v) => handleNotificationChange(key, v)}
                                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-indigo-600"
                              />
                            </div>
                          ),
                        )}

                        <Button
                          onClick={handleSaveNotifications}
                          disabled={isSaving}
                          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white h-11 shadow-lg"
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Enregistrer les notifications
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  */}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  )
}
