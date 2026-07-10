import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppSelector } from '../app/hooks'
import { client } from '../api/client'
import { focusRing } from '../components/ui/focusRing'
import { useT } from '../i18n'

interface Overview {
  totalUsers: number
  admins: number
  disabledUsers: number
  bots: number
  totalChannels: number
  totalMessages: number
}

interface AdminUser {
  id: string
  username: string
  email: string
  displayName: string | null
  admin: boolean
  disabled: boolean
  deleted: boolean
  bot: boolean
  createdAt: string
  lastSeenAt: string | null
}

interface AuditEntry {
  id: string
  actor: string
  action: string
  target: string | null
  details: string | null
  createdAt: string
}

interface Page<T> {
  content: T[]
}

export default function AdminPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const me = useAppSelector((state) => state.auth.user)
  const token = useAppSelector((state) => state.auth.token)

  const [overview, setOverview] = useState<Overview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [ov, us, au] = await Promise.all([
        client.get<Overview>('/api/admin/overview'),
        client.get<Page<AdminUser>>('/api/admin/users?size=100'),
        client.get<Page<AuditEntry>>('/api/admin/audit?size=100'),
      ])
      setOverview(ov.data)
      setUsers(us.data.content)
      setAudit(au.data.content)
      setError(null)
    } catch {
      setError(t('admin.loadFailed'))
    }
  }, [t])

  // Hooks must run unconditionally; the access guard is a render-time redirect below.
  useEffect(() => {
    if (me?.admin) load()
  }, [me?.admin, load])

  // While /me is still rehydrating we don't yet know the admin flag — wait.
  if (token && !me) return null
  if (!me?.admin) return <Navigate to="/chat" replace />

  const toggle = async (u: AdminUser, field: 'admin' | 'disabled') => {
    setBusyId(u.id)
    try {
      await client.post(`/api/admin/users/${u.id}/${field}`, { value: !u[field] })
      await load()
    } catch {
      setError(t('admin.actionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-surface text-fg">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡️</span>
          <h1 className="text-base font-semibold tracking-tight">{t('admin.title')}</h1>
        </div>
        <button
          onClick={() => navigate('/chat')}
          className={`rounded-lg px-3 py-1 text-sm text-fg-secondary transition hover:bg-surface-muted ${focusRing}`}
        >
          ← {t('admin.backToChat')}
        </button>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4">
        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
        )}

        {overview && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label={t('admin.statUsers')} value={overview.totalUsers} />
            <Stat label={t('admin.statAdmins')} value={overview.admins} />
            <Stat label={t('admin.statDisabled')} value={overview.disabledUsers} />
            <Stat label={t('admin.statBots')} value={overview.bots} />
            <Stat label={t('admin.statChannels')} value={overview.totalChannels} />
            <Stat label={t('admin.statMessages')} value={overview.totalMessages} />
          </div>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg-secondary">{t('admin.usersTitle')}</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wider text-fg-faint">
                <tr>
                  <th className="px-3 py-2">{t('admin.colUser')}</th>
                  <th className="px-3 py-2">{t('admin.colEmail')}</th>
                  <th className="px-3 py-2">{t('admin.colStatus')}</th>
                  <th className="px-3 py-2 text-right">{t('admin.colAction')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <span className="font-medium">{u.username}</span>
                      {u.admin && <span className="ml-1.5 text-xs text-accent">admin</span>}
                      {u.bot && <span className="ml-1.5 text-xs text-fg-faint">bot</span>}
                    </td>
                    <td className="px-3 py-2 text-fg-secondary">{u.email}</td>
                    <td className="px-3 py-2">
                      {u.deleted ? (
                        <span className="text-xs text-fg-faint">{t('admin.deleted')}</span>
                      ) : u.disabled ? (
                        <span className="text-xs text-danger">{t('admin.disabled')}</span>
                      ) : (
                        <span className="text-xs text-emerald-500">{t('admin.active')}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => toggle(u, 'admin')}
                          disabled={busyId === u.id || u.deleted}
                          className={`rounded-md border border-border px-2 py-1 text-xs transition hover:bg-surface-muted disabled:opacity-40 ${focusRing}`}
                        >
                          {u.admin ? t('admin.revokeAdmin') : t('admin.makeAdmin')}
                        </button>
                        <button
                          onClick={() => toggle(u, 'disabled')}
                          disabled={busyId === u.id || u.deleted}
                          className={`rounded-md border border-border px-2 py-1 text-xs transition hover:bg-surface-muted disabled:opacity-40 ${focusRing}`}
                        >
                          {u.disabled ? t('chat.unblock') : t('chat.block')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg-secondary">{t('admin.auditTitle')}</h2>
          <div className="rounded-xl border border-border">
            {audit.length === 0 ? (
              <p className="px-3 py-3 text-sm text-fg-faint">{t('admin.auditEmpty')}</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>
                      <span className="font-medium">{a.actor}</span>{' '}
                      <span className="text-fg-secondary">{a.action}</span>
                      {a.target && <span className="text-fg-secondary"> → {a.target}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-fg-faint">{new Date(a.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted px-3 py-2">
      <div className="text-xs text-fg-faint">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}
