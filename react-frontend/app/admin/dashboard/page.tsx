"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import DashboardLayout from "@/components/dashboard-layout"
import RequireAuth from "@/components/RequireAuth"
import {
  Users,
  Building,
  FileText,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react"

const API_BASE = process.env.REACT_APP_API_URL || "http://192.168.1.14:8000/api"

interface StatsData {
  comptables: number
  entreprises: number
  documents: number
}

interface PendingCompany {
  id: number
  name: string
  accountant: string
  requestDate: string
}

interface RecentActivity {
  id: number
  action: string
  nom: string
  prenom: string
  created_at: string
}

export default function AdminDashboard() {
  const [statsData, setStatsData] = useState<StatsData>({
    comptables: 0,
    entreprises: 0,
    documents: 0,
  })
  const [pendingCompanies, setPendingCompanies] = useState<PendingCompany[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkApiBaseUrl = () => {
    if (!API_BASE || !API_BASE.startsWith("http")) {
      console.error("Erreur critique : REACT_APP_API_URL n'est pas défini correctement.")
      setError("Erreur de configuration du serveur.")
      setLoading(false)
      return false
    }
    return true
  }

  const fetchData = useCallback(async () => {
    if (!checkApiBaseUrl()) return
    setLoading(true)
    setError(null)
    const token = sessionStorage.getItem("token")

    if (!token) {
      setError("Authentification requise.")
      setLoading(false)
      return
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    }

    try {
      const [statsRes, entreprisesCountRes, documentsCountRes, activitiesRes, pendingCompaniesRes] = await Promise.all([
        fetch(`${API_BASE}/stats`, { headers }),
        fetch(`${API_BASE}/entreprises/count`, { headers }),
        fetch(`${API_BASE}/documents/count`, { headers }),
        fetch(`${API_BASE}/activities/recent`, { headers }),
        fetch(`${API_BASE}/pending-companies`, { headers }),
      ])

      const processResponse = async (res: Response, endpointName: string) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: `Erreur HTTP ${res.status}` }))
          console.error(`Erreur ${endpointName}:`, errorData)
          throw new Error(errorData.message || `Erreur ${res.status} pour ${endpointName}`)
        }
        return res.json()
      }

      const statsApiData = await processResponse(statsRes, "stats")
      const entreprisesCountData = await processResponse(entreprisesCountRes, "entreprises/count")
      const documentsCountData = await processResponse(documentsCountRes, "documents/count")
      const activitiesData = await processResponse(activitiesRes, "activities/recent")
      const pendingCompaniesData = await processResponse(pendingCompaniesRes, "pending-companies")

      setStatsData({
        comptables: statsApiData.comptables || 0,
        entreprises: entreprisesCountData.total_entreprises || 0,
        documents: documentsCountData.total_documents || 0,
      })

      setRecentActivities(Array.isArray(activitiesData) ? activitiesData : activitiesData.activities || [])

      const companies = Array.isArray(pendingCompaniesData)
        ? pendingCompaniesData
        : pendingCompaniesData.companies || pendingCompaniesData.pending_companies || []

      const mappedPendingCompanies: PendingCompany[] = companies.map((c: any) => ({
        id: c.id,
        name: c.nom_entreprise || c.name || "N/A",
        accountant: c.comptable ? `${c.comptable.prenom || ""} ${c.comptable.nom || ""}`.trim() : c.accountant || "N/A",
        requestDate: c.created_at ? new Date(c.created_at).toLocaleDateString("fr-FR") : "N/A",
      }))
      setPendingCompanies(mappedPendingCompanies)
    } catch (err: any) {
      console.error("Erreur lors du chargement des données:", err)
      setError(err.message || "Une erreur est survenue.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const stats = [
    {
      title: "Comptables",
      value: loading ? "..." : statsData.comptables.toString(),
      description: "Actifs sur la plateforme",
      icon: Users,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50/50",
      change: "+12%",
      trend: "up",
    },
    {
      title: "Entreprises",
      value: loading ? "..." : statsData.entreprises.toString(),
      description: "Enregistrées au total",
      icon: Building,
      color: "from-indigo-500 to-indigo-600",
      bgColor: "bg-indigo-50/50",
      change: "+8%",
      trend: "up",
    },
    {
      title: "Documents",
      value: loading ? "..." : statsData.documents.toString(),
      description: "Totaux sur la plateforme",
      icon: FileText,
      color: "from-slate-500 to-slate-600",
      bgColor: "bg-slate-50/50",
      change: "+23%",
      trend: "up",
    },
  ]

  if (error) {
    return (
      <RequireAuth>
        <DashboardLayout role="admin">
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
            <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl shadow-red-500/10 max-w-md">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Erreur de chargement</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={fetchData} className="bg-gradient-to-r from-blue-600 to-indigo-700">
                  Réessayer
                </Button>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </RequireAuth>
    )
  }

  return (
    <RequireAuth>
      <DashboardLayout role="admin">
        <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
          {/* Background decorative elements - matching login page */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-indigo-300/30 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-200/30 to-pink-200/30 rounded-full blur-3xl"></div>
          </div>

          <div className="relative space-y-8 p-6">
            {/* Header Section */}
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-wide">
                  Tableau de Bord Admin
                </h1>
                <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-blue-600 to-transparent mx-auto"></div>
                <p className="text-gray-600 text-base">Vue d'ensemble de la plateforme Cleverbills</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {stats.map((stat, index) => (
                <Card
                  key={index}
                  className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300"
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-medium text-gray-700">{stat.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                        {stat.trend === "up" && (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            {stat.change}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className={`rounded-xl p-3 bg-gradient-to-r ${stat.color} shadow-lg`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">{stat.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recent Activities */}
              <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl shadow-blue-500/10">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2 bg-gradient-to-r from-blue-500 to-blue-600">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold text-gray-900">Activités récentes</CardTitle>
                      <CardDescription className="text-gray-600">
                        Les dernières actions effectuées sur la plateforme
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      </div>
                    ) : recentActivities.length > 0 ? (
                      recentActivities.slice(0, 5).map((activity, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-50/50 to-blue-50/50 border border-gray-100/50 hover:shadow-md transition-all duration-200"
                        >
                          <div className="rounded-full p-2 bg-blue-100">
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                            <p className="text-sm text-gray-600">
                              {activity.nom} {activity.prenom}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {new Date(activity.created_at).toLocaleString("fr-FR")}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Aucune activité récente</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Pending Companies */}
              <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl shadow-blue-500/10">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2 bg-gradient-to-r from-indigo-500 to-indigo-600">
                      <Building className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold text-gray-900">Entreprises en attente</CardTitle>
                      <CardDescription className="text-gray-600">
                        Validation requise par l'administrateur
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      </div>
                    ) : pendingCompanies.length > 0 ? (
                      pendingCompanies.slice(0, 4).map((company) => (
                        <div
                          key={company.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50/50 to-indigo-50/50 border border-gray-100/50 hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex items-start gap-4">
                            <div className="rounded-full p-2 bg-amber-100">
                              <Clock className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-gray-900">{company.name}</p>
                              <p className="text-sm text-gray-600">Ajoutée par: {company.accountant}</p>
                              <p className="text-xs text-gray-500">{company.requestDate}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Valider
                            </Button>
                            <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                              <XCircle className="w-3 h-3 mr-1" />
                              Refuser
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Building className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Aucune entreprise en attente</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

          
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  )
}
