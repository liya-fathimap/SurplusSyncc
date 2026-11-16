import {
  Activity,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  PackageSearch,
  Truck,
  UserCheck,
  Users,
} from 'lucide-react'
import WorkspaceShell from '../layout/WorkspaceShell.jsx'
import './admin.css'

const navigation = [
  { label: 'Overview', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'User management', to: '/admin/users', icon: Users },
  { label: 'Provider verification', to: '/admin/providers', icon: UserCheck },
  { label: 'NGO verification', to: '/admin/ngos', icon: UserCheck },
  { label: 'Food listings', to: '/admin/listings', icon: PackageSearch },
  { label: 'Reservations', to: '/admin/reservations', icon: ClipboardList },
  { label: 'Deliveries', to: '/admin/deliveries', icon: Truck },
  { label: 'Activity logs', to: '/admin/activity', icon: Activity },
  { label: 'Platform analytics', to: '/admin/analytics', icon: BarChart3 },
]

function AdminLayout() {
  return (
    <WorkspaceShell items={navigation} roleLabel="Platform administrator" workspaceTitle="Operations control room" />
  )
}

export default AdminLayout
