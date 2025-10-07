import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Award } from 'lucide-react'
import { getAnalyticsData } from '@/api'
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts'

interface Teacher {
  name: string
  totalPoints: number
  grade?: string
}

interface Student {
  name: string
  totalPoints: number
}

const Ranks = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const data = await getAnalyticsData({ period: '1W' })

      if (data.success) {
        setTeachers(data.data.teacherRankings || [])
        setStudents(data.data.studentRankings || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p>Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const teacherChartHeight = useMemo(() => Math.max(teachers.length * 40 + 40, 240), [teachers.length])
  const studentChartHeight = useMemo(() => Math.max(students.length * 40 + 40, 240), [students.length])

  return (
    <div className="space-y-4">
      {/* Teachers Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-blue-500" />
            Teachers - Forms Used
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full">
            <ResponsiveContainer width="100%" height={teacherChartHeight}>
              <ReBarChart
                data={teachers}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(value: any) => [Math.round(Number(value)), 'Points']} />
                <Bar dataKey="totalPoints" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={28}>
                  <LabelList dataKey="totalPoints" position="right" />
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Students Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="w-5 h-5 text-green-500" />
            Students - Points Received
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full">
            <ResponsiveContainer width="100%" height={studentChartHeight}>
              <ReBarChart
                data={students}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(value: any) => [Math.round(Number(value)), 'Points']} />
                <Bar dataKey="totalPoints" fill="#10b981" radius={[0, 6, 6, 0]} barSize={28}>
                  <LabelList dataKey="totalPoints" position="right" />
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Ranks
