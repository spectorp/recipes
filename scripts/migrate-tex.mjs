import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = path.join(root, 'archive/latex/perry_recipes.tex')
const recipesDir = path.join(root, 'data/recipes')
const timestamp = '2026-09-15T00:00:00Z'

const tex = fs.readFileSync(sourcePath, 'utf8')

function cleanText(value) {
  return value
    .replace(/\$\\frac\{(\d+)\}\{(\d+)\}\$/g, (_, a, b) => `${a}/${b}`)
    .replace(/\\frac\{(\d+)\}\{(\d+)\}/g, (_, a, b) => `${a}/${b}`)
    .replace(/[½]/g, '1/2')
    .replace(/[¼]/g, '1/4')
    .replace(/[¾]/g, '3/4')
    .replace(/[⅓]/g, '1/3')
    .replace(/[⅔]/g, '2/3')
    .replace(/[⅛]/g, '1/8')
    .replace(/\\&/g, '&')
    .replace(/\\sim/g, 'about ')
    .replace(/\$\^\{?\\?circ\}?\$/g, '°')
    .replace(/\$\{?\\?circ\}?\$/g, '°')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\\(?:textbf|bf|it|emph)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\{\\(?:bf|it)\s+([^{}]*)\}/g, '$1')
    .replace(/\\(?:href|url)\{([^{}]*)\}(?:\{([^{}]*)\})?/g, (_, url, label) => label || url)
    .replace(/\\quad/g, ' ')
    .replace(/\\\\/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/~/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim()
}

function slugify(title) {
  return cleanText(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function sectionFor(position) {
  const sections = [...tex.matchAll(/^\\section\{([^}]*)\}/gm)].filter((m) => m.index < position)
  return cleanText(sections.at(-1)?.[1] ?? '')
}

const subsectionMatches = [...tex.matchAll(/^\\subsection\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gm)]
const entries = subsectionMatches.map((match, index) => ({
  title: cleanText(match[1]),
  section: sectionFor(match.index),
  body: tex.slice(match.index + match[0].length, subsectionMatches[index + 1]?.index ?? tex.length),
}))

const skipped = []
const recipes = []

function meaningfulLines(body) {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) =>
      line &&
      !/^%/.test(line) &&
      !/^\\(?:pagebreak|begin|end|label|centering|hline)/.test(line) &&
      !/^\\section/.test(line),
    )
}

function headingName(line) {
  const cleaned = cleanText(line).replace(/:$/, '').trim()
  return /^(ingredients|instructions|notes?|variations?|comments?|preparation|cooking times|finishing|quick chilling)/i.test(cleaned)
    ? cleaned.toLowerCase()
    : ''
}

function findIngredientBounds(lines) {
  let start = lines.findIndex((line) => {
    const text = cleanText(line).replace(/:$/, '')
    return /\\bf[^}]*ingredients?/i.test(line) || /^(?:.+\s+)?ingredients?$/i.test(text)
  })
  if (start >= 0) start += 1

  let instruction = lines.findIndex((line) => /^instructions?\b/i.test(cleanText(line)))
  if (instruction < 0) {
    instruction = lines.findIndex((line, i) =>
      i > Math.max(start, 0) &&
      (/^\\begin\{(?:enumerate|itemize)\}/.test(line) || /^\d+\.\s/.test(cleanText(line))),
    )
  }

  if (start < 0) {
    start = lines.findIndex((line) =>
      /^(?:\d+(?:[./]\d+)?|[¼½¾⅓⅔⅛]|pinch\b)/i.test(cleanText(line)),
    )
  }

  let instructionIsAction = false
  if (instruction < 0) {
    const action = lines.findIndex((line, i) =>
      i > start &&
      /^(?:mix|combine|prepare|grill|whisk|heat|place|toss|warm)\b/i.test(cleanText(line)),
    )
    if (action >= 0) {
      instruction = action
      instructionIsAction = true
    }
  }

  return {
    start,
    instruction: instruction < 0 ? lines.length : instruction,
    instructionIsAction,
  }
}

const groupHeadings = /^(?:optional|other|batter|.*ingredients?|sauce|pancakes?|shrimp|corn cakes?|for the beans.*|for the soup base|to finish.*|for serving|cornmeal biscuits|ratatouille|garlic crumbs.*|notes?|soup|croutes)$/i

