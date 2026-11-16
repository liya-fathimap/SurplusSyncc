import { useState } from 'react'
import { MapPin } from 'lucide-react'
import Button from '../common/Button.jsx'

function toLocalDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function createInitialValues(listing) {
  const coordinates = listing?.location?.coordinates || []
  return {
    title: listing?.title || '',
    description: listing?.description || '',
    foodCategory: listing?.foodCategory || '',
    quantity: listing?.quantity ?? '',
    unit: listing?.unit || '',
    preparedAt: toLocalDateTime(listing?.preparedAt),
    collectionDeadline: toLocalDateTime(listing?.collectionDeadline),
    storageCondition: listing?.storageCondition || '',
    allergens: Array.isArray(listing?.allergens) ? listing.allergens.join(', ') : '',
    image: listing?.image || '',
    pickupAddress: listing?.pickupAddress || '',
    longitude: coordinates[0] ?? '',
    latitude: coordinates[1] ?? '',
  }
}

function FoodListingForm({ initialListing, isSubmitting, onCancel, onSubmit, submitLabel }) {
  const [values, setValues] = useState(() => createInitialValues(initialListing))
  const [formError, setFormError] = useState('')

  function update(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
    setFormError('')
  }

  async function submit(event) {
    event.preventDefault()
    const longitude = Number(values.longitude)
    const latitude = Number(values.latitude)
    if (
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      setFormError('Enter valid pickup coordinates (longitude -180 to 180, latitude -90 to 90).')
      return
    }

    try {
      const listing = {
        title: values.title.trim(),
        description: values.description.trim(),
        foodCategory: values.foodCategory.trim(),
        quantity: Number(values.quantity),
        unit: values.unit.trim(),
        preparedAt: new Date(values.preparedAt).toISOString(),
        collectionDeadline: new Date(values.collectionDeadline).toISOString(),
        storageCondition: values.storageCondition.trim(),
        allergens: values.allergens
          .split(',')
          .map((allergen) => allergen.trim())
          .filter(Boolean),
        pickupAddress: values.pickupAddress.trim(),
        location: { type: 'Point', coordinates: [longitude, latitude] },
      }
      if (values.image.trim()) listing.image = values.image.trim()
      await onSubmit(listing)
    } catch (error) {
      setFormError(error.message)
    }
  }

  return (
    <form className="provider-form" onSubmit={submit}>
      {formError && <div className="provider-alert" role="alert">{formError}</div>}
      <div className="provider-form-grid">
        <label className="provider-field">
          <span>Listing title *</span>
          <input name="title" onChange={update} required maxLength={200} value={values.title} />
        </label>
        <label className="provider-field">
          <span>Food category *</span>
          <input name="foodCategory" onChange={update} required maxLength={100} placeholder="Produce, bakery, prepared meals…" value={values.foodCategory} />
        </label>
        <label className="provider-field">
          <span>Total quantity *</span>
          <input name="quantity" onChange={update} required min="0.01" step="any" type="number" value={values.quantity} />
        </label>
        <label className="provider-field">
          <span>Unit *</span>
          <input name="unit" onChange={update} required maxLength={50} placeholder="kg, portions, boxes…" value={values.unit} />
        </label>
        <label className="provider-field">
          <span>Preparation time *</span>
          <input name="preparedAt" onChange={update} required type="datetime-local" value={values.preparedAt} />
        </label>
        <label className="provider-field">
          <span>Collection deadline *</span>
          <input name="collectionDeadline" onChange={update} required type="datetime-local" value={values.collectionDeadline} />
        </label>
        <label className="provider-field provider-field-wide">
          <span>Description *</span>
          <textarea name="description" onChange={update} required maxLength={5000} rows="3" value={values.description} />
        </label>
        <label className="provider-field provider-field-wide">
          <span>Storage conditions *</span>
          <textarea name="storageCondition" onChange={update} required maxLength={1000} rows="2" placeholder="How should this food be stored?" value={values.storageCondition} />
        </label>
        <label className="provider-field provider-field-wide">
          <span>Allergens * <small>Separate items with commas; use “None” if there are no known allergens.</small></span>
          <input name="allergens" onChange={update} required placeholder="e.g. milk, wheat, peanuts" value={values.allergens} />
        </label>
        <label className="provider-field provider-field-wide">
          <span>Pickup address *</span>
          <input name="pickupAddress" onChange={update} required maxLength={1000} value={values.pickupAddress} />
        </label>
        <div className="provider-field provider-field-wide">
          <span className="provider-location-label"><MapPin aria-hidden="true" /> Pickup coordinates *</span>
          <p className="provider-field-help">Used to match your listing with nearby verified NGOs. Coordinates are longitude and latitude.</p>
          <div className="provider-form-grid provider-coordinates">
            <label className="provider-field">
              <span>Longitude</span>
              <input name="longitude" onChange={update} required min="-180" max="180" step="any" type="number" value={values.longitude} />
            </label>
            <label className="provider-field">
              <span>Latitude</span>
              <input name="latitude" onChange={update} required min="-90" max="90" step="any" type="number" value={values.latitude} />
            </label>
          </div>
        </div>
        <label className="provider-field provider-field-wide">
          <span>Image URL <small>Optional</small></span>
          <input name="image" onChange={update} maxLength={2048} type="url" value={values.image} />
        </label>
      </div>
      <div className="provider-form-actions">
        {onCancel && <Button onClick={onCancel} variant="secondary">Cancel</Button>}
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

export default FoodListingForm
