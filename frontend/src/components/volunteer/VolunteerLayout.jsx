import {
  Bell,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  ListChecks,
  PackageSearch,
  UserRound,
} from 'lucide-react'
import WorkspaceShell from '../layout/WorkspaceShell.jsx'
import './volunteer.css'

const navigation = [
  { label: 'Overview', to: '/volunteer/dashboard', icon: LayoutDashboard },
  { label: 'Available tasks', to: '/volunteer/tasks', icon: PackageSearch },
  { label: 'Assigned deliveries', to: '/volunteer/deliveries', icon: ListChecks },
  { label: 'Pickup & delivery', to: '/volunteer/verification', icon: ClipboardCheck },
  { label: 'History', to: '/volunteer/history', icon: Clock3 },
  { label: 'Notifications', to: '/volunteer/notifications', icon: Bell },
  { label: 'Profile', to: '/volunteer/profile', icon: UserRound },
]

function VolunteerLayout() {
  return (
    <WorkspaceShell items={navigation} roleLabel="Delivery volunteer" workspaceTitle="Delivery desk" />
  )
}

export default VolunteerLayout
