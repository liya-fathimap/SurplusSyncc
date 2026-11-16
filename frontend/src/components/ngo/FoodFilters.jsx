import Button from '../common/Button.jsx'

function FoodFilters({ isLoading, onApply, onChange, values }) {
  function update(event) {
    onChange((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  return (
    <form className="ngo-food-filters" onSubmit={(event) => {
      event.preventDefault()
      onApply()
    }}>
      <label className="provider-field">
        <span>Food category</span>
        <input name="category" onChange={update} placeholder="Any category" value={values.category} />
      </label>
      <label className="provider-field">
        <span>Minimum available quantity</span>
        <input min="0.01" name="minQuantity" onChange={update} placeholder="Any" step="any" type="number" value={values.minQuantity} />
      </label>
      <label className="provider-field">
        <span>Maximum available quantity</span>
        <input min="0.01" name="maxQuantity" onChange={update} placeholder="Any" step="any" type="number" value={values.maxQuantity} />
      </label>
      <label className="provider-field">
        <span>Collect on or after</span>
        <input name="deadlineAfter" onChange={update} type="date" value={values.deadlineAfter} />
      </label>
      <label className="provider-field">
        <span>Collect before</span>
        <input name="deadlineBefore" onChange={update} type="date" value={values.deadlineBefore} />
      </label>
      <Button disabled={isLoading} type="submit">{isLoading ? 'Applying…' : 'Apply filters'}</Button>
    </form>
  )
}

export default FoodFilters
