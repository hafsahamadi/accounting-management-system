"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Eye, EyeOff, Shield, User, Mail, Lock, Building2, Calculator } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const API_BASE = "http://192.168.1.14:8000/api"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState("admin")

  const handleLogin = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Erreur de connexion")
      }

      const role = data.role

      if ((tab === "admin" && role !== "admin") || (tab === "accountant" && role !== "comptable")) {
        throw new Error("Vous n'avez pas les droits pour accéder à cette section")
      }

      sessionStorage.setItem("token", data.token)
      sessionStorage.setItem("userRole", role)

      if (role === "admin") {
        router.push("/admin/dashboard")
      } else if (role === "comptable") {
        router.push("/accountant/dashboard")
      }
    } catch (err: any) {
      setError(err.message || "Identifiants incorrects")
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-400/20 to-pink-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl shadow-blue-500/10">
          <CardHeader className="space-y-6 pb-8">
            {/* Logo/Brand */}
         

            <div className="text-center space-y-2">
             <CardTitle className="text-4xl font-bold bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 bg-clip-text text-transparent tracking-wide">
                Cleverbills
              </CardTitle>
              <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-blue-600 to-transparent mx-auto"></div>
              <CardDescription className="text-gray-600 text-base">
                Plateforme de gestion comptable 
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert
                variant="destructive"
                className="border-red-200 bg-red-50/50 animate-in slide-in-from-top-2 duration-300"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="admin" value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8 bg-gray-100/50 p-1 rounded-xl">
                <TabsTrigger
                  value="admin"
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
                >
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Super Admin</span>
                  <span className="sm:hidden">Admin</span>
                </TabsTrigger>
                <TabsTrigger
                  value="accountant"
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
                >
                  <Calculator className="w-4 h-4" />
                  Comptable
                </TabsTrigger>
              </TabsList>

              <TabsContent value="admin" className="space-y-6 animate-in fade-in-50 duration-300">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email" className="text-sm font-medium text-gray-700">
                      Adresse email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="admin@cleverbills.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-password" className="text-sm font-medium text-gray-700">
                      Mot de passe
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="admin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="pl-10 pr-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={loading}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="accountant" className="space-y-6 animate-in fade-in-50 duration-300">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountant-email" className="text-sm font-medium text-gray-700">
                      Adresse email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="accountant-email"
                        type="email"
                        placeholder="comptable@cleverbills.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountant-password" className="text-sm font-medium text-gray-700">
                      Mot de passe
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="accountant-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="pl-10 pr-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={loading}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Connexion en cours...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Se connecter
                </div>
              )}
            </Button>

            {/* Additional options 
            <div className="text-center">
              <button className="text-sm text-blue-600 hover:text-blue-700 transition-colors">
                Mot de passe oublié ?
              </button>
            </div>
            */}
          </CardContent>

          <CardFooter className="flex flex-col items-center space-y-4 pt-6">
          
            <p className="text-sm text-gray-500 font-medium">© 2025 Cleverbills </p>
          </CardFooter>
        </Card>

     
      </div>
    </div>
  )
}
