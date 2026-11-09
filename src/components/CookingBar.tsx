import { Link } from 'react-router-dom'
import { getRecipeById } from '../lib/catalog'
import { unpinRecipe, useCookingOrder } from '../lib/cookingSession'

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className="size-3.5"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/**
 * Now-cooking titles, in a single sideways-scrolling row.
 * Hidden when the set is empty, and when it is exactly the recipe on screen.
 */
export function CookingSwitcher({ currentId }: { currentId?: string }) {
  const order = useCookingOrder()
  const show =
    order.length > 0 && !(order.length === 1 && order[0] === currentId)
  if (!show) return null

  return (
    <nav
      aria-label="Now cooking"
      className="no-print min-w-0 basis-full overflow-x-auto sm:basis-0 sm:flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max min-w-full items-center justify-end gap-1.5">
        {order.map((id) => {
          const recipe = getRecipeById(id)
          if (!recipe) return null
          const current = id === currentId
          const chip = current
            ? 'border-accent bg-accent/10 text-accent dark:border-orange-400 dark:bg-orange-400/15 dark:text-orange-300'
            : 'border-stone-300 bg-white text-ink hover:border-accent/50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-500'
          return (
            <li
              key={id}
              className={`flex shrink-0 items-stretch overflow-hidden rounded-md border ${chip}`}
            >
              {current ? (
                <span
                  aria-current="page"
                  className="flex min-h-11 max-w-[7.5rem] items-center px-2.5 text-sm font-medium sm:min-h-9 sm:max-w-[9rem]"
                >
                  <span className="truncate">{recipe.title}</span>
                </span>
              ) : (
                <Link
                  to={`/recipe/${id}`}
                  className="flex min-h-11 max-w-[7.5rem] items-center px-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:min-h-9 sm:max-w-[9rem]"
                >
                  <span className="truncate">{recipe.title}</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => unpinRecipe(id)}
                aria-label={`Remove ${recipe.title} from cooking`}
                className="inline-flex w-9 items-center justify-center border-l border-inherit text-current hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:w-8 dark:hover:bg-white/10"
              >
                <CloseIcon />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
