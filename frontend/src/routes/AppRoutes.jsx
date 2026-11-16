import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AuthPage from '../pages/auth/AuthPage.jsx'
import LandingPage from '../pages/LandingPage.jsx'
import Loading from '../components/common/Loading.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import ProviderLayout from '../components/provider/ProviderLayout.jsx'
import ProviderOverviewPage from '../pages/provider/ProviderOverviewPage.jsx'
import CreateListingPage from '../pages/provider/CreateListingPage.jsx'
import MyListingsPage from '../pages/provider/MyListingsPage.jsx'
import ListingDetailsPage from '../pages/provider/ListingDetailsPage.jsx'
import ReservationsPage from '../pages/provider/ReservationsPage.jsx'
import PickupManagementPage from '../pages/provider/PickupManagementPage.jsx'
import ProviderAnalyticsPage from '../pages/provider/ProviderAnalyticsPage.jsx'
import ProviderProfilePage from '../pages/provider/ProviderProfilePage.jsx'
import NGOLayout from '../components/ngo/NGOLayout.jsx'
import NGOOverviewPage from '../pages/ngo/NGOOverviewPage.jsx'
import DiscoverFoodPage from '../pages/ngo/DiscoverFoodPage.jsx'
import FoodListingDetailsPage from '../pages/ngo/FoodListingDetailsPage.jsx'
import NearbyFoodMapPage from '../pages/ngo/NearbyFoodMapPage.jsx'
import NGOReservationsPage from '../pages/ngo/ReservationsPage.jsx'
import ReservationDetailsPage from '../pages/ngo/ReservationDetailsPage.jsx'
import TrackingPage from '../pages/ngo/TrackingPage.jsx'
import NotificationsPage from '../pages/ngo/NotificationsPage.jsx'
import NGOAnalyticsPage from '../pages/ngo/NGOAnalyticsPage.jsx'
import NGOProfilePage from '../pages/ngo/NGOProfilePage.jsx'
import VolunteerLayout from '../components/volunteer/VolunteerLayout.jsx'
import VolunteerOverviewPage from '../pages/volunteer/VolunteerOverviewPage.jsx'
import AvailableTasksPage from '../pages/volunteer/AvailableTasksPage.jsx'
import TaskDetailsPage from '../pages/volunteer/TaskDetailsPage.jsx'
import AssignedDeliveriesPage from '../pages/volunteer/AssignedDeliveriesPage.jsx'
import DeliveryVerificationPage from '../pages/volunteer/DeliveryVerificationPage.jsx'
import DeliveryHistoryPage from '../pages/volunteer/DeliveryHistoryPage.jsx'
import VolunteerNotificationsPage from '../pages/volunteer/VolunteerNotificationsPage.jsx'
import VolunteerProfilePage from '../pages/volunteer/VolunteerProfilePage.jsx'
import AdminLayout from '../components/admin/AdminLayout.jsx'
import AdminOverviewPage from '../pages/admin/AdminOverviewPage.jsx'
import AdminUsersPage from '../pages/admin/AdminUsersPage.jsx'
import VerificationQueuePage from '../pages/admin/VerificationQueuePage.jsx'
import AdminMonitorPage from '../pages/admin/AdminMonitorPage.jsx'
import AdminAnalyticsPage from '../pages/admin/AdminAnalyticsPage.jsx'

function AppRoutes() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <main className="route-loading">
        <Loading label="Loading SurplusSync…" />
      </main>
    )
  }

  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<AuthPage mode="login" />} path="/login" />
      <Route element={<AuthPage mode="register" />} path="/register" />
      <Route element={<ProtectedRoute allowedRoles={['provider']} />}>
        <Route element={<ProviderLayout />} path="/provider">
          <Route element={<Navigate replace to="/provider/dashboard" />} index />
          <Route element={<ProviderOverviewPage />} path="dashboard" />
          <Route element={<CreateListingPage />} path="listings/new" />
          <Route element={<MyListingsPage />} path="listings" />
          <Route element={<ListingDetailsPage />} path="listings/:listingId" />
          <Route element={<NGOReservationsPage />} path="reservations" />
          <Route element={<PickupManagementPage />} path="pickups" />
          <Route element={<ProviderAnalyticsPage />} path="analytics" />
          <Route element={<ProviderProfilePage />} path="profile" />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['ngo']} />}>
        <Route element={<NGOLayout />} path="/ngo">
          <Route element={<Navigate replace to="/ngo/dashboard" />} index />
          <Route element={<NGOOverviewPage />} path="dashboard" />
          <Route element={<DiscoverFoodPage />} path="food" />
          <Route element={<FoodListingDetailsPage />} path="food/:listingId" />
          <Route element={<NearbyFoodMapPage />} path="map" />
          <Route element={<ReservationsPage />} path="reservations" />
          <Route element={<ReservationDetailsPage />} path="reservations/:reservationId" />
          <Route element={<TrackingPage />} path="tracking" />
          <Route element={<NotificationsPage />} path="notifications" />
          <Route element={<NGOAnalyticsPage />} path="analytics" />
          <Route element={<NGOProfilePage />} path="profile" />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['volunteer']} />}>
        <Route element={<VolunteerLayout />} path="/volunteer">
          <Route element={<Navigate replace to="/volunteer/dashboard" />} index />
          <Route element={<VolunteerOverviewPage />} path="dashboard" />
          <Route element={<AvailableTasksPage />} path="tasks" />
          <Route element={<TaskDetailsPage />} path="tasks/:taskId" />
          <Route element={<AssignedDeliveriesPage />} path="deliveries" />
          <Route element={<DeliveryVerificationPage />} path="verification" />
          <Route element={<DeliveryHistoryPage />} path="history" />
          <Route element={<VolunteerNotificationsPage />} path="notifications" />
          <Route element={<VolunteerProfilePage />} path="profile" />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<AdminLayout />} path="/admin">
          <Route element={<Navigate replace to="/admin/dashboard" />} index />
          <Route element={<AdminOverviewPage />} path="dashboard" />
          <Route element={<AdminUsersPage />} path="users" />
          <Route element={<VerificationQueuePage role="provider" title="Provider verification" />} path="providers" />
          <Route element={<VerificationQueuePage role="ngo" title="NGO verification" />} path="ngos" />
          <Route element={<AdminMonitorPage kind="listings" />} path="listings" />
          <Route element={<AdminMonitorPage kind="reservations" />} path="reservations" />
          <Route element={<AdminMonitorPage kind="deliveries" />} path="deliveries" />
          <Route element={<AdminMonitorPage kind="activity-logs" />} path="activity" />
          <Route element={<AdminAnalyticsPage />} path="analytics" />
        </Route>
      </Route>
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  )
}

export default AppRoutes
