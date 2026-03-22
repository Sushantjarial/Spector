import { useState, useEffect, useMemo } from 'react'
import { Search, FileText, AlertCircle, BookOpen, Gavel, Scale, ShieldCheck } from 'lucide-react'

const TABS = [
    { key: 'constitution', label: 'Constitution', icon: Scale, color: '#f59e0b', prefix: 'Art.' },
    { key: 'bns', label: 'BNS', icon: Gavel, color: '#ef4444', prefix: 'Sec.' },
    { key: 'bnss', label: 'BNSS', icon: ShieldCheck, color: '#3b82f6', prefix: 'Sec.' },
    { key: 'bsa', label: 'BSA', icon: FileText, color: '#10b981', prefix: 'Sec.' },
]

export default function Articles() {
    const [activeTab, setActiveTab] = useState('constitution')
    const [constitutionData, setConstitutionData] = useState([])
    const [sectionsData, setSectionsData] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')

    useEffect(() => {
        setLoading(true)
        setError(null)

        Promise.all([
            fetch('/api/articles')
                .then((r) => (r.ok ? r.json() : Promise.reject(`Articles: ${r.status}`)))
                .catch(() => ({ articles: [] })),
            fetch('/api/sections')
                .then((r) => (r.ok ? r.json() : Promise.reject(`Sections: ${r.status}`)))
                .catch(() => ({})),
        ])
            .then(([articlesRes, sectionsRes]) => {
                setConstitutionData(articlesRes.articles || [])
                setSectionsData(sectionsRes || {})
            })
            .catch((err) => setError(String(err)))
            .finally(() => setLoading(false))
    }, [])

    const currentTab = TABS.find((t) => t.key === activeTab)

    const items = useMemo(() => {
        if (activeTab === 'constitution') {
            return constitutionData.map((a) => ({
                id: a.article_no,
                title: a.title,
                status: a.status || 'Active',
                extra: null,
            }))
        }
        const lawData = sectionsData[activeTab]
        if (!lawData) return []
        return (lawData.sections || []).map((s) => ({
            id: s.section_no,
            title: s.title,
            status: 'Active',
            extra: s.chapter_name,
        }))
    }, [activeTab, constitutionData, sectionsData])

    const filtered = useMemo(() => {
        if (!search.trim()) return items
        const q = search.toLowerCase()
        return items.filter(
            (a) =>
                (a.id || '').toLowerCase().includes(q) ||
                (a.title || '').toLowerCase().includes(q) ||
                (a.extra || '').toLowerCase().includes(q)
        )
    }, [items, search])

    return (
        <div className="articles-page">
            {/* ── Header ───────────────────────────────────── */}
            <div className="articles-header">
                <h1>Browse Indian Law</h1>
                <p>Explore all Articles and Sections across the Constitution, BNS, BNSS & BSA.</p>
            </div>

            {/* ── Tabs ───────────────────────────────────────── */}
            <div className="law-tabs">
                {TABS.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.key
                    const count =
                        tab.key === 'constitution'
                            ? constitutionData.length
                            : sectionsData[tab.key]?.total || 0
                    return (
                        <button
                            key={tab.key}
                            className={`law-tab ${isActive ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab(tab.key)
                                setSearch('')
                            }}
                            style={isActive ? { borderColor: tab.color, color: tab.color } : {}}
                        >
                            <Icon size={16} />
                            <span>{tab.label}</span>
                            {count > 0 && <span className="law-tab-count">{count}</span>}
                        </button>
                    )
                })}
            </div>

            {/* ── Toolbar ──────────────────────────────────── */}
            <div className="articles-toolbar">
                <div className="articles-search-box">
                    <Search size={18} />
                    <input
                        id="articles-search"
                        type="text"
                        placeholder={`Search ${currentTab?.label || ''} by number or title...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {!loading && !error && (
                    <div className="articles-count-badge">
                        Showing <strong>{filtered.length}</strong> of {items.length}{' '}
                        {activeTab === 'constitution' ? 'articles' : 'sections'}
                    </div>
                )}
            </div>

            {/* ── Loading Skeletons ────────────────────────── */}
            {loading && (
                <div className="articles-list">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 0.05}s` }} />
                    ))}
                </div>
            )}

            {/* ── Error ────────────────────────────────────── */}
            {error && !loading && (
                <div className="response-section" style={{ maxWidth: 760, margin: '0 auto' }}>
                    <div className="error-card">
                        <AlertCircle size={20} />
                        <div className="error-card-content">
                            <h4>Failed to load data</h4>
                            <p>{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── No data message ─────────────────────────── */}
            {!loading && !error && items.length === 0 && activeTab !== 'constitution' && (
                <div className="empty-state">
                    <FileText size={40} />
                    <h3>No {currentTab?.label} data available</h3>
                    <p>Run <code>python convert_laws.py</code> and <code>python ingest_laws.py</code> to load this data.</p>
                </div>
            )}

            {/* ── Articles / Sections List ────────────────── */}
            {!loading && !error && items.length > 0 && (
                <>
                    {filtered.length === 0 ? (
                        <div className="empty-state">
                            <FileText size={40} />
                            <h3>No results found</h3>
                            <p>Try a different search term.</p>
                        </div>
                    ) : (
                        <div className="articles-list">
                            {filtered.map((item, i) => (
                                <div
                                    key={`${activeTab}-${item.id}-${i}`}
                                    className="article-row animate-fade-in-up"
                                    style={{ animationDelay: `${Math.min(i * 0.03, 0.5)}s`, opacity: 0 }}
                                >
                                    <div
                                        className="article-number"
                                        style={{ color: currentTab?.color || '#f59e0b' }}
                                    >
                                        {currentTab?.prefix} {item.id}
                                    </div>
                                    <div className="article-info">
                                        <div className="article-title">{item.title || 'Untitled'}</div>
                                        {item.extra && (
                                            <div className="article-chapter">{item.extra}</div>
                                        )}
                                    </div>
                                    {activeTab === 'constitution' && (
                                        <span
                                            className={`article-status ${
                                                (item.status || 'Active').toLowerCase() === 'omitted'
                                                    ? 'omitted'
                                                    : 'active'
                                            }`}
                                        >
                                            {item.status || 'Active'}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
