import bakeryPhoto from '../../assets/food/bakery.jpg'
import mealsPhoto from '../../assets/food/prepared-meals.jpg'
import producePhoto from '../../assets/food/market-produce.jpg'

function fallbackFor(category = '') {
  const normalized = category.toLowerCase()
  if (/bread|bakery|pastr|bake/.test(normalized)) return bakeryPhoto
  if (/meal|prepared|cater|dish|ready/.test(normalized)) return mealsPhoto
  return producePhoto
}

function FoodPhoto({ alt, category, className = '', image }) {
  const fallback = fallbackFor(category)

  return (
    <img
      alt={alt || `${category || 'Fresh food'} surplus`}
      className={className}
      key={image || fallback}
      loading="lazy"
      onError={(event) => {
        if (image && !event.currentTarget.dataset.fallbackApplied) {
          event.currentTarget.dataset.fallbackApplied = 'true'
          event.currentTarget.src = fallback
        }
      }}
      src={image || fallback}
    />
  )
}

export default FoodPhoto
