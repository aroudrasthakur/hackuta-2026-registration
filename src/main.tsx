import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { AuthBootstrap } from './components/AuthBootstrap'
import { convexClient } from './convex/client'
import RegisterPage from './pages/Register/RegisterPage'
import ProfilePage from './pages/Profile/ProfilePage'
import './styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RegisterPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)

const useMockApi = import.meta.env.VITE_USE_MOCK_API === 'true'
const content = convexClient && !useMockApi ? (
  <ConvexAuthProvider client={convexClient}>
    <AuthBootstrap>{app}</AuthBootstrap>
  </ConvexAuthProvider>
) : app

ReactDOM.createRoot(root).render(content)
