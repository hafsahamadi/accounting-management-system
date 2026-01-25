"use client"

import { useEffect, useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import DashboardLayout from "@/components/dashboard-layout"
import { Building, FileText, CheckCircle, AlertCircle, Loader2, TrendingUp, Activity, Clock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import RequireAuth from "@/components/RequireAuth"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://192.168.1.14:8000/api"

interface RecentDocument {
  nom_fichier: string
  type: string
  statut: string
  uploaded_at: string
}

interface Entreprise {
  nom: string
  document_count: number
}

export default function AccountantDashboard() {
  const [statsData, setStatsData] = useState({
    entreprises: 0,
    documents: 0,
    traites: 0,
    enAttente: 0,
  })

  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([])
  const [entreprisesListe, setEntreprisesListe] = useState<Entreprise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    const token = typeof window !== "undefined" ? sessionStorage.getItem("token") : null

    if (!token) {
      setError("Authentification requise. Veuillez vous reconnecter.")
      setLoading(false)
      return
    }

    if (!API_BASE || !API_BASE.startsWith("http")) {
      console.error("Erreur critique : API_BASE n'est pas défini correctement.")
      setError("Erreur de configuration du serveur. Impossible de charger les données.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      }

      const [entreprisesRes, documentsRes, traitesRes, enAttenteRes, recentDocsRes, entreprisesListRes] =
        await Promise.all([
          fetch(`${API_BASE}/entreprises/countE`, { headers }),
          fetch(`${API_BASE}/documents/counte`, { headers }),
          fetch(`${API_BASE}/documents/traites`, { headers }),
          fetch(`${API_BASE}/documents/en-attente`, { headers }),
          fetch(`${API_BASE}/documents/all-recent`, { headers }),
          fetch(`${API_BASE}/entreprises/list`, { headers }),
        ])

      const processResponse = async (res: Response, endpointName: string) => {
        if (!res.ok) {
          const errorText = await res.text().catch(() => `Impossible de lire le texte de l'erreur pour ${endpointName}`)
          console.error(`Erreur ${endpointName}:`, res.status, errorText)
          if (res.status === 401) {
            throw new Error(`Session expirée ou token invalide pour ${endpointName}. Veuillez vous reconnecter.`)
          }
          throw new Error(`Échec du chargement ${endpointName} (HTTP ${res.status})`)
        }
        return res.json()
      }

      const entreprisesData = await processResponse(entreprisesRes, "entreprises/counte")
      const entreprisesCount = entreprisesData.total_entreprises || 0

      const documentsData = await processResponse(documentsRes, "documents/countE")
      const totalDocuments = documentsData.total_documents || 0

      const traitesData = await processResponse(traitesRes, "documents/traites")
      const totalTraites = Array.isArray(traitesData) ? traitesData.length : (traitesData?.documents_traites_count ?? 0)

      const enAttenteData = await processResponse(enAttenteRes, "documents/en-attente")
      const totalEnAttente = Array.isArray(enAttenteData)
        ? enAttenteData.length
        : (enAttenteData?.documents_en_attente_count ?? 0)

      const recentDocsData = await processResponse(recentDocsRes, "documents/all-recent")
      const entreprisesListData = await processResponse(entreprisesListRes, "entreprises/list")

      setStatsData({
        entreprises: entreprisesCount,
        documents: totalDocuments,
        traites: totalTraites,
        enAttente: totalEnAttente,
      })

      setRecentDocuments(Array.isArray(recentDocsData) ? recentDocsData : [])
      setEntreprisesListe(Array.isArray(entreprisesListData) ? entreprisesListData : [])
    } catch (err: any) {
      console.error("Erreur lors de la récupération des données du tableau de bord :", err)
      setError(err.message || "Une erreur est survenue lors du chargement des données.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      fetchStats()
    }
  }, [fetchStats])

  const stats = [
    {
      title: "Entreprises",
      value: loading && !error ? "..." : statsData.entreprises.toString(),
      description: "Entreprises gérées",
      icon: Building,
      color: "from-emerald-400 to-teal-500",
      bgColor: "bg-emerald-50/50",
      change: "+5%",
      trend: "up",
    },
    {
      title: "Documents",
      value: loading && !error ? "..." : statsData.documents.toString(),
      description: "Documents totaux",
      icon: FileText,
      color: "from-blue-400 to-indigo-500",
      bgColor: "bg-blue-50/50",
      change: "+12%",
      trend: "up",
    },
    {
      title: "Traités",
      value: loading && !error ? "..." : statsData.traites.toString(),
      description: "Documents traités",
      icon: CheckCircle,
      color: "from-green-400 to-emerald-500",
      bgColor: "bg-green-50/50",
      change: "+8%",
      trend: "up",
    },
    {
      title: "En attente",
      value: loading && !error ? "..." : statsData.enAttente.toString(),
      description: "Documents à traiter",
      icon: AlertCircle,
      color: "from-amber-400 to-orange-500",
      bgColor: "bg-amber-50/50",
      change: "-3%",
      trend: "down",
    },
  ]

  const handleRetry = () => {
    setError(null)
    fetchStats()
  }

  if (loading && !error) {
    return (
      <RequireAuth>
        <DashboardLayout role="accountant">
          <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
            <div className="flex justify-center items-center h-[calc(100vh-150px)]">
              <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-blue-200/20 p-8">
                <CardContent className="flex items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  <p className="text-gray-600 font-medium">Chargement du tableau de bord...</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </DashboardLayout>
      </RequireAuth>
    )
  }

  if (error) {
    return (
      <RequireAuth>
        <DashboardLayout role="accountant">
          <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] p-6">
              <Card className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-red-200/20 max-w-md">
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-16 w-16 mb-4 text-red-400 mx-auto" />
                  <h3 className="text-xl font-semibold mb-2 text-red-600">Erreur de chargement</h3>
                  <p className="mb-6 text-red-500 text-sm">{error}</p>
                  <Button
                    onClick={handleRetry}
                    disabled={loading}
                    className="bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white"
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
      <DashboardLayout role="accountant">
        <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
          {/* Background decorative elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-emerald-200/30 to-teal-300/30 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-200/30 to-indigo-300/30 rounded-full blur-3xl"></div>
          </div>

          <div className="relative space-y-8 p-6">
            {/* Header Section */}
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent tracking-wide">
                  Tableau de Bord Comptable
                </h1>
                <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-emerald-600 to-transparent mx-auto"></div>
                <p className="text-gray-600 text-base">Vue d'ensemble de vos activités Cleverbills</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat, index) => (
                <Card
                  key={index}
                  className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-300"
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
              {/* Recent Documents */}
              <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl shadow-emerald-500/10">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2 bg-gradient-to-r from-blue-400 to-indigo-500">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold text-gray-900">Documents récents</CardTitle>
                      <CardDescription className="text-gray-600">
                        Les derniers documents déposés par vos clients
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentDocuments.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                      {recentDocuments.map((doc, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-50/50 to-blue-50/50 border border-gray-100/50 hover:shadow-md transition-all duration-200"
                        >
                          <div className="rounded-full p-2 bg-blue-100">
                            <FileText className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <p className="text-sm font-medium text-gray-900 truncate" title={doc.nom_fichier}>
                              {doc.nom_fichier}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200"
                              >
                                {doc.type}
                              </Badge>
                              <Badge
                                className={`text-xs ${
                                  doc.statut.toLowerCase().includes("attente") ||
                                  doc.statut.toLowerCase().includes("cours")
                                    ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                                    : doc.statut.toLowerCase().includes("traité")
                                      ? "bg-green-100 text-green-700 hover:bg-green-100"
                                      : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                {doc.statut}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {new Date(doc.uploaded_at).toLocaleString("fr-FR", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Aucun document récent.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Managed Companies */}
              <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl shadow-emerald-500/10">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2 bg-gradient-to-r from-emerald-400 to-teal-500">
                      <Building className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold text-gray-900">Entreprises gérées</CardTitle>
                      <CardDescription className="text-gray-600">Liste de vos entreprises clientes</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {entreprisesListe.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                      {entreprisesListe.map((company, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-50/50 to-emerald-50/50 border border-gray-100/50 hover:shadow-md transition-all duration-200"
                        >
                          <div className="rounded-full p-2 bg-emerald-100">
                            <Building className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium text-gray-900 truncate" title={company.nom}>
                              {company.nom}
                            </p>
                            <Link
                              href={`/accountant/documents?company=${encodeURIComponent(company.nom)}`}
                              className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 hover:underline font-medium"
                            >
                              <FileText className="w-3 h-3" />
                              {company.document_count || 0} document{company.document_count !== 1 ? "s" : ""}
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Building className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Aucune entreprise gérée pour le moment.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

        
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  )
}