function isIngredientLine(line) {
  const text = cleanText(line)
  if (!text || /^\\(?:begin|end|item)/.test(line) || /^\*/.test(text)) return false
  if (groupHeadings.test(text.replace(/:$/, ''))) return false
  if (/^(?:makes?|serves?|yield|note|from)\b/i.test(text)) return false
  return true
}

function parseNumber(text) {
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)\b/)
  if (mixed) return { amount: Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]), length: mixed[0].length }
  const fraction = text.match(/^(\d+)\/(\d+)\b/)
  if (fraction) return { amount: Number(fraction[1]) / Number(fraction[2]), length: fraction[0].length }
  const range = text.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/i)
  if (range) return {
    amount: (Number(range[1]) + Number(range[2])) / 2,
    length: range[0].length,
    range: range[0],
  }
  const number = text.match(/^\d+(?:\.\d+)?/)
  if (number) return { amount: Number(number[0]), length: number[0].length }
  // No quantity in source — do not invent 1
  return { amount: null, length: 0 }
}

const unitPatterns = [
  [/^(?:teaspoons?|tsp|t)\b/i, 'tsp'],
  [/^(?:tablespoons?|tbsp|tbs)\b/i, 'tbsp'],
  [/^T\b/, 'tbsp'],
  [/^(?:cups?|C)\b/, 'cup'],
  [/^(?:pounds?|lbs?|lb)\b/i, 'lb'],
  [/^(?:ounces?|oz\.?)\b/i, 'oz'],
  [/^(?:grams?|g)\b/i, 'g'],
  [/^(?:kilograms?|kg)\b/i, 'kg'],
  [/^(?:milliliters?|ml)\b/i, 'ml'],
  [/^(?:liters?|litres?|l)\b/i, 'l'],
  [/^(?:fluid ounces?|fl\.?\s*oz\.?)\b/i, 'fl_oz'],
  [/^pinches?\b/i, 'pinch'],
]

function parseIngredient(line, index) {
  let text = cleanText(line)
    .replace(/^\*+\s*/, '')
    .replace(/\.$/, '')
  let amountInfo

  if (/^pinch\b/i.test(text)) {
    amountInfo = { amount: 1, length: 0 }
  } else if (/^(?:a|an)\s+/i.test(text)) {
    amountInfo = { amount: 1, length: text.match(/^(?:a|an)\s+/i)[0].length }
  } else {
    amountInfo = parseNumber(text)
  }

  let rest = text.slice(amountInfo.length).trim()
  let unit = null
  for (const [pattern, normalized] of unitPatterns) {
    const match = rest.match(pattern)
    if (match) {
      unit = normalized
      rest = rest.slice(match[0].length).trim()
      break
    }
  }

  if (/^pinch\b/i.test(rest)) {
    unit = 'pinch'
    rest = rest.replace(/^pinch(?:es)?\b/i, '').trim()
  }

  rest = rest.replace(/^of\s+/i, '').replace(/^,\s*/, '').trim()
  const notes = []
  if (amountInfo.range) notes.push(`original quantity: ${amountInfo.range}`)
  if (!rest) rest = text

  return {
    id: `i${index + 1}`,
    name: rest,
    amount: amountInfo.amount,
    unit,
    notes: notes.join('; '),
  }
}

function instructionEnd(lines, instruction) {
  const stop = lines.findIndex((line, i) =>
    i > instruction &&
    !/^\\item\b/.test(line) &&
    /^(?:notes?|variations?|comments?|advance preparation|to serve|garnishes|to freeze|high altitude|optional additions|add-ins)\b/i.test(cleanText(line)),
  )
  return stop < 0 ? lines.length : stop
}

function extractItems(block) {
  const normalized = block
    .replace(/\\begin\{(?:enumerate|itemize)\}/g, '')
    .replace(/\\end\{(?:enumerate|itemize)\}/g, '')
  const itemMatches = [...normalized.matchAll(/\\item\s+([\s\S]*?)(?=\\item|$)/g)]
  if (itemMatches.length) return itemMatches.map((match) => cleanText(match[1])).filter(Boolean)

  const manual = normalized
    .split(/(?:\\\\\s*)?\n/)
    .map(cleanText)
    .filter((line) => line && !/^instructions?\b/i.test(line))
  const numbered = manual.filter((line) => /^\d+\.\s*/.test(line))
  if (numbered.length) return numbered.map((line) => line.replace(/^\d+\.\s*/, ''))
  return manual
}

