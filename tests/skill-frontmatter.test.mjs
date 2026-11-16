// Every */SKILL.md must carry frontmatter that a strict YAML parser accepts. The skills CLI
// (`npx skills add decentraland/sdk-skills --all`) parses it with the `yaml` package; a skill whose
// frontmatter fails to parse is skipped with a warning and the command still exits 0, so the skill
// silently never installs. promote-scene shipped that way for weeks: an unquoted description with a
// ": " inside it, which YAML reads as a nested mapping. Run with: node --test tests/
//
// The check is dependency-free and deliberately stricter than YAML: a value is either a quoted
// single-line string, or a plain scalar free of every sequence that gives plain scalars another meaning.
// Writing the description as one double-quoted line always passes.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const SKILLS = readdirSync(ROOT)
  .filter(name => !name.startsWith('.') && statSync(join(ROOT, name)).isDirectory())
  .filter(name => {
    try {
      return statSync(join(ROOT, name, 'SKILL.md')).isFile()
    } catch {
      return false
    }
  })
  .sort()

// Characters that give a plain scalar another meaning when they start it.
const INDICATORS = /^[-?:,[\]{}#&*!|>'"%@`\s]/

// Returns the reason a frontmatter value would be misread, or null when it is safe.
export function unsafeValueReason(value) {
  if (value === '') return 'is empty'
  if (/^"(?:[^"\\]|\\.)*"$/.test(value)) {
    try {
      JSON.parse(value)
      return null
    } catch {
      return 'is a double-quoted string with a bad escape; only \\" and \\\\ are needed'
    }
  }
  if (/^'(?:[^']|'')*'$/.test(value)) return null
  if (value.startsWith('"') || value.startsWith("'")) return 'opens a quote it does not close'
  if (INDICATORS.test(value)) return `starts with "${value[0]}", a YAML indicator; double-quote the value`
  if (value.includes(': ')) return 'contains ": ", which YAML reads as a nested mapping; double-quote the value'
  if (value.endsWith(':')) return 'ends with ":", which YAML reads as a mapping key; double-quote the value'
  if (value.includes(' #')) return 'contains " #", which YAML reads as a comment; double-quote the value'
  if (/[\t]/.test(value)) return 'contains a tab'
  return null
}

// Parses the frontmatter block of a SKILL.md into { key: rawValue }. Throws with the file-level problem.
export function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/)
  assert.equal(lines[0], '---', 'frontmatter must start on line 1 with ---')
  const end = lines.indexOf('---', 1)
  assert.notEqual(end, -1, 'frontmatter must be closed with a --- line')
  const fields = {}
  for (const [index, line] of lines.slice(1, end).entries()) {
    const match = /^([a-z][a-z0-9-]*): (.*)$/.exec(line)
    assert.ok(match, `frontmatter line ${index + 2} must be "key: value" on one line: ${JSON.stringify(line)}`)
    const [, key, value] = match
    assert.ok(!(key in fields), `frontmatter repeats the key "${key}"`)
    fields[key] = value
  }
  return fields
}

describe('SKILL.md frontmatter parses under strict YAML', () => {
  it('finds the skills', () => {
    assert.ok(SKILLS.length >= 30, `expected the skill folders, found ${SKILLS.length}`)
  })

  for (const skill of SKILLS) {
    it(`${skill}/SKILL.md`, () => {
      const fields = parseFrontmatter(readFileSync(join(ROOT, skill, 'SKILL.md'), 'utf8'))
      assert.ok('name' in fields, 'frontmatter needs a name')
      assert.ok('description' in fields, 'frontmatter needs a description')
      for (const [key, value] of Object.entries(fields)) {
        const reason = unsafeValueReason(value)
        assert.equal(reason, null, `${key} ${reason}`)
      }
      assert.equal(unquote(fields.name), skill, 'name must equal the folder name')
    })
  }
})

describe('unsafeValueReason', () => {
  it('accepts a double-quoted line and a safe plain scalar', () => {
    assert.equal(unsafeValueReason('"Kit for a scene or game: who it is for"'), null)
    assert.equal(unsafeValueReason("Use when the user wants a creator's kit (web-verified)."), null)
  })
  it('rejects the sequences that made the skills CLI skip promote-scene', () => {
    assert.match(unsafeValueReason('scene or game: names who it is for'), /nested mapping/)
    assert.match(unsafeValueReason('scene #1'), /comment/)
    assert.match(unsafeValueReason('- a list'), /indicator/)
    assert.match(unsafeValueReason('[flow, sequence]'), /indicator/)
    assert.match(unsafeValueReason('ends with a colon:'), /mapping key/)
    assert.match(unsafeValueReason('"unterminated'), /does not close/)
  })
})

function unquote(value) {
  if (value.startsWith('"')) return JSON.parse(value)
  if (value.startsWith("'")) return value.slice(1, -1).replace(/''/g, "'")
  return value
}
