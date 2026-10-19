import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import { categories, getRecipeById, tags } from '../lib/catalog'
import {
  CATEGORY_KEYS,
  RECIPE_UNITS,
  type CategoryKey,
  type Recipe,
} from '../lib/schema'
import {
  blankIngredient,
  blankStep,
  deleteRecipe,
  draftFromRecipe,
  emptyDraft,
  saveRecipe,
  validateDraft,
  type IngredientDraft,
  type RecipeDraft,
  type StepDraft,
} from './editorApi'

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  method: 'Method',
  diet: 'Diet',
  meal: 'Meal',
  season: 'Season',
  cuisine: 'Cuisine',
  main_ingredient: 'Main ingredient',
}

const inputClass =
  'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100'
const quietButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-stone-300 bg-white px-3 text-sm text-ink hover:border-stone-400 disabled:opacity-40 sm:min-h-9 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-500'

export function EditorPage() {
  const { id } = useParams()
  const recipe = id ? getRecipeById(id) : undefined

  if (id && !recipe) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to="/" className="text-sm text-accent underline-offset-2 hover:underline dark:text-orange-300">
          All recipes
        </Link>
        <h1 className="font-display mt-4 text-3xl tracking-tight text-ink dark:text-stone-50">
          Recipe not found
        </h1>
        <p className="mt-2 text-ink-muted dark:text-stone-400">
          No recipe matches <span className="font-mono text-sm">{id}</span>.
        </p>
      </main>
    )
  }

  return <EditorForm key={recipe?.id ?? 'new'} recipe={recipe ?? null} />
}

