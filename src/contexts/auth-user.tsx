'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface Owner {
  id: string
  name: string
  color: string
  isDefault: boolean
}

interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'user'
  owners: Owner[]
}

interface AuthUserContextType {
  user: AuthUser | null
  isAdmin: boolean
  isLoading: boolean
  refreshUser: () => Promise<void>
}

const AuthUserContext = createContext<AuthUserContextType>({
  user: null,
  isAdmin: false,
  isLoading: true,
  refreshUser: async () => {},
})

export function AuthUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  return (
    <AuthUserContext.Provider
      value={{
        user,
        isAdmin: user?.role === 'admin',
        isLoading,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthUserContext.Provider>
  )
}

export function useAuthUser() {
  return useContext(AuthUserContext)
}
