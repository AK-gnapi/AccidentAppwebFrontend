import Link from "next/link";

export default function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

  return (
    <div className="mkt-page">
      <header className="mkt-header">
        <div className="mkt-shell">
          <div className="mkt-brand">
            <div className="mkt-logo" aria-hidden="true" />
            <div>
              <div className="mkt-title">GTS</div>
              <div className="mkt-subtitle">Live GPS + Incident Response</div>
            </div>
          </div>
          <nav className="mkt-nav">
            <a className="mkt-navlink" href="#features">
              Features
            </a>
            <a className="mkt-navlink" href="#workflow">
              Workflow
            </a>
            <a className="mkt-navlink" href="#faq">
              FAQ
            </a>
            <Link href="/admin" className="mkt-cta">
              Open Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="mkt-main">
        <section className="mkt-hero">
          <div className="mkt-shell">
            <div className="mkt-heroGrid">
              <div>
                <div className="mkt-pill">
                  Near real-time tracking · Behavior-based incidents
                </div>
                <h1 className="mkt-h1">
                  A fast dashboard for live location tracking and safety alerts.
                </h1>
                <p className="mkt-lead">
                  Users share GPS from mobile or browser. Admin sees everyone live on the map.
                  If behavior indicates a possible accident, a 45-second safety check triggers
                  escalation if the user doesn’t respond.
                </p>

                <div className="mkt-actions">
                  <Link href="/user" className="mkt-primary">
                    Start as User
                  </Link>
                  <Link href="/admin" className="mkt-secondary">
                    View Admin Map
                  </Link>
                </div>

                <div className="mkt-meta">
                  <span className="mkt-metaLabel">Backend</span>
                  <code className="mkt-code">{apiBase}</code>
                </div>
              </div>

              <div className="mkt-preview" aria-hidden="true">
                <div className="mkt-previewTop">
                  <div className="mkt-dot" />
                  <div className="mkt-dot" />
                  <div className="mkt-dot" />
                  <div className="mkt-previewTitle">Live Overview</div>
                </div>
                <div className="mkt-previewBody">
                  <div className="mkt-kpis">
                    <div className="mkt-kpiCard">
                      <div className="mkt-kpiNum">1s</div>
                      <div className="mkt-kpiText">fast update interval</div>
                    </div>
                    <div className="mkt-kpiCard">
                      <div className="mkt-kpiNum">45s</div>
                      <div className="mkt-kpiText">safety confirmation</div>
                    </div>
                    <div className="mkt-kpiCard">
                      <div className="mkt-kpiNum">Live</div>
                      <div className="mkt-kpiText">Socket.IO stream</div>
                    </div>
                  </div>
                  <div className="mkt-miniMap">
                    <div className="mkt-marker m1" />
                    <div className="mkt-marker m2" />
                    <div className="mkt-marker m3" />
                    <div className="mkt-path" />
                  </div>
                  <div className="mkt-previewFooter">
                    Fast users highlighted · Stale users dimmed · Incidents surfaced
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mkt-section">
          <div className="mkt-shell">
            <div className="mkt-sectionHead">
              <h2 className="mkt-h2">Built for coordination</h2>
              <p className="mkt-muted">
                Everything you need for near real-time visibility and incident response.
              </p>
            </div>
            <div className="mkt-grid">
              <div className="mkt-card">
                <h3 className="mkt-h3">User tracking</h3>
                <p className="mkt-muted">
                  Mobile-friendly GPS collection with adaptive upload intervals and accurate
                  speed estimation.
                </p>
              </div>
              <div className="mkt-card">
                <h3 className="mkt-h3">Admin map</h3>
                <p className="mkt-muted">
                  Live map + user list with fast/stale states and incident overlays.
                </p>
              </div>
              <div className="mkt-card">
                <h3 className="mkt-h3">Safety confirmation</h3>
                <p className="mkt-muted">
                  Behavior-based detection triggers a safety check. No response escalates to
                  a confirmed incident.
                </p>
              </div>
              <div className="mkt-card">
                <h3 className="mkt-h3">Hospital suggestions</h3>
                <p className="mkt-muted">
                  Confirmed incidents show nearby hospitals with click-to-call links for
                  rapid action.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="mkt-section">
          <div className="mkt-shell">
            <div className="mkt-sectionHead">
              <h2 className="mkt-h2">Simple workflow</h2>
              <p className="mkt-muted">From GPS sharing to escalation in four steps.</p>
            </div>
            <ol className="mkt-steps">
              <li className="mkt-step">
                <div className="mkt-stepNum">1</div>
                <div>
                  <div className="mkt-stepTitle">User shares location</div>
                  <div className="mkt-muted">Browser/mobile grants GPS permission.</div>
                </div>
              </li>
              <li className="mkt-step">
                <div className="mkt-stepNum">2</div>
                <div>
                  <div className="mkt-stepTitle">Backend computes speed</div>
                  <div className="mkt-muted">Smoothed speed reduces GPS jitter.</div>
                </div>
              </li>
              <li className="mkt-step">
                <div className="mkt-stepNum">3</div>
                <div>
                  <div className="mkt-stepTitle">Admin sees live updates</div>
                  <div className="mkt-muted">
                    Fast users highlighted, stale users dimmed.
                  </div>
                </div>
              </li>
              <li className="mkt-step">
                <div className="mkt-stepNum">4</div>
                <div>
                  <div className="mkt-stepTitle">Safety check + escalation</div>
                  <div className="mkt-muted">
                    Prompt appears; safe/hurt/no response updates the incident.
                  </div>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section id="faq" className="mkt-section">
          <div className="mkt-shell">
            <div className="mkt-sectionHead">
              <h2 className="mkt-h2">FAQ</h2>
              <p className="mkt-muted">Quick answers to common setup questions.</p>
            </div>
            <div className="mkt-faq">
              <details className="mkt-faqItem">
                <summary className="mkt-faqQ">
                  Will this work on phone + laptop on the same Wi‑Fi?
                </summary>
                <div className="mkt-faqA">
                  Yes. Open user on phone using <code className="mkt-code">http://&lt;laptop-ip&gt;:3000/user</code> and admin
                  on laptop at <code className="mkt-code">http://localhost:3000/admin</code>.
                </div>
              </details>
              <details className="mkt-faqItem">
                <summary className="mkt-faqQ">Is the speed threshold configurable?</summary>
                <div className="mkt-faqA">
                  Yes. Set <code className="mkt-code">FAST_SPEED_THRESHOLD_KMH</code> in the backend.
                </div>
              </details>
              <details className="mkt-faqItem">
                <summary className="mkt-faqQ">Do you store location history?</summary>
                <div className="mkt-faqA">
                  Current implementation is live (in-memory). If you want history, we can add a database.
                </div>
              </details>
            </div>

            <div className="mkt-bottomCta">
              <div>
                <div className="mkt-bottomTitle">Try it now</div>
                <div className="mkt-muted">
                  Start tracking on a phone and watch the admin map update live.
                </div>
              </div>
              <div className="mkt-actions">
                <Link href="/user" className="mkt-primary">
                  Start as User
                </Link>
                <Link href="/admin" className="mkt-secondary">
                  Open Dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mkt-footer">
        <div className="mkt-shell">
          <div className="mkt-muted">GTS · Near real-time GPS + incident response</div>
          <div className="mkt-muted">© {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  );
}

