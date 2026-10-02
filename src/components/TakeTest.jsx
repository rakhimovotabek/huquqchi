import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isBlank } from '../lib/format'
import { buildPlan } from '../lib/shuffle'
import { gradeAnswers } from '../lib/grading'
import { useFocusGuard } from '../lib/useFocusGuard'
import { useArrowKeys } from '../lib/useArrowKeys'
import QuestionNavigator from './QuestionNavigator'
import { FlagIcon, LockIcon } from './Icons'

export default function TakeTest({ test, profile, onDone }) {
  const [attempt, setAttempt] = useState(null)
  // Javoblar va belgilar ASL savol indeksi (qi) bo'yicha saqlanadi, aralashtirilgan bo'lsa ham
  const [answers, setAnswers] = useState({})
  const [flags, setFlags] = useState({})
  const [current, setCurrent] = useState(0) // ko'rsatilayotgan o'rin (0 dan)
  const [remaining, setRemaining] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showNav, setShowNav] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [warnDismissed, setWarnDismissed] = useState(false)
  const submittedRef = useRef(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  // Blok: talaba test oynasidan chiqsa, ustoz ruxsat bergunicha test bloklanadi
  const [lock, setLock] = useState(null)
  const [warn, setWarn] = useState(false) // "Avtomatik ruxsat" yoqilgan bo'lsa: faqat ogohlantirish
  const lockRef = useRef(null)
  lockRef.current = lock
  const answersRef = useRef({})
  answersRef.current = answers

  const questions = test.questions_json
  const draftKey = attempt ? `draft:${attempt.id}` : null

  // Savollar tartibi (aralashtirish yoqilgan bo'lsa, har bir urinish uchun o'ziga xos, lekin barqaror)
  const plan = useMemo(
    () => (attempt ? buildPlan(questions, !!test.shuffle, attempt.id) : []),
    [attempt, questions, test.shuffle]
  )

  // Chap / o'ng strelka tugmalari bilan savollar orasida yurish
  useArrowKeys({
    enabled: !showNav && !showSubmit,
    onLeft: () => setCurrent((c) => Math.max(0, c - 1)),
    onRight: () => setCurrent((c) => Math.min(questions.length - 1, c + 1))
  })

  // Test paytida boshqa oynaga/yorliqqa o'tilsa, blok qo'yiladi
  useFocusGuard({
    enabled: !!attempt && !lock && !warn && !submitting,
    onViolation: (reason) => reportViolation(reason)
  })

  // Sahifa yangilansa yoki boshqa qurilmadan kirilsa ham, hal qilinmagan blok saqlanib qoladi
  useEffect(() => {
    if (!attempt) return
    supabase
      .from('violations')
      .select('*')
      .eq('attempt_id', attempt.id)
      .eq('status', 'open')
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLock(data)
      })
  }, [attempt?.id])

  // Blok paytida ustoz qarorini kutamiz (har 3 soniyada tekshiriladi)
  useEffect(() => {
    if (!lock?.id || lock.status !== 'open') return undefined
    const timer = setInterval(async () => {
      const { data } = await supabase.from('violations').select('*').eq('id', lock.id).maybeSingle()
      if (!data || data.status === 'open') return
      if (data.status === 'resumed') {
        // Ustoz vaqtni qaytargan: yangilangan boshlanish vaqtini olamiz
        const { data: fresh } = await supabase.from('attempts').select('*').eq('id', attempt.id).single()
        if (fresh) setAttempt(fresh)
        setLock(null)
      } else {
        setLock(data)
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [lock?.id, lock?.status])

  async function reportViolation(reason) {
    if (lockRef.current || submittedRef.current || !attempt) return
    const pending = { id: null, status: 'open', pending: true }
    lockRef.current = pending
    setLock(pending) // ekran darrov yopiladi

    // Ustoz "Avtomatik ruxsat" ni yoqqan bo'lsa: blok yo'q, faqat ogohlantirish ko'rsatiladi
    const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'auto_allow').maybeSingle()
    if (setting?.value === 'true') {
      lockRef.current = null
      setLock(null)
      setWarn(true)
      return
    }
    const { data, error: insErr } = await supabase
      .from('violations')
      .insert({
        attempt_id: attempt.id,
        student_id: profile.id,
        reason,
        answers: answersRef.current
      })
      .select()
      .single()
    if (!insErr) {
      setLock(data)
      return
    }
    // Shu urinish uchun ochiq blok allaqachon bo'lishi mumkin
    const { data: existing } = await supabase
      .from('violations')
      .select('*')
      .eq('attempt_id', attempt.id)
      .eq('status', 'open')
      .maybeSingle()
    if (existing) {
      setLock(existing)
    } else {
      // Jadval yo'q (migration_v6.sql ishga tushirilmagan) yoki tarmoq xatosi: testni to'xtatmaymiz
      console.warn('Blokni saqlab bo\'lmadi:', insErr.message)
      lockRef.current = null
      setLock(null)
    }
  }

  useEffect(() => {
    initAttempt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Qoralama: javoblar telefon/brauzer yangilansa ham yo'qolmasligi uchun shu qurilmada saqlanadi
  useEffect(() => {
    if (!draftKey) return
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const d = JSON.parse(raw)
        if (d.answers) setAnswers(d.answers)
        if (d.flags) setFlags(d.flags)
        if (Number.isInteger(d.current)) setCurrent(Math.min(d.current, questions.length - 1))
      }
    } catch (_) {
      // qoralama o'qilmasa, e'tiborsiz qoldiramiz
    }
    setDraftLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  useEffect(() => {
    if (!draftKey || !draftLoaded) return
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers, flags, current }))
    } catch (_) {
      // xotira to'la bo'lsa, e'tiborsiz qoldiramiz
    }
  }, [answers, flags, current, draftKey, draftLoaded])

  useEffect(() => {
    if (!attempt) return
    const tick = () => {
      const startedAt = new Date(attempt.started_at).getTime()
      const elapsedSec = (Date.now() - startedAt) / 1000
      const remainingSec = Math.max(0, test.duration_minutes * 60 - elapsedSec)
      setRemaining(remainingSec)
      if (remainingSec <= 0 && !submittedRef.current && !lockRef.current) {
        submittedRef.current = true
        doSubmit()
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  async function initAttempt() {
    setLoading(true)
    setError('')
    const { data: existing, error: findErr } = await supabase
      .from('attempts')
      .select('*')
      .eq('student_id', profile.id)
      .eq('test_id', test.id)
      .eq('status', 'in_progress')
      .maybeSingle()

    if (findErr) {
      setError('Urinishni yuklashda xatolik: ' + findErr.message)
      setLoading(false)
      return
    }

    if (existing) {
      setAttempt(existing)
      setLoading(false)
      return
    }

    const { data: created, error: createErr } = await supabase
      .from('attempts')
      .insert({
        student_id: profile.id,
        test_id: test.id,
        started_at: new Date().toISOString(),
        status: 'in_progress',
        total_questions: questions.length
      })
      .select()
      .single()

    if (createErr) {
      setError('Testni boshlashda xatolik: ' + createErr.message)
      setLoading(false)
      return
    }
    setAttempt(created)
    setLoading(false)
  }

  function setAnswer(qi, value) {
    setAnswers((prev) => ({ ...prev, [qi]: value }))
  }

  function toggleFlag(qi) {
    setFlags((prev) => {
      const next = { ...prev }
      if (next[qi]) delete next[qi]
      else next[qi] = true
      return next
    })
  }

  async function doSubmit() {
    if (!attempt || submitting) return
    setSubmitting(true)
    setError('')

    const { rows, score, status } = gradeAnswers(questions, answers, attempt.id)

    const { error: ansErr } = await supabase.from('answers').insert(rows)
    if (ansErr) {
      setError('Testni topshirishda xatolik: ' + ansErr.message)
      setSubmitting(false)
      submittedRef.current = false
      return
    }

    const { error: updErr } = await supabase
      .from('attempts')
      .update({ submitted_at: new Date().toISOString(), score, status })
      .eq('id', attempt.id)

    setSubmitting(false)
    if (updErr) {
      setError('Topshirishni yakunlashda xatolik: ' + updErr.message)
      return
    }
    try {
      localStorage.removeItem(draftKey)
    } catch (_) {
      // e'tiborsiz
    }
    onDone()
  }

  if (loading) return <p>Test yuklanmoqda...</p>
  if (error && !attempt) return <div className="error">{error}</div>
  if (!attempt || plan.length === 0) return null

  if (warn) {
    return (
      <div className="lock-screen" role="alert">
        <div className="lock-card">
          <div className="lock-icon lock-icon-warn">
            <LockIcon />
          </div>
          <h2>Ogohlantirish</h2>
          <p>
            Test paytida boshqa oyna, yorliq yoki ilovaga o'tmang! Bu qoidabuzarlik hisoblanadi va keyingi safar test
            bloklanishi mumkin.
          </p>
          <button onClick={() => setWarn(false)}>Tushunarli, testni davom ettiraman</button>
        </div>
      </div>
    )
  }

  if (lock) {
    const finished = lock.status === 'finished'
    return (
      <div className="lock-screen" role="alert">
        <div className="lock-card">
          <div className="lock-icon">
            <LockIcon />
          </div>
          {lock.pending ? (
            <p className="muted">Tekshirilmoqda...</p>
          ) : finished ? (
            <>
              <h2>Test yakunlandi</h2>
              <p>Ustoz testingizni yakunladi. Natijangizni "Natijalar" bo'limida ko'rasiz.</p>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem(draftKey)
                  } catch (_) {
                    // e'tiborsiz
                  }
                  onDone()
                }}
              >
                Tushunarli
              </button>
            </>
          ) : (
            <>
              <h2>Test bloklandi</h2>
              <p>Siz test oynasidan chiqdingiz (boshqa oyna, yorliq yoki ilovaga o'tdingiz). Bu ustozga bildirildi.</p>
              <p>
                <strong>Davom etish uchun ustozdan ruxsat so'rang.</strong> Ruxsat berilgach, test qolgan joyidan davom
                etadi.
              </p>
              <p className="muted">Bu sahifani yopmang va yangilamang. Javoblaringiz saqlangan.</p>
            </>
          )}
        </div>
      </div>
    )
  }

  const item = plan[current]
  const qi = item.qi
  const q = questions[qi]
  const minutes = remaining !== null ? Math.floor(remaining / 60) : Math.floor(test.duration_minutes)
  const seconds = remaining !== null ? Math.floor(remaining % 60) : 0

  // Oxirgi 5 daqiqa (qisqa testlarda — vaqtning uchdan biri) ogohlantirish
  const warnSec = Math.min(300, Math.floor((test.duration_minutes * 60) / 3))
  const low = remaining !== null && remaining > 0 && remaining <= warnSec

  const unansweredPos = plan.map((p, pos) => (isBlank(answers[p.qi]) ? pos : -1)).filter((x) => x >= 0)
  const flaggedPos = plan.map((p, pos) => (flags[p.qi] ? pos : -1)).filter((x) => x >= 0)

  function goTo(pos) {
    setCurrent(pos)
    setShowSubmit(false)
  }

  function Chips({ list }) {
    const shown = list.slice(0, 40)
    return (
      <div className="chips">
        {shown.map((pos) => (
          <button key={pos} type="button" className="chip chip-btn" onClick={() => goTo(pos)}>
            {pos + 1}
          </button>
        ))}
        {list.length > shown.length && <span className="muted">... va yana {list.length - shown.length} ta</span>}
      </div>
    )
  }

  return (
    <div className="take-test">
      <div className="test-header sticky-head">
        <h2>{test.title}</h2>
        <div className="header-actions">
          <button className="secondary-btn" onClick={() => setShowNav(true)}>
            Barcha savollar
          </button>
          <div className={`timer${low ? ' timer-low' : ''}`}>
            {minutes}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </div>

      {low && !warnDismissed && (
        <div className="banner banner-danger dismissible" role="alert">
          <span>
            Vaqt tugashiga oz qoldi! Javoblaringizni tekshirib, testni topshiring. Vaqt tugasa, test o'zi topshiriladi.
          </span>
          <button className="modal-close" onClick={() => setWarnDismissed(true)} aria-label="Yopish">
            ✕
          </button>
        </div>
      )}
      {error && <div className="error">{error}</div>}

      <div className="q-meta">
        <span>
          Savol {current + 1} / {questions.length}
        </span>
        <button
          type="button"
          className={`flag-btn${flags[qi] ? ' on' : ''}`}
          onClick={() => toggleFlag(qi)}
          aria-pressed={!!flags[qi]}
        >
          <FlagIcon filled={!!flags[qi]} />
          {flags[qi] ? 'Belgi qo‘yilgan' : "Qayta ko'rish uchun belgilash"}
        </button>
      </div>

      <div className="card">
        <p className="question-text">{q.question}</p>
        {q.type === 'mcq' ? (
          <div className="options">
            {item.opts.map((origIdx) => (
              <label key={origIdx} className={`option option-card${answers[qi] === origIdx ? ' selected' : ''}`}>
                <input
                  type="radio"
                  name={`q${qi}`}
                  checked={answers[qi] === origIdx}
                  onChange={() => setAnswer(qi, origIdx)}
                />
                <span className="question-text">{q.options[origIdx]}</span>
              </label>
            ))}
          </div>
        ) : (
          <textarea
            rows={6}
            placeholder="Javobingizni yozing..."
            value={answers[qi] || ''}
            onChange={(e) => setAnswer(qi, e.target.value)}
          />
        )}
      </div>

      <div className="nav-buttons">
        <button className="secondary-btn" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          Oldingi
        </button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent((c) => c + 1)}>Keyingi</button>
        ) : (
          <button className="btn-green" disabled={submitting} onClick={() => setShowSubmit(true)}>
            {submitting ? 'Topshirilmoqda...' : 'Topshirish'}
          </button>
        )}
      </div>

      {showNav && (
        <QuestionNavigator
          total={questions.length}
          current={current}
          mode="test"
          statusOf={(pos) => (isBlank(answers[plan[pos].qi]) ? 'unanswered' : 'answered')}
          flaggedOf={(pos) => !!flags[plan[pos].qi]}
          onSelect={(pos) => {
            setCurrent(pos)
            setShowNav(false)
          }}
          onClose={() => setShowNav(false)}
        />
      )}

      {showSubmit && (
        <div className="modal-backdrop" onClick={() => setShowSubmit(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Testni topshirish</h3>
              <button className="modal-close" onClick={() => setShowSubmit(false)} aria-label="Yopish">
                ✕
              </button>
            </div>
            {unansweredPos.length === 0 && flaggedPos.length === 0 && <p>Barcha savollarga javob berdingiz.</p>}
            {unansweredPos.length > 0 && (
              <div className="confirm-block warn">
                <strong>{unansweredPos.length} ta savolga javob bermadingiz.</strong>
                <Chips list={unansweredPos} />
              </div>
            )}
            {flaggedPos.length > 0 && (
              <div className="confirm-block flag">
                <strong>{flaggedPos.length} ta savol qayta ko'rish uchun belgilangan.</strong>
                <Chips list={flaggedPos} />
              </div>
            )}
            {test.access === 'one_time' && (
              <p className="muted">Bu bir martalik test: topshirgandan keyin uni qayta topshira olmaysiz.</p>
            )}
            <div className="form-actions">
              <button className="secondary-btn" onClick={() => setShowSubmit(false)}>
                Testga qaytish
              </button>
              <button
                className="btn-green"
                disabled={submitting}
                onClick={() => {
                  setShowSubmit(false)
                  doSubmit()
                }}
              >
                {submitting ? 'Topshirilmoqda...' : 'Topshirish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