function getAttribution(lines, ingredientStart) {
  const prefix = lines.slice(0, Math.max(ingredientStart, 0)).map(cleanText)
  const source = prefix.find((line) =>
    /^(?:from(?::)?\s+|joy of cooking$|julia child$|lorraine spector|j\.\s*kenji|melissa clark|colu henry)/i.test(line),
  )
  return source ? cleanText(source.replace(/^from(?::)?\s*/i, '')) : ''
}

function categoriesFor(entry) {
  const categories = {
    method: [],
    diet: [],
    meal: [],
    season: [],
    cuisine: [],
    main_ingredient: [],
  }
  const haystack = `${entry.title} ${entry.body}`.toLowerCase()

  if (entry.section === 'Breakfast') categories.meal.push('breakfast')
  if (entry.section === 'Bready things') categories.meal.push('side dish')
  if (entry.section === 'Soups') categories.meal.push('dinner')
  if (['Seafood', 'Pasta', 'Chicken', 'Mains'].includes(entry.section)) categories.meal.push('dinner')
  if (entry.section === 'Vegetables') categories.meal.push('side dish')
  if (entry.section === 'Desserts') categories.meal.push('dessert')
  if (entry.section.startsWith('Salads')) categories.meal.push('side dish')

  if (/instant pot|pressure cooker/.test(haystack)) categories.method.push('instant pot')
  else if (/wok|stir-fry/.test(haystack)) categories.method.push('wok')
  else if (/grill|bbq/.test(haystack)) categories.method.push('grill')
  else if (/\bsous vide\b/.test(haystack)) categories.method.push('sous vide')
  else if (/\b(bake|baked|baking|oven|broil)\b/.test(haystack) && !/\bsoup\b|\bstew\b|\bsimmer\b/.test(haystack)) categories.method.push('baking')
  else if (/\broast/.test(haystack) && !/\bsoup\b|\bstew\b|pepper\b/.test(haystack)) categories.method.push('baking')
  else categories.method.push('stovetop')

  const cuisineRules = [
    ['italian', /minestrone|puttanesca|gnocchi|pasta con sarde|cassoulet/],
    ['mexican', /fish tacos|anaheim|poblano|chipotle/],
    ['japanese', /miso|okonomiyaki/],
    ['chinese', /sichuan|mapo tofu|shiitake/],
    ['indian', /indian-style|curry chicken/],
    ['french', /potage parmentier|french onion|provencal|poisson piperade/],
    ['mediterranean', /mediterranean flavors/],
    ['spanish', /spanish tortilla/],
    ['korean', /gochujang|gochugaru/],
  ]
  for (const [name, pattern] of cuisineRules) if (pattern.test(haystack)) categories.cuisine.push(name)

  const ingredientRules = [
    ['fish', /\bfish\b|black cod|sardine/],
    ['shrimp', /\bshrimp\b/],
    ['chicken', /\bchicken\b/],
    ['pork', /\bpork\b|sausage|bacon|pancetta/],
    ['beef', /\bbeef\b/],
    ['tofu', /\btofu\b/],
  ]
  for (const [name, pattern] of ingredientRules) {
    if (pattern.test(entry.title.toLowerCase())) categories.main_ingredient.push(name)
  }
  return categories
}

function tagsFor(entry) {
  const tags = []
  if (entry.section === 'Bready things') tags.push('bread')
  if (entry.section === 'Soups' || /stew/i.test(entry.title)) tags.push('soup')
  if (entry.section.startsWith('Salads') && /salad/i.test(entry.title)) tags.push('salad')
  if (/dressing|relish|salsa|pickled|spaghetti sauce/i.test(entry.title)) tags.push('condiment')
  if (/ice cream/i.test(entry.title)) tags.push('frozen dessert')
  return [...new Set(tags)]
}

function notesFor(lines, ingredientStart, instruction, end) {
  const chunks = []
  const prefix = lines.slice(0, Math.max(ingredientStart, 0))
    .map(cleanText)
    .filter((line) =>
      line &&
      !/\bingredients?\b/i.test(line) &&
      !/^(?:from|joy of cooking|julia child|lorraine spector|melissa clark|colu henry|serves?|makes?|yield)\b/i.test(line),
    )
  chunks.push(...prefix)
  chunks.push(
    ...lines
      .slice(Math.max(ingredientStart, 0), instruction)
      .filter((line) => /^\*/.test(cleanText(line)))
      .map(cleanText),
  )
  const preInstructionNotes = lines.findIndex((line, index) =>
    index >= ingredientStart &&
    index < instruction &&
    /^notes?\b/i.test(cleanText(line)),
  )
  if (preInstructionNotes >= 0) {
    chunks.push(...lines.slice(preInstructionNotes + 1, instruction).map(cleanText))
  }
  if (end < lines.length) chunks.push(...lines.slice(end).map(cleanText))
  return chunks
    .filter((line) =>
      line &&
      !/^(?:\\begin|\\end)/.test(line) &&
      !/^(?:notes?|variations?|comments?)\s*:?\s*$/i.test(line),
    )
    .join(' ')
    .trim()
}

