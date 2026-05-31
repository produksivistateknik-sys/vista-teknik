import { useState, useEffect } from 'react'
import { adminService } from '../services/adminService'

const SESSION_KEY = 'vista_admin_session'

export function useAdmin() {
  const [admin, setAdmin] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // restore session dari localStorage
    const saved = localStorage.getItem(SESSION_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setAdmin(parsed)
      } catch {}
    }
    setLoading(false)
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const result = await adminService.login(username, password)
      setAdmin(result)
      localStorage.setItem(SESSION_KEY, JSON.stringify(result))
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Login gagal' }
    }
  }

  const logout = () => {
    setAdmin(null)
    localStorage.removeItem(SESSION_KEY)
  }

  return { admin, loading, login, logout }
}
