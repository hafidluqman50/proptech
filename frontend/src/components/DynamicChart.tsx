'use client'
import {ArcElement,
  BarController, 
  BarElement, 
  CategoryScale, 
  Chart,DoughnutController,Legend,LinearScale,LineController, LineElement, PieController, PointElement, 
  Title, Tooltip, 
} from 'chart.js'
import { useEffect, useRef } from 'react'

Chart.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend,
  BarController, LineController, PieController, DoughnutController
)

const ALLOWED_TYPES = ['bar', 'line', 'pie', 'doughnut']

export default function DynamicChart({ config }: { config: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !config) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    // Guard chart type
    if (!ALLOWED_TYPES.includes(config.type)) config.type = 'bar'

    chartRef.current = new Chart(canvasRef.current, config)
    return () => { chartRef.current?.destroy() }
  }, [config])

  return <canvas ref={canvasRef} />
}