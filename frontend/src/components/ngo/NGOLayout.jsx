import {
  Bell,
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  Map,
  PackageSearch,
  UserRound,
  Truck,
} from 'lucide-react'
import WorkspaceShell from '../layout/WorkspaceShell.jsx'

const navigation = [
  { label: 'Overview', to: '/ngo/dashboard', icon: LayoutDashboard },
  { label: 'Discover food', to: '/ngo/food', icon: PackageSearch },
  { label: 'Nearby food map', to: '/ngo/map', icon: Map },
  { label: 'My reservations', to: '/ngo/reservations', icon: ClipboardList },
  { label: 'Pickup & delivery', to: '/ngo/tracking', icon: Truck },
  { label: 'Notifications', to: '/ngo/notifications', icon: Bell },
  { label: 'Impact analytics', to: '/ngo/analytics', icon: ChartNoAxesCombined },
  { label: 'Profile', to: '/ngo/profile', icon: UserRound },
]

function NGOLayout() {
  return (
    <WorkspaceShell items={navigation} roleLabel="Community organization" workspaceTitle="Food marketplace" />
  )
}

export default NGOLayout
