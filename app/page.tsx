'use client'
import { useEffect, useMemo, useState } from 'react'
import raw from '../data/events.json'
import rawExams from '../data/exams.json'
import rawArchive from '../data/archive.json'

type Ev = {
  id: string
  title: string
  category: string
  issuer: string
  deadline: string
  audience: { grade: string[]; major: string[] }
  materials: string[]
  entry: string
  sourceUrl: string
  publishTime: string
  leadTime: number
  commonMiss: string
  startDate?: string
  desc?: string
  todos?: string[]
}

type Exam = {
  id: string
  type: 'exam'
  classCode: string
  title: string
  category: '考试'
  deadline: string
  time: string
  place: string
  campus: string
  leadTime: number
}

type Item = Ev | Exam

type CustomItem = {
  id: string
  title: string
  deadline: string
  leadTime: number
  desc?: string
  todos?: string[]
}

const CUSTOM_CATEGORY = '自定义'
const toEv = (c: CustomItem): Ev => ({
  id: c.id,
  title: c.title,
  category: CUSTOM_CATEGORY,
  issuer: '我自己添加',
  deadline: c.deadline,
  audience: { grade: ['不限'], major: ['不限'] },
  materials: [],
  entry: '',
  sourceUrl: '',
  publishTime: `${c.deadline}T00:00:00`,
  leadTime: c.leadTime,
  commonMiss: '',
  desc: c.desc,
  todos: c.todos,
})

type St = 'expired' | 'red' | 'yellow' | 'gray'

type Archive = {
  id: string
  title: string
  organizer: string
  category: string
  startDate: string
  endDate: string
}

const EV = raw as Ev[]
const EXAMS = rawExams as Exam[]
const ARCHIVE = rawArchive as Archive[]
const GRADES = ['大一', '大二', '大三', '大四', '大五']
const MAJORS = [
  '临床医学（5+3一体化）',
  '临床医学（5+3一体化，医学影像学方向）',
  '临床医学（新医科交大医学班）',
  '临床医学',
  '医学影像学',
  '医学影像技术',
  '信息管理与信息系统',
  '智能医学工程',
]
const ALL_CLASSES = Array.from(new Set(EXAMS.map((e) => e.classCode)))
const GRADE_PREFIX: Record<string, string> = {
  大一: '26',
  大二: '25',
  大三: '24',
  大四: '23',
  大五: '22',
}
const DISCOVER_CATS = ['全部', '比赛', '志愿', '讲座', '其他'] as const
type DiscoverCat = (typeof DISCOVER_CATS)[number]
const PUB_GRADES = ['大一', '大二', '大三', '大四', '大五', '不限']
const PUB_CATS = ['比赛', '志愿', '讲座', '其他']

const majorKeywords = (m: string) => {
  const core = m.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '')
  const keys = new Set<string>()
  for (let i = 0; i + 2 <= core.length; i++) keys.add(core.slice(i, i + 2))
  return Array.from(keys)
}
const majorFitsClass = (code: string, major: string) =>
  majorKeywords(major).some((k) => code.includes(k))

const toDay = (s: string) => {
  const p = s.split('-').map(Number)
  return new Date(p[0], p[1] - 1, p[2])
}
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysLeft = (deadline: string, today: Date | null) => {
  if (!today) return 0
  const n = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((toDay(deadline).getTime() - n.getTime()) / 86400000)
}
const statusOf = (deadline: string, leadTime: number, today: Date | null): St => {
  if (!today) return 'gray'
  const l = daysLeft(deadline, today)
  if (l < 0) return 'expired'
  if (l <= leadTime) return 'red'
  if (l <= leadTime + 3) return 'yellow'
  return 'gray'
}
const ST: Record<St, { bar: string; badge: string; label: string; order: number }> = {
  red: { bar: 'bg-[#ef4444]', badge: 'bg-red-50 text-red-600', label: '现在必须开始', order: 0 },
  yellow: { bar: 'bg-[#f59e0b]', badge: 'bg-amber-50 text-amber-700', label: '临近截止', order: 1 },
  gray: { bar: 'bg-[#cbd5e1]', badge: 'bg-slate-100 text-slate-500', label: '还有时间', order: 2 },
  expired: { bar: 'bg-slate-200', badge: 'bg-slate-100 text-slate-400', label: '已截止', order: 3 },
}
const isExam = (e: Item): e is Exam => e.category === '考试' && 'classCode' in e
const rel = (e: Ev, g: string, m: string) =>
  (e.audience.grade.includes('不限') || e.audience.grade.includes(g)) &&
  (e.audience.major.includes('不限') || e.audience.major.includes(m))
