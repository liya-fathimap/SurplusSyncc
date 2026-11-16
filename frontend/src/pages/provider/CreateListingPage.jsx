import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Card from '../../components/common/Card.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import FoodListingForm from '../../components/provider/FoodListingForm.jsx'
import { createProviderListing, getProviderApiError } from '../../services/providerService.js'

function CreateListingPage() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(values) {
    setSaving(true)
    try {
      const { listing } = await createProviderListing(values)
      navigate(`/provider/listings/${listing._id}`, {
        replace: true,
        state: { notice: 'Food listing created successfully.' },
      })
    } catch (requestError) {
      const message = getProviderApiError(requestError)
      throw new Error(message, { cause: requestError })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="provider-page">
      <ProviderPageHeader
        eyebrow="Food inventory"
        title="Create a food listing"
        description="Share the details organizations need to collect your surplus safely and on time."
      />
      <Card className="provider-panel provider-form-panel">
        <FoodListingForm
          isSubmitting={saving}
          onSubmit={handleSubmit}
          submitLabel="Publish listing"
        />
      </Card>
    </div>
  )
}

export default CreateListingPage