for (const entry of entries) {
  if (entry.title === 'Sous Vide notes') {
    skipped.push({ title: entry.title, reason: 'reference notes with no recipe ingredients' })
    continue
  }

  const lines = meaningfulLines(entry.body)
  const { start, instruction, instructionIsAction } = findIngredientBounds(lines)
  const end = instructionEnd(lines, instruction)
  let ingredientSourceEnd = instruction
  const embeddedNotes = lines.findIndex((line, index) =>
    index >= start &&
    index < instruction &&
    /^notes?\b/i.test(cleanText(line)),
  )
  if (embeddedNotes >= 0) ingredientSourceEnd = embeddedNotes
  let ingredientLines = lines.slice(start, ingredientSourceEnd).filter(isIngredientLine)

  // An unescaped newline occasionally joins two ingredient rows in the source.
  ingredientLines = ingredientLines.flatMap((line) => {
    const cleaned = line.replace(/\\\\\s*$/, '')
    return cleaned.includes(' pine nuts1 tbs ') ? cleaned.replace(' pine nuts1 tbs ', ' pine nuts\\\\1 tbs ').split('\\\\') : [line]
  })

  const ingredients = ingredientLines.map(parseIngredient)
  const stepBlock = lines.slice(instruction + (instructionIsAction ? 0 : 1), end).join('\n')
  const stepTexts = extractItems(stepBlock)
  const steps = stepTexts.map((text, index) => ({ id: `s${index + 1}`, text }))

  if (!ingredients.length || !steps.length) {
    skipped.push({
      title: entry.title,
      reason: `parser found ${ingredients.length} ingredients and ${steps.length} steps`,
    })
    continue
  }

  const servingsMatch = cleanText(entry.body).match(/\b(?:serves?|servings?:)\s+(?:about\s+)?(\d+)/i)
  const attribution = getAttribution(lines, start)
  recipes.push({
    id: slugify(entry.title),
    title: entry.title,
    categories: categoriesFor(entry),
    tags: tagsFor(entry),
    ...(servingsMatch ? { servings: Number(servingsMatch[1]) } : {}),
    ingredients,
    steps,
    ...(attribution ? { attribution: { name: attribution } } : {}),
    notes: notesFor(lines, start, instruction, end),
    created_at: timestamp,
    updated_at: timestamp,
  })
}

fs.mkdirSync(recipesDir, { recursive: true })
for (const file of fs.readdirSync(recipesDir)) {
  if (file.endsWith('.json')) fs.rmSync(path.join(recipesDir, file))
}
for (const recipe of recipes) {
  fs.writeFileSync(path.join(recipesDir, `${recipe.id}.json`), `${JSON.stringify(recipe, null, 2)}\n`)
}

const cuisines = ['italian', 'mexican', 'japanese', 'chinese', 'indian', 'french', 'mediterranean', 'spanish', 'korean']
const mainIngredients = ['fish', 'shrimp', 'chicken', 'pork', 'beef', 'tofu']
const categoriesPath = path.join(root, 'data/categories.json')
const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'))
categories.cuisine = cuisines.map((name, index) => ({ id: `c${index + 1}`, name }))
categories.main_ingredient = mainIngredients.map((name, index) => ({ id: `mi${index + 1}`, name }))
fs.writeFileSync(categoriesPath, `${JSON.stringify(categories, null, 2)}\n`)

const tagNames = ['bread', 'soup', 'salad', 'condiment', 'frozen dessert']
fs.writeFileSync(
  path.join(root, 'data/tags.json'),
  `${JSON.stringify({ tags: tagNames.map((name, index) => ({ id: `t${index + 1}`, name })) }, null, 2)}\n`,
)

console.log(`Wrote ${recipes.length} recipes.`)
for (const item of skipped) console.log(`Skipped "${item.title}": ${item.reason}.`)