const matchItem = (e: Item, g: string, m: string, c: string) =>
  isExam(e) ? e.classCode === c : rel(e, g, m)
const discoverTime = (e: Item) => (isExam(e) ? '1970-01-01T00:00:00Z' : e.publishTime)
const isPublished = (e: Item) => e.id.startsWith('p')
const isExpiredExam = (e: Item, today: Date | null) =>
  isExam(e) && today !== null && daysLeft(e.deadline, today) < 0

const discoverBucket = (category: string) => {
  if (category === '比赛') return '比赛'
  if (category === '志愿') return '志愿'
  if (category === '讲座') return '讲座'
  return '其他'
}

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)
const CompassIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
)
const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export default function Home() {
  const [tab, setTab] = useState('schedule')
  const [grade, setGrade] = useState('大三')
  const [major, setMajor] = useState('临床医学')
  const [classCode, setClassCode] = useState('24临床I（1）')
  const [editing, setEditing] = useState(false)
  const [joined, setJoined] = useState<string[]>([])
  const [checked, setChecked] = useState<Record<string, string[]>>({})
  const [extra, setExtra] = useState<Ev[]>([])
  const [open, setOpen] = useState('')
  const [today, setToday] = useState<Date | null>(null)
  const [cursor, setCursor] = useState<{ y: number; m: number } | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [custom, setCustom] = useState<CustomItem[]>([])
  const [role, setRole] = useState<'student' | 'org'>('student')
  const [adding, setAdding] = useState(false)
  const [sheetIn, setSheetIn] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftTodos, setDraftTodos] = useState<string[]>([])
  const [todoInput, setTodoInput] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [pubTitle, setPubTitle] = useState('')
  const [pubIssuer, setPubIssuer] = useState('')
  const [pubCat, setPubCat] = useState('比赛')
  const [pubEnd, setPubEnd] = useState('')
  const [pubGrades, setPubGrades] = useState<string[]>(['不限'])
  const [pubDesc, setPubDesc] = useState('')
  const [pubEntry, setPubEntry] = useState('')
  const [openPub, setOpenPub] = useState('')
  const [delTarget, setDelTarget] = useState<{
    kind: 'custom' | 'published' | 'remove'
    id: string
    title: string
  } | null>(null)

  useEffect(() => {
    if (!adding && !delTarget && !publishing) {
      setSheetIn(false)
      document.body.style.overflow = ''
      return
    }
    document.body.style.overflow = 'hidden'
    const id = requestAnimationFrame(() => setSheetIn(true))
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
    }
  }, [adding, delTarget, publishing])

  useEffect(() => {
    const g = localStorage.getItem('grade')
    const m = localStorage.getItem('major')
    const c = localStorage.getItem('classCode')
    const j = localStorage.getItem('joined')
    const ch = localStorage.getItem('checked')
    const cu = localStorage.getItem('customItems')
    const r = localStorage.getItem('meRole')
    const pi = localStorage.getItem('publishedItems')
    if (g) setGrade(g)
    if (m) setMajor(m)
    if (c) setClassCode(c)
    if (j) setJoined(JSON.parse(j))
    if (ch) setChecked(JSON.parse(ch))
    if (cu) setCustom(JSON.parse(cu))
    if (r === 'org') setRole('org')
    if (pi) setExtra(JSON.parse(pi))
  }, [])

  useEffect(() => {
    setToday(new Date())
  }, [])

  const classOptions = useMemo(() => {
    const prefix = GRADE_PREFIX[grade] || ''
    const byGrade = ALL_CLASSES.filter((c) => c.startsWith(prefix))
    const byMajor = byGrade.filter((c) => majorFitsClass(c, major))
    return (byMajor.length > 0 ? byMajor : byGrade).slice(0, 6)
  }, [grade, major])

  useEffect(() => {
    if (classOptions.length === 0) {
      if (classCode !== '') setClassCode('')
      return
    }
    if (!classOptions.includes(classCode)) setClassCode(classOptions[0])
  }, [classOptions, classCode])

  const all = useMemo(
    () => [...extra, ...EV, ...EXAMS, ...custom.map(toEv)],
    [extra, custom]
  )
  const mine = useMemo(
    () =>
      all.filter(
        // 自己发布的招募不受身份筛选影响，否则发布完在发现页看不到
        (e) => (isPublished(e) || matchItem(e, grade, major, classCode)) && !isExpiredExam(e, today)
      ),
    [all, grade, major, classCode, today]
  )
  const sorted = useMemo(
    () =>
      [...mine].sort(
        (a, b) =>
          ST[statusOf(a.deadline, a.leadTime, today)].order -
          ST[statusOf(b.deadline, b.leadTime, today)].order
      ),
    [mine, today]
  )
  const todayKey = today ? dayKey(today) : ''
  const activeKey = selectedDay ?? todayKey
  const viewY = cursor?.y ?? (today ? today.getFullYear() : 0)
  const viewM = cursor?.m ?? (today ? today.getMonth() : 0)

  const dotOf = useMemo(() => {
    const rank: Record<St, number> = { red: 0, yellow: 1, gray: 2, expired: 3 }
    const map: Record<string, St> = {}
    if (!today) return map
    for (const e of sorted) {
      const s: St =
        e.category === CUSTOM_CATEGORY ? 'gray' : statusOf(e.deadline, e.leadTime, today)
      const cur = map[e.deadline]
      if (cur === undefined || rank[s] < rank[cur]) map[e.deadline] = s
    }
    return map
  }, [sorted, today])

  const dayItems = useMemo(
    () => (activeKey ? sorted.filter((e) => e.deadline === activeKey) : []),
    [sorted, activeKey]
  )

  const published = useMemo(() => extra.filter((e) => e.id.startsWith('p')), [extra])

  const discoverItems = useMemo(
    () => mine.filter((e): e is Ev => !isExam(e) && e.category !== CUSTOM_CATEGORY),
    [mine]
  )

  const [discoverMode, setDiscoverMode] = useState<'recent' | 'archive'>('recent')
  const [discoverCat, setDiscoverCat] = useState<DiscoverCat>('全部')

  // 「最近招募」：当前身份可见的非考试事项，按发表时间倒序
  const recentShown = useMemo(() => {
    const list =
      discoverCat === '全部'
        ? discoverItems
        : discoverItems.filter((e) => discoverBucket(e.category) === discoverCat)
    return [...list].sort((a, b) => (discoverTime(a) < discoverTime(b) ? 1 : -1))
  }, [discoverItems, discoverCat])

  // 「去年今月」：archive.json 里 startDate 月份等于当前月份的记录
  const archiveShown = useMemo(() => {
    if (!today) return []
    const m = today.getMonth() + 1
    return ARCHIVE.filter((a) => Number(a.startDate.slice(5, 7)) === m)
      .filter((a) => discoverCat === '全部' || discoverBucket(a.category) === discoverCat)
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
  }, [today, discoverCat])

  const archiveMonth = today ? today.getMonth() + 1 : 0
  const fmtArchiveDay = (s: string) => s.replace(/-/g, '.')
  const fmtArchiveRange = (a: Archive) =>
    a.startDate === a.endDate
      ? fmtArchiveDay(a.startDate)
      : `${fmtArchiveDay(a.startDate)} - ${a.endDate.slice(5).replace('-', '.')}`

  const cells = useMemo(() => {
    if (viewY === 0) return [] as (number | null)[]
    const first = new Date(viewY, viewM, 1)
    const offset = (first.getDay() + 6) % 7
    const total = new Date(viewY, viewM + 1, 0).getDate()
    const out: (number | null)[] = Array(offset).fill(null)
    for (let d = 1; d <= total; d++) out.push(d)
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [viewY, viewM])

  const shiftMonth = (delta: number) => {
    const base = new Date(viewY, viewM + delta, 1)
    setCursor({ y: base.getFullYear(), m: base.getMonth() })
  }

  const save = () => {
    localStorage.setItem('grade', grade)
    localStorage.setItem('major', major)
    localStorage.setItem('classCode', classCode)
    setEditing(false)
  }
  const join = (id: string) => {
    const n = joined.includes(id) ? joined.filter((x) => x !== id) : [...joined, id]
    setJoined(n)
    localStorage.setItem('joined', JSON.stringify(n))
  }
  const tick = (id: string, m: string) => {
    const cur = checked[id] || []
    const n = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]
    const obj = { ...checked, [id]: n }
    setChecked(obj)
    localStorage.setItem('checked', JSON.stringify(obj))
  }

  const persistCustom = (n: CustomItem[]) => {
    setCustom(n)
    localStorage.setItem('customItems', JSON.stringify(n))
  }
  const openAdd = () => {
    setDraftTitle('')
    setDraftDesc('')
    setDraftTodos([])
    setTodoInput('')
    setAdding(true)
  }
  const closeAdd = () => setAdding(false)
  const addTodo = () => {
    const v = todoInput.trim()
    if (!v) return
    setDraftTodos((prev) => (prev.includes(v) ? prev : [...prev, v]))
    setTodoInput('')
  }
  const removeTodo = (i: number) => setDraftTodos((prev) => prev.filter((_, k) => k !== i))
  const saveCustom = () => {
    const t = draftTitle.trim()
    if (!t || !activeKey) return
    const desc = draftDesc.trim() ? draftDesc.trim() : undefined
    // 输入框里还没点「+ 添加」的文字，保存时自动补进去
    const typed = todoInput.trim()
    const todos = typed && !draftTodos.includes(typed) ? [...draftTodos, typed] : [...draftTodos]
    persistCustom([
      {
        id: 'c' + Date.now(),
        title: t,
        deadline: activeKey,
        leadTime: 1,
        desc,
        todos: todos.length > 0 ? todos : undefined,
      },
      ...custom,
    ])
    setTodoInput('')
    setAdding(false)
  }
  const removeCustom = (id: string) => persistCustom(custom.filter((x) => x.id !== id))

  const askDeleteCustom = (id: string, title: string) => setDelTarget({ kind: 'custom', id, title })
  const askDeletePublished = (id: string, title: string) => setDelTarget({ kind: 'published', id, title })
  // 移除 = 取消关注，只影响 joined，不删数据
  const askRemove = (id: string, title: string) => setDelTarget({ kind: 'remove', id, title })
  const confirmDelete = () => {
    if (!delTarget) return
    if (delTarget.kind === 'custom') removeCustom(delTarget.id)
    else if (delTarget.kind === 'published') removePublished(delTarget.id)
    else join(delTarget.id)
    setDelTarget(null)
  }

  const switchRole = (r: 'student' | 'org') => {
    setRole(r)
    localStorage.setItem('meRole', r)
  }

  const persistPublished = (n: Ev[]) => {
    setExtra(n)
    localStorage.setItem('publishedItems', JSON.stringify(n))
  }

  const openPublish = () => {
    setPubTitle('')
    setPubIssuer('')
    setPubCat('比赛')
    setPubEnd('')
    setPubGrades(['不限'])
    setPubDesc('')
    setPubEntry('')
    setPublishing(true)
  }
  const togglePubGrade = (g: string) => {
    // 用函数式更新，避免连点多选 chip 时互相覆盖
    setPubGrades((prev) => {
      if (g === '不限') return prev.includes('不限') ? [] : ['不限']
      const rest = prev.filter((x) => x !== '不限' && x !== g)
      const next = prev.includes(g) ? rest : [...rest, g]
      return PUB_GRADES.filter((x) => next.includes(x))
    })
  }
  const canPublish = pubTitle.trim() !== '' && pubIssuer.trim() !== '' && pubEnd !== ''
  const submitPublish = () => {
    if (!canPublish) return
    const ev: Ev = {
      id: 'p' + Date.now(),
      title: pubTitle.trim(),
      category: pubCat,
      issuer: pubIssuer.trim(),
      deadline: pubEnd,
      audience: {
        grade: pubGrades.length > 0 ? pubGrades : ['不限'],
        major: ['不限'],
      },
      materials: [],
      entry: pubEntry.trim(),
      sourceUrl: '',
      publishTime: new Date().toISOString(),
      leadTime: 3,
      commonMiss: '',
      desc: pubDesc.trim() || undefined,
    }
    persistPublished([ev, ...extra])
    setPublishing(false)
    setTab('discover')
  }
  const removePublished = (id: string) => persistPublished(extra.filter((x) => x.id !== id))

  const Card = ({ e }: { e: Item }) => {
    if (today === null) return null
    const exam = isExam(e)
    const isCustomItem = e.category === CUSTOM_CATEGORY
    const s = statusOf(e.deadline, e.leadTime, today)
    const meta = ST[s]
    const isOpen = open === e.id
    const done = checked[e.id] || []
    const customDesc = isCustomItem && 'desc' in e ? e.desc : undefined
    const customTodos = isCustomItem && 'todos' in e ? e.todos ?? [] : []
    const todosDone = customTodos.filter((t) => done.includes(t)).length
    return (
      <div className="w-full overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="flex">
          <div className={`w-1.5 shrink-0 ${meta.bar}`} />
          <div className="flex-1 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-[14px] font-medium leading-snug text-slate-900">{e.title}</div>
                {customDesc && (
                  <div className="mt-1 line-clamp-3 text-xs text-slate-500">{customDesc}</div>
                )}
                {!isCustomItem && (
                  <div className="mt-1 text-[11px] text-slate-400">
                    {exam ? e.campus : e.issuer} · {e.category}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${meta.badge}`}>
                  {s === 'expired' ? '已截止' : `剩 ${daysLeft(e.deadline, today)} 天`}
                </span>
                {!exam && !isCustomItem && (
                  <button
                    onClick={() => (joined.includes(e.id) ? askRemove(e.id, e.title) : join(e.id))}
                    aria-pressed={joined.includes(e.id)}
                    className={`inline-flex min-h-[28px] shrink-0 items-center rounded-lg px-2.5 text-[11px] transition active:opacity-70 ${
                      joined.includes(e.id)
                        ? 'bg-slate-100 text-slate-500'
                        : 'border border-slate-200 text-slate-600'
                    }`}
                  >
                    {joined.includes(e.id) ? '移除' : '+ 加入'}
                  </button>
                )}
              </div>
            </div>

            {customTodos.length > 0 && (
              <div className="mt-2">
                <div className="mb-1 text-xs font-medium text-slate-700">
                  待办清单（已完成 {todosDone}/{customTodos.length}）
                </div>
                {customTodos.map((t) => (
                  <label key={t} className="flex items-center gap-2 py-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={done.includes(t)}
                      onChange={() => tick(e.id, t)}
                      className="h-4 w-4"
                    />
                    <span className={done.includes(t) ? 'text-slate-400 line-through' : ''}>{t}</span>
                  </label>
                ))}
              </div>
            )}

            {!isCustomItem && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {exam ? (
                <>
                  <span className="text-slate-500">日期 {e.deadline}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">时间 {e.time}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">考场 {e.place}</span>
                </>
              ) : (
                <>
                  <span className="text-slate-500">截止 {e.deadline.slice(5)}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">需提前 {e.leadTime} 天</span>
                </>
              )}
            </div>
            )}

            {!exam && e.commonMiss !== '' && (
              <div className="mt-2 flex items-center gap-1">
                <span className="text-[11px] font-medium text-red-600">{meta.label}</span>
                <span className="text-[11px] text-slate-500"> · {e.commonMiss}</span>
              </div>
            )}

            {isCustomItem ? (
              <button
                onClick={() => askDeleteCustom(e.id, e.title)}
                className="mt-2 rounded-xl px-2 py-1 text-xs text-slate-400"
              >
                删除
              </button>
            ) : (
              <button
                onClick={() => setOpen(isOpen ? '' : e.id)}
                className="mt-2 rounded-xl px-2 py-1 text-xs text-slate-600"
              >
                {isOpen ? '收起详情' : exam ? '查看考试信息' : '查看材料与入口'}
              </button>
            )}

            {isOpen && (
              <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                {exam ? (
                  <div className="text-xs text-slate-600">
                    <div><span className="text-slate-400">考试日期：</span>{e.deadline}</div>
                    <div><span className="text-slate-400">考试时间：</span>{e.time}</div>
                    <div><span className="text-slate-400">考场：</span>{e.place}</div>
                    <div><span className="text-slate-400">校区：</span>{e.campus}</div>
                    <div><span className="text-slate-400">班级：</span>{e.classCode}</div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="mb-1 text-xs font-medium text-slate-700">
                        材料清单（{done.length}/{e.materials.length}）
                      </div>
                      {e.materials.map((m) => (
                        <label key={m} className="flex items-center gap-2 py-1 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={done.includes(m)}
                            onChange={() => tick(e.id, m)}
                            className="h-4 w-4"
                          />
                          <span className={done.includes(m) ? 'text-slate-400 line-through' : ''}>{m}</span>
                        </label>
                      ))}
                    </div>
                    <div className="text-xs text-slate-600">
                      <span className="text-slate-400">办理入口：</span>
                      {e.entry}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-[#f8fafc] pb-20">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[19px] font-semibold tracking-tight text-slate-900">温医大通知</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {grade} · {major}
              {classCode ? ` · ${classCode}` : ''}
            </div>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="rounded-xl border border-slate-200/70 px-3 py-1.5 text-xs text-slate-600"
          >
            修改身份
          </button>
        </div>

        {editing && (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200/70 bg-[#f8fafc] p-3">
            <div className="text-xs text-slate-500">年级</div>
            <div className="flex flex-wrap gap-1.5">
              {GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => setGrade(g)}
                  className={`rounded-xl px-3 py-1 text-xs ${
                    grade === g ? 'bg-slate-900 text-white' : 'border border-slate-200/70 bg-white text-slate-600'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="pt-1 text-xs text-slate-500">专业</div>
            <div className="flex flex-wrap gap-1.5">
              {MAJORS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMajor(m)}
                  className={`rounded-xl px-3 py-1 text-xs ${
                    major === m ? 'bg-slate-900 text-white' : 'border border-slate-200/70 bg-white text-slate-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="pt-1 text-xs text-slate-500">班级</div>
            <div className="flex flex-wrap gap-1.5">
              {classOptions.length === 0 ? (
                <div className="px-1 py-1 text-xs text-slate-400">暂无班级数据</div>
              ) : (
                classOptions.map((c) => (
                  <button
                    key={c}
                    onClick={() => setClassCode(c)}
                    className={`rounded-xl px-3 py-1 text-xs ${
                      classCode === c ? 'bg-slate-900 text-white' : 'border border-slate-200/70 bg-white text-slate-600'
                    }`}
                  >
                    {c}
                  </button>
                ))
              )}
            </div>
            <button onClick={save} className="w-full rounded-xl bg-[#1e4d8c] py-2 text-sm text-white">
              保存
            </button>
          </div>
        )}
      </header>

      {today === null ? (
        <div className="px-4 py-10 text-center text-sm text-slate-400">加载中...</div>
      ) : (
        <>
      {tab === 'schedule' && (
        <div className="w-full space-y-2 px-4">
          <div className="w-full rounded-lg bg-white p-3 pb-3 shadow-sm">
            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => shiftMonth(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-slate-400"
                aria-label="上个月"
              >
                ‹
              </button>
              <div className="text-sm font-semibold text-slate-900">
                {viewY}年{viewM + 1}月
              </div>
              <button
                onClick={() => shiftMonth(1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-slate-400"
                aria-label="下个月"
              >
                ›
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-slate-400">
              {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid w-full grid-cols-7 text-center">
              {cells.map((d, i) => {
                if (d === null) return <div key={`empty-${i}`} className="h-11 w-full" />
                const key = `${viewY}-${String(viewM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                const isToday = key === todayKey
                const isSelected = key === activeKey
                const s = dotOf[key]
                const dotColor =
                  s === 'red'
                    ? 'bg-[#ef4444]'
                    : s === 'yellow'
                      ? 'bg-[#f59e0b]'
                      : s
                        ? 'bg-[#cbd5e1]'
                        : ''
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(key)}
                    className="relative flex h-11 w-full flex-col items-center justify-center"
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                        isSelected
                          ? 'bg-[#1e4d8c] text-white'
                          : isToday
                            ? 'font-semibold text-[#1e4d8c]'
                            : 'text-slate-700'
                      }`}
                    >
                      {d}
                    </span>
                    {isToday ? (
                      <span className="absolute bottom-1 h-0.5 w-3 rounded-full bg-[#1e4d8c]" />
                    ) : dotColor ? (
                      <span className={`absolute bottom-1 h-1 w-1 rounded-full ${dotColor}`} />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={openAdd}
            disabled={!activeKey}
            className="w-full rounded-xl border border-dashed border-slate-300 bg-white py-2 text-xs text-slate-600 shadow-sm disabled:text-slate-300"
          >
            + 添加事项
          </button>

          <div className="w-full pt-1">
            <div className="mb-2 w-full text-sm font-semibold text-slate-900">
              {activeKey
                ? `${Number(activeKey.slice(5, 7))}月${Number(activeKey.slice(8, 10))}日 · ${dayItems.length}件事`
                : ''}
            </div>
            {dayItems.length === 0 ? (
              <div className="w-full rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-400 shadow-sm">
                这天没有安排
              </div>
            ) : (
              <div className="w-full space-y-2">
                {dayItems.map((e) => (
                  <Card key={e.id} e={e} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'discover' && (
        <div className="space-y-2 pb-4">
          {/* 主切换：最近招募 / 去年今月 */}
          <div className="mx-4 flex rounded-xl bg-slate-100 p-1 text-xs">
            {[
              { k: 'recent' as const, t: '最近招募' },
              { k: 'archive' as const, t: '去年今月' },
            ].map((o) => (
              <button
                key={o.k}
                onClick={() => setDiscoverMode(o.k)}
                className={`flex-1 rounded-lg py-1.5 ${
                  discoverMode === o.k ? 'bg-slate-900 font-medium text-white' : 'text-slate-500'
                }`}
              >
                {o.t}
              </button>
            ))}
          </div>

          {/* 分类筛选 chips：单行、可横向滚动 */}
          <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {DISCOVER_CATS.map((c) => (
              <button
                key={c}
                onClick={() => setDiscoverCat(c)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                  discoverCat === c
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200/70 bg-white text-slate-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* 统计行 */}
          <div className="px-4 py-1 text-xs text-slate-500">
            {discoverMode === 'recent'
              ? `共 ${recentShown.length} 条 · 已按你的身份筛选`
              : `去年今月（${archiveMonth} 月） · ${archiveShown.length} 条记录`}
          </div>

          {/* 列表 */}
          <div className="space-y-2 px-4">
            {discoverMode === 'recent' ? (
              recentShown.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs text-slate-400 shadow-sm">
                  暂无符合条件的通知
                </div>
              ) : (
                recentShown.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg bg-white p-3 shadow-sm"
                  >
                    <div className="text-[11px] text-slate-400">
                      {e.issuer} · {e.publishTime.slice(0, 10)}
                    </div>
                    <div className="mt-1 text-[14px] font-medium text-slate-900">{e.title}</div>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <div className="min-w-0 text-[11px] text-slate-500">
                        截止 {e.deadline} · {e.audience.grade.join('/')}
                      </div>
                      <button
                        onClick={() =>
                          joined.includes(e.id) ? askRemove(e.id, e.title) : join(e.id)
                        }
                        aria-pressed={joined.includes(e.id)}
                        className={`inline-flex min-h-[28px] shrink-0 items-center rounded-lg px-2.5 text-[11px] transition active:opacity-70 ${
                          joined.includes(e.id)
                            ? 'bg-slate-100 text-slate-500'
                            : 'border border-slate-200 text-slate-600'
                        }`}
                      >
                        {joined.includes(e.id) ? '移除' : '+ 加入日程'}
                      </button>
                    </div>

                    {isPublished(e) && (
                      <>
                        <button
                          onClick={() => setOpenPub(openPub === e.id ? '' : e.id)}
                          className="mt-2 rounded-xl py-1 text-xs text-slate-600"
                        >
                          {openPub === e.id ? '收起' : '查看详情'}
                        </button>
                        {openPub === e.id && (
                          <div className="mt-1 space-y-1 rounded-xl bg-slate-50 p-2 text-xs text-slate-600">
                            <div>
                              <span className="text-slate-400">截止日期：</span>
                              {e.deadline}
                            </div>
                            <div>
                              <span className="text-slate-400">要求说明：</span>
                              {e.desc || '—'}
                            </div>
                            <div>
                              <span className="text-slate-400">报名入口：</span>
                              {e.entry || '—'}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
              )
            ) : archiveShown.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs text-slate-400 shadow-sm">
                去年今月暂无记录
              </div>
            ) : (
              archiveShown.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium leading-snug text-slate-900">{a.title}</div>
                      <div className="mt-1 text-xs text-slate-400">{a.organizer}</div>
                      <div className="mt-1 text-xs text-slate-500">{fmtArchiveRange(a)}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                      去年
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'me' && (
        <div className="space-y-4 px-4">
          <div className="flex rounded-xl bg-slate-100 p-1 text-xs">
            {[
              { k: 'student' as const, t: '学生' },
              { k: 'org' as const, t: '学校' },
            ].map((o) => (
              <button
                key={o.k}
                onClick={() => switchRole(o.k)}
                className={`flex-1 rounded-lg py-1.5 ${
                  role === o.k ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {o.t}
              </button>
            ))}
          </div>

          {role === 'student' ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center">
              <div className="text-sm font-semibold text-slate-900">个性化设置</div>
              <div className="mt-1 text-xs text-slate-400">主题配色、提醒偏好等功能开发中</div>
            </div>
          ) : (
            <>
              <button
                onClick={openPublish}
                className="w-full rounded-xl bg-[#1e4d8c] py-2.5 text-sm text-white"
              >
                + 发布招募
              </button>

              <div>
                <div className="mb-2 text-sm font-semibold text-slate-900">我发布的</div>
                {published.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
                    还没有发布过招募
                  </div>
                ) : (
                  <div className="space-y-2">
                    {published.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white p-3 shadow-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-medium text-slate-900">{e.title}</div>
                          <div className="mt-0.5 text-[11px] text-slate-400">截止 {e.deadline}</div>
                        </div>
                        <button
                          onClick={() => askDeletePublished(e.id, e.title)}
                          className="shrink-0 rounded-lg border border-slate-200/70 px-2 py-0.5 text-[11px] text-slate-400"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
        </>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-slate-200/70 bg-white">
        <div className="flex h-16">
          {[
            { k: 'schedule', t: '日程', Icon: CalendarIcon },
            { k: 'discover', t: '发现', Icon: CompassIcon },
            { k: 'me', t: '我的', Icon: UserIcon },
          ].map((i) => (
            <button
              key={i.k}
              onClick={() => setTab(i.k)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs ${
                tab === i.k ? 'font-medium text-slate-900' : 'text-slate-400'
              }`}
            >
              <i.Icon className="h-5 w-5" />
              <span>{i.t}</span>
            </button>
          ))}
        </div>
      </nav>

      {adding && (
        <>
          <div
            onClick={closeAdd}
            className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ${
              sheetIn ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl transition-transform duration-200 ${
              sheetIn ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-slate-900">添加事项</div>
              <button
                onClick={closeAdd}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-slate-400"
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <div>
                <div className="mb-1 text-xs text-slate-500">事项名称</div>
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="如：交开题报告"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  autoFocus
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">备注</div>
                <input
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  placeholder="可留空，如：记得带纸质版"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">待办清单</div>

                {draftTodos.length > 0 && (
                  <div className="mb-2 space-y-2">
                    {draftTodos.map((t, i) => (
                      <div
                        key={`${t}-${i}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate">{t}</span>
                        <button
                          onClick={() => removeTodo(i)}
                          className="ml-2 shrink-0 text-base text-slate-400"
                          aria-label="删除待办"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    value={todoInput}
                    onChange={(e) => setTodoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTodo()
                      }
                    }}
                    placeholder="输入一条待办，回车添加"
                    className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <button
                    onClick={addTodo}
                    className="min-h-[44px] shrink-0 rounded-xl border border-slate-200 px-3 text-sm text-slate-600"
                  >
                    + 添加
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={saveCustom}
              disabled={!draftTitle.trim()}
              className="mt-4 w-full rounded-xl bg-[#1e4d8c] py-3 text-sm text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              保存
            </button>
          </div>
        </>
      )}

      {publishing && (
        <>
          <div
            onClick={() => setPublishing(false)}
            className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ${
              sheetIn ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl transition-transform duration-200 ${
              sheetIn ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-slate-900">发布招募</div>
              <button
                onClick={() => setPublishing(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-slate-400"
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <div>
                <div className="mb-1 text-xs text-slate-500">
                  活动名称<span className="ml-0.5 text-[#ef4444]">*</span>
                </div>
                <input
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  placeholder="如：第七届临床技能大赛"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">
                  主办方<span className="ml-0.5 text-[#ef4444]">*</span>
                </div>
                <input
                  value={pubIssuer}
                  onChange={(e) => setPubIssuer(e.target.value)}
                  placeholder="如：临床医学院技能中心"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">类别</div>
                <div className="flex flex-wrap gap-2">
                  {PUB_CATS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setPubCat(c)}
                      className={`min-h-[36px] rounded-full border px-3 text-xs transition ${
                        pubCat === c
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">
                  截止日期<span className="ml-0.5 text-[#ef4444]">*</span>
                </div>
                <input
                  type="date"
                  value={pubEnd}
                  onChange={(e) => setPubEnd(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">面向年级</div>
                <div className="flex flex-wrap gap-2">
                  {PUB_GRADES.map((g) => (
                    <button
                      key={g}
                      onClick={() => togglePubGrade(g)}
                      aria-pressed={pubGrades.includes(g)}
                      className={`min-h-[36px] rounded-full border px-3 text-xs transition ${
                        pubGrades.includes(g)
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">要求说明</div>
                <textarea
                  value={pubDesc}
                  onChange={(e) => setPubDesc(e.target.value)}
                  rows={2}
                  placeholder="如：需指导教师签字"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">报名入口</div>
                <input
                  value={pubEntry}
                  onChange={(e) => setPubEntry(e.target.value)}
                  placeholder="如：学科竞赛网 → 竞赛报名"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <button
              onClick={submitPublish}
              disabled={!canPublish}
              className="mt-4 w-full rounded-xl bg-[#1e4d8c] py-3 text-sm text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              发布
            </button>
          </div>
        </>
      )}

      {delTarget && (
        <>
          <div
            onClick={() => setDelTarget(null)}
            className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ${
              sheetIn ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl bg-white p-4 shadow-2xl transition-transform duration-200 ${
              sheetIn ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <div className="text-base font-semibold text-slate-900">
              {delTarget.kind === 'remove' ? '确定移出日程？' : '确定删除这条事项？'}
            </div>
            <div className="mt-1 line-clamp-2 text-xs text-slate-500">{delTarget.title}</div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDelTarget(null)}
                className="min-h-[44px] flex-1 rounded-xl bg-slate-100 py-3 text-sm text-slate-600"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="min-h-[44px] flex-1 rounded-xl bg-[#ef4444] py-3 text-sm text-white"
              >
                {delTarget.kind === 'remove' ? '移除' : '删除'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