function EditorForm({ recipe }: { recipe: Recipe | null }) {
  const [draft, setDraft] = useState<RecipeDraft>(() =>
    recipe ? draftFromRecipe(recipe) : emptyDraft(),
  )
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const skipUnload = useRef(false)
  const formId = useId()
  const [baseline] = useState(() =>
    JSON.stringify(recipe ? draftFromRecipe(recipe) : emptyDraft()),
  )
  const dirty = JSON.stringify(draft) !== baseline

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (skipUnload.current || !dirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const leave = (path: string) => {
    skipUnload.current = true
    const base = import.meta.env.BASE_URL
    window.location.assign(`${base}${path.replace(/^\//, '')}`)
  }

  const update = (patch: Partial<RecipeDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const guardLeave = (event: { preventDefault: () => void }) => {
    if (!dirty) return
    if (!window.confirm('Leave without saving changes?')) event.preventDefault()
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const result = validateDraft(draft)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setSaving(true)
    setErrors([])
    try {
      const saved = await saveRecipe(recipe?.id ?? null, result.body)
      leave(`recipe/${saved.id}`)
    } catch (error) {
      setSaving(false)
      setErrors([error instanceof Error ? error.message : 'Could not save the recipe.'])
    }
  }

  const onDelete = async () => {
    if (!recipe) return
    setDeleting(true)
    setErrors([])
    try {
      await deleteRecipe(recipe.id)
      leave('')
    } catch (error) {
      setDeleting(false)
      setErrors([error instanceof Error ? error.message : 'Could not delete the recipe.'])
      setConfirmDelete(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={recipe ? `/recipe/${recipe.id}` : '/'}
          onClick={guardLeave}
          className="text-sm text-accent underline-offset-2 hover:underline dark:text-orange-300"
        >
          {recipe ? 'Back to recipe' : 'All recipes'}
        </Link>
        <ThemeToggle />
      </div>

      <header className="mt-4">
        <h1 className="font-display text-4xl tracking-tight text-ink dark:text-stone-50">
          {recipe ? 'Edit recipe' : 'New recipe'}
        </h1>
        <p className="mt-2 text-sm text-ink-muted dark:text-stone-400">
          {recipe
            ? `Id “${recipe.id}” stays put, even if you change the title.`
            : 'Saving creates an id from the title. That id does not change later.'}
        </p>
      </header>

      <form id={formId} autoComplete="off" className="mt-8 space-y-8" onSubmit={onSubmit}>
        <Field label="Title" htmlFor={`${formId}-title`}>
          <input
            id={`${formId}-title`}
            value={draft.title}
            onChange={(event) => update({ title: event.target.value })}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Servings" htmlFor={`${formId}-servings`}>
            <input
              id={`${formId}-servings`}
              inputMode="numeric"
              value={draft.servings}
              onChange={(event) => update({ servings: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Prep minutes" htmlFor={`${formId}-prep`}>
            <input
              id={`${formId}-prep`}
              inputMode="numeric"
              value={draft.prep_time_minutes}
              onChange={(event) => update({ prep_time_minutes: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Cook minutes" htmlFor={`${formId}-cook`}>
            <input
              id={`${formId}-cook`}
              inputMode="numeric"
              value={draft.cook_time_minutes}
              onChange={(event) => update({ cook_time_minutes: event.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <div>
          <p className="text-sm font-medium text-ink dark:text-stone-200">Rating</p>
          <RatingField
            value={draft.rating}
            onChange={(rating) => update({ rating })}
          />
        </div>

        <section className="space-y-5">
          <div>
            <h2 className="font-display text-2xl text-ink dark:text-stone-50">Categories and tags</h2>
            <p className="mt-1 text-sm text-ink-muted dark:text-stone-400">
              New names are added to the shared lists when you save. Set diet from the
              ingredients.
            </p>
          </div>
          {CATEGORY_KEYS.map((key) => (
            <NamePicker
              key={key}
              label={CATEGORY_LABELS[key]}
              addLabel={`Add ${CATEGORY_LABELS[key].toLowerCase()}`}
              options={categories[key].map((entry) => entry.name)}
              selected={draft.categories[key]}
              onChange={(names) =>
                setDraft((current) => ({
                  ...current,
                  categories: { ...current.categories, [key]: names },
                }))
              }
            />
          ))}
          <NamePicker
            label="Tags"
            addLabel="Add tag"
            options={tags.tags.map((entry) => entry.name)}
            selected={draft.tags}
            onChange={(names) => setDraft((current) => ({ ...current, tags: names }))}
          />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-ink dark:text-stone-50">Ingredients</h2>
          <EditableList
            items={draft.ingredients}
            emptyLabel="Add ingredient"
            insertLabel={(index) =>
              index === 0
                ? 'Insert ingredient at start'
                : index === draft.ingredients.length
                  ? 'Add ingredient at end'
                  : `Insert ingredient after item ${index}`
            }
            onInsert={(index) =>
              setDraft((current) => ({
                ...current,
                ingredients: insertItem(
                  current.ingredients,
                  index,
                  blankIngredient(newRowKey()),
                ),
              }))
            }
            renderItem={(ingredient, index) => (
              <IngredientRow
                ingredient={ingredient}
                index={index}
                count={draft.ingredients.length}
                onPatch={(patch) =>
                  setDraft((current) => ({
                    ...current,
                    ingredients: current.ingredients.map((row) =>
                      row.key === ingredient.key ? { ...row, ...patch } : row,
                    ),
                  }))
                }
                onMove={(direction) =>
                  setDraft((current) => ({
                    ...current,
                    ingredients: moveItem(current.ingredients, index, direction),
                  }))
                }
                onRemove={() =>
                  setDraft((current) => ({
                    ...current,
                    ingredients: current.ingredients.filter((row) => row.key !== ingredient.key),
                  }))
                }
              />
            )}
          />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-ink dark:text-stone-50">Instructions</h2>
          <EditableList
            items={draft.steps}
            emptyLabel="Add step"
            insertLabel={(index) =>
              index === 0
                ? 'Insert step at start'
                : index === draft.steps.length
                  ? 'Add step at end'
                  : `Insert step after step ${index}`
            }
            onInsert={(index) =>
              setDraft((current) => ({
                ...current,
                steps: insertItem(current.steps, index, blankStep(newRowKey())),
              }))
            }
            renderItem={(step, index) => (
              <StepRow
                step={step}
                index={index}
                count={draft.steps.length}
                onPatch={(patch) =>
                  setDraft((current) => ({
                    ...current,
                    steps: current.steps.map((row) =>
                      row.key === step.key ? { ...row, ...patch } : row,
                    ),
                  }))
                }
                onMove={(direction) =>
                  setDraft((current) => ({
                    ...current,
                    steps: moveItem(current.steps, index, direction),
                  }))
                }
                onRemove={() =>
                  setDraft((current) => ({
                    ...current,
                    steps: current.steps.filter((row) => row.key !== step.key),
                  }))
                }
              />
            )}
          />
        </section>

        <Field label="Notes" htmlFor={`${formId}-notes`}>
          <textarea
            id={`${formId}-notes`}
            rows={5}
            value={draft.notes}
            onChange={(event) => update({ notes: event.target.value })}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source name" htmlFor={`${formId}-source`}>
            <input
              id={`${formId}-source`}
              value={draft.attributionName}
              onChange={(event) => update({ attributionName: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Source URL" htmlFor={`${formId}-url`}>
              <input
              id={`${formId}-url`}
              value={draft.attributionUrl}
              onChange={(event) => update({ attributionUrl: event.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:border-stone-700 dark:bg-surface-dark/95">
          {errors.length > 0 && (
            <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-red-800 dark:text-red-300" role="alert">
              {errors.map((error, index) => (
                <li key={`${index}-${error}`}>{error}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted dark:text-stone-400">
              Writes the JSON file on this computer. Commit and push to publish.
            </p>
            <div className="flex gap-2">
              <Link
                to={recipe ? `/recipe/${recipe.id}` : '/'}
                onClick={guardLeave}
                className={quietButtonClass}
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60 sm:min-h-9"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {recipe && (
        <div className="mt-10 border-t border-stone-200 pt-6 dark:border-stone-700">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-800 underline-offset-2 hover:underline dark:text-red-300"
          >
            Delete recipe
          </button>
        </div>
      )}

      {confirmDelete && recipe && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-stone-950/40 px-4 py-6 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) setConfirmDelete(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${formId}-delete-title`}
            className="w-full max-w-md rounded-lg border border-stone-300 bg-white p-5 shadow-lg dark:border-stone-600 dark:bg-stone-900"
          >
            <h2 id={`${formId}-delete-title`} className="font-display text-2xl text-ink dark:text-stone-50">
              Delete this recipe?
            </h2>
            <p className="mt-2 text-sm text-ink-muted dark:text-stone-400">
              This removes <span className="font-mono text-xs">{recipe.id}.json</span> from this
              computer. It is not published until you commit.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={quietButtonClass}
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void onDelete()}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-800 px-4 text-sm font-medium text-white hover:bg-red-900 disabled:opacity-60 sm:min-h-9"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink dark:text-stone-200">{label}</span>
      {children}
    </label>
  )
}

function RatingField({
  value,
  onChange,
}: {
  value: number | null
  onChange: (rating: number | null) => void
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value != null && star <= value
        return (
          <button
            key={star}
            type="button"
            aria-pressed={value === star}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            onClick={() => onChange(value === star ? null : star)}
            className={`inline-flex size-11 items-center justify-center rounded-md text-lg ${
              filled
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-stone-400 dark:text-stone-500'
            }`}
          >
            {filled ? '★' : '☆'}
          </button>
        )
      })}
      {value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 text-sm text-ink-muted underline-offset-2 hover:underline dark:text-stone-400"
        >
          Clear
        </button>
      )}
    </div>
  )
}

function NamePicker({
  label,
  addLabel,
  options,
  selected,
  onChange,
}: {
  label: string
  addLabel: string
  options: string[]
  selected: string[]
  onChange: (names: string[]) => void
}) {
  const [adding, setAdding] = useState('')
  const inputId = useId()
  const names = [...options]
  for (const name of selected) {
    if (!names.some((option) => option.toLowerCase() === name.toLowerCase())) names.push(name)
  }

  const toggle = (name: string) => {
    const exists = selected.some((item) => item.toLowerCase() === name.toLowerCase())
    onChange(
      exists
        ? selected.filter((item) => item.toLowerCase() !== name.toLowerCase())
        : [...selected, name],
    )
  }

  const add = () => {
    const name = adding.trim().replace(/\s+/g, ' ')
    if (!name) return
    if (!selected.some((item) => item.toLowerCase() === name.toLowerCase())) {
      const known = options.find((option) => option.toLowerCase() === name.toLowerCase())
      onChange([...selected, known ?? name])
    }
    setAdding('')
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink dark:text-stone-200">{label}</legend>
      {names.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {names.map((name) => {
            const on = selected.some((item) => item.toLowerCase() === name.toLowerCase())
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(name)}
                className={`rounded-full border px-2.5 py-1 text-sm ${
                  on
                    ? 'border-accent bg-accent text-white dark:border-orange-700 dark:bg-orange-800'
                    : 'border-stone-300 bg-white text-ink hover:border-stone-400 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100'
                }`}
              >
                {name}
              </button>
            )
          })}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          value={adding}
          aria-label={addLabel}
          placeholder={addLabel}
          onChange={(event) => setAdding(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
          className={inputClass}
        />
        <button type="button" onClick={add} className={quietButtonClass}>
          Add
        </button>
      </div>
    </fieldset>
  )
}

function EditableList<T extends { key: string }>({
  items,
  emptyLabel,
  insertLabel,
  onInsert,
  renderItem,
}: {
  items: T[]
  emptyLabel: string
  insertLabel: (index: number) => string
  onInsert: (index: number) => void
  renderItem: (item: T, index: number) => ReactNode
}) {
  if (items.length === 0) {
    return (
      <InsertSlot
        label={emptyLabel}
        emphasized
        onInsert={() => onInsert(0)}
      />
    )
  }

  return (
    <div>
      <InsertSlot label={insertLabel(0)} onInsert={() => onInsert(0)} />
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {renderItem(item, index)}
          <InsertSlot
            label={insertLabel(index + 1)}
            onInsert={() => onInsert(index + 1)}
          />
        </Fragment>
      ))}
    </div>
  )
}

function InsertSlot({
  label,
  onInsert,
  emphasized = false,
}: {
  label: string
  onInsert: () => void
  emphasized?: boolean
}) {
  if (emphasized) {
    return (
      <button
        type="button"
        onClick={onInsert}
        className={`${quietButtonClass} w-full gap-2 border-dashed`}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-5 items-center justify-center rounded-full border border-current text-sm leading-none"
        >
          +
        </span>
        {label}
      </button>
    )
  }

  return (
    <div className="group/insert relative -my-1 flex h-7 items-center justify-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-1/2 h-px -translate-y-1/2 bg-stone-300 opacity-0 transition-opacity group-hover/insert:opacity-100 group-focus-within/insert:opacity-100 dark:bg-stone-600 [@media(hover:none)]:opacity-40"
      />
      <button
        type="button"
        aria-label={label}
        onClick={onInsert}
        className="relative z-10 inline-flex size-6 items-center justify-center rounded-full border border-stone-300 bg-white text-sm leading-none text-ink-muted opacity-0 transition-opacity hover:border-accent hover:text-accent focus-visible:opacity-100 group-hover/insert:opacity-100 group-focus-within/insert:opacity-100 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-orange-400 dark:hover:text-orange-300 [@media(hover:none)]:opacity-70"
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  )
}

function IngredientRow({
  ingredient,
  index,
  count,
  onPatch,
  onMove,
  onRemove,
}: {
  ingredient: IngredientDraft
  index: number
  count: number
  onPatch: (patch: Partial<IngredientDraft>) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}) {
  const set = (patch: Partial<IngredientDraft>) => onPatch(patch)
  return (
    <div className="rounded-md border border-stone-200 p-3 dark:border-stone-700">
      <div className="grid gap-2 sm:grid-cols-[6.5rem_7.5rem_minmax(0,1fr)]">
        <input
          aria-label={`Ingredient ${index + 1} amount`}
          inputMode="decimal"
          placeholder="Amount"
          value={ingredient.amount}
          onChange={(event) => set({ amount: event.target.value })}
          className={inputClass}
        />
        <select
          aria-label={`Ingredient ${index + 1} unit`}
          value={ingredient.unit}
          onChange={(event) => set({ unit: event.target.value })}
          className={inputClass}
        >
          <option value="">count</option>
          {RECIPE_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
        <input
          aria-label={`Ingredient ${index + 1} name`}
          placeholder="Name"
          value={ingredient.name}
          onChange={(event) => set({ name: event.target.value })}
          className={inputClass}
        />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          aria-label={`Ingredient ${index + 1} notes`}
          placeholder="Notes"
          value={ingredient.notes}
          onChange={(event) => set({ notes: event.target.value })}
          className={inputClass}
        />
        <input
          aria-label={`Ingredient ${index + 1} group`}
          placeholder="Group"
          value={ingredient.group}
          onChange={(event) => set({ group: event.target.value })}
          className={inputClass}
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          aria-label={`Move ingredient ${index + 1} up`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className={quietButtonClass}
        >
          Up
        </button>
        <button
          type="button"
          aria-label={`Move ingredient ${index + 1} down`}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          className={quietButtonClass}
        >
          Down
        </button>
        <button type="button" onClick={onRemove} className={quietButtonClass}>
          Remove
        </button>
      </div>
    </div>
  )
}

function StepRow({
  step,
  index,
  count,
  onPatch,
  onMove,
  onRemove,
}: {
  step: StepDraft
  index: number
  count: number
  onPatch: (patch: Partial<StepDraft>) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-md border border-stone-200 p-3 dark:border-stone-700">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-muted dark:text-stone-400">
          Step {index + 1}
        </span>
        <textarea
          rows={3}
          value={step.text}
          onChange={(event) => onPatch({ text: event.target.value })}
          className={inputClass}
        />
      </label>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          aria-label={`Move step ${index + 1} up`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className={quietButtonClass}
        >
          Up
        </button>
        <button
          type="button"
          aria-label={`Move step ${index + 1} down`}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          className={quietButtonClass}
        >
          Down
        </button>
        <button type="button" onClick={onRemove} className={quietButtonClass}>
          Remove
        </button>
      </div>
    </div>
  )
}

function insertItem<T>(items: T[], index: number, item: T): T[] {
  const copy = items.slice()
  copy.splice(index, 0, item)
  return copy
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = index + direction
  if (next < 0 || next >= items.length) return items
  const copy = items.slice()
  const [moved] = copy.splice(index, 1)
  if (!moved) return items
  copy.splice(next, 0, moved)
  return copy
}

function newRowKey(): string {
  return crypto.randomUUID()
}
