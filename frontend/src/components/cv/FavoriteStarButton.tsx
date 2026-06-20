import './FavoriteStarButton.css'

interface FavoriteStarButtonProps {
  isFavorite: boolean
  disabled?: boolean
  onToggle: () => void
  title?: string
  className?: string
}

const FavoriteStarButton = ({
  isFavorite,
  disabled = false,
  onToggle,
  title,
  className = '',
}: FavoriteStarButtonProps) => (
  <button
    type="button"
    className={`cv-favorite-star${isFavorite ? ' cv-favorite-star--active' : ''}${className ? ` ${className}` : ''}`}
    onClick={(e) => {
      e.stopPropagation()
      onToggle()
    }}
    disabled={disabled}
    title={title ?? (isFavorite ? 'Remove from favorites' : 'Add to favorites')}
    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    aria-pressed={isFavorite}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        fill={isFavorite ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  </button>
)

export default FavoriteStarButton
