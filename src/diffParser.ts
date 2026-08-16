export interface DiffLine {
  type: 'add' | 'del' | 'context' | 'nonewline'
  oldNo: number | null
  newNo: number | null
  content: string
}

export interface Hunk {
  header: string
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  oldNo: number
  newNo: number
  lines: DiffLine[]
}

export type DiffStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'binary'

export interface DiffFile {
  path: string
  status: DiffStatus
  binary: boolean
  hunks: Hunk[]
}

function cleanPath(p: string): string {
  p = p.trim()
  if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1)
  if (p.startsWith('b/')) return p.slice(2)
  if (p.startsWith('a/')) return p.slice(2)
  return p
}

function parseHunk(line: string): Hunk {
  const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line)
  const oldStart = m ? parseInt(m[1], 10) : 1
  const oldCount = m && m[2] ? parseInt(m[2], 10) : 1
  const newStart = m ? parseInt(m[3], 10) : 1
  const newCount = m && m[4] ? parseInt(m[4], 10) : 1
  return {
    header: line,
    oldStart,
    oldCount,
    newStart,
    newCount,
    oldNo: oldStart - 1,
    newNo: newStart - 1,
    lines: [],
  }
}

export function parseDiff(raw: string): DiffFile[] {
  const files: DiffFile[] = []
  let cur: DiffFile | null = null
  let oldPath = ''

  const lines = raw.split('\n')

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      oldPath = ''
      cur = { path: '', status: 'modified', binary: false, hunks: [] }
      files.push(cur)
    } else if (!cur) {
      continue
    } else if (line.startsWith('new file mode')) {
      cur.status = 'added'
    } else if (line.startsWith('deleted file mode')) {
      cur.status = 'deleted'
    } else if (line.startsWith('rename from')) {
      cur.status = 'renamed'
    } else if (line.startsWith('--- a/')) {
      oldPath = cleanPath(line.slice(4))
      if (!cur.path) cur.path = oldPath
    } else if (line.startsWith('+++ b/')) {
      cur.path = cleanPath(line.slice(4))
    } else if (
      line.startsWith('Binary files')
      || line.startsWith('GIT binary patch')
    ) {
      cur.binary = true
    } else if (line.startsWith('@@')) {
      cur.hunks.push(parseHunk(line))
    } else if (cur.hunks.length > 0) {
      const h = cur.hunks[cur.hunks.length - 1]
      if (line.startsWith('\\ No newline')) {
        h.lines.push({ type: 'nonewline', oldNo: null, newNo: null, content: line.slice(1) })
        continue
      }
      if (line.startsWith('+')) {
        h.newNo += 1
        h.lines.push({ type: 'add', oldNo: null, newNo: h.newNo, content: line.slice(1) })
      } else if (line.startsWith('-')) {
        h.oldNo += 1
        h.lines.push({ type: 'del', oldNo: h.oldNo, newNo: null, content: line.slice(1) })
      } else {
        h.oldNo += 1
        h.newNo += 1
        h.lines.push({ type: 'context', oldNo: h.oldNo, newNo: h.newNo, content: line.slice(1) })
      }
    }
  }

  for (const f of files) {
    if (!f.path) f.path = oldPath || 'unknown'
    if (f.binary) f.hunks = []
  }
  return files
}

export function countChanges(files: DiffFile[]): { add: number, del: number } {
  let add = 0
  let del = 0
  for (const f of files) {
    for (const h of f.hunks) {
      for (const l of h.lines) {
        if (l.type === 'add') add++
        else if (l.type === 'del') del++
      }
    }
  }
  return { add, del }
}
