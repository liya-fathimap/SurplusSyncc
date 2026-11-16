import {
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  PackagePlus,
  PackageSearch,
  UserRound,
  Truck,
} from 'lucide-react'
import WorkspaceShell from '../layout/WorkspaceShell.jsx'

const navigation = [
  { label: 'Overview', to: '/provider/dashboard', icon: LayoutDashboard },
  { label: 'Create listing', to: '/provider/listings/new', icon: PackagePlus },
  { label: 'My listings', to: '/provider/listings', icon: PackageSearch },
  { label: 'Reservations', to: '/provider/reservations', icon: ClipboardList },
  { label: 'Pickup management', to: '/provider/pickups', icon: Truck },
  { label: 'Analytics', to: '/provider/analytics', icon: ChartNoAxesCombined },
  { label: 'Profile', to: '/provider/profile', icon: UserRound },
]

function ProviderLayout() {
  return (
    <WorkspaceShell items={navigation} roleLabel="Food provider" workspaceTitle="Provider studio" />
  )
}

export default ProviderLayout
