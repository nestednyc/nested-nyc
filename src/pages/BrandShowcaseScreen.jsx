import { useState } from 'react'
import { LinkedNestsMark, JoinedRingsMark, ThreadedNestMark, Lockup, INK } from '../assets/logos/LogoConcepts'

/**
 * BrandShowcaseScreen - Internal logo concept gallery at /brand
 *
 * Direction: intertwined / connected / nested — interlocking marks
 * with true over-under weave. A live palette switcher recolors every
 * mark at once; each concept is tested at favicon sizes, in a navbar
 * replica, on dark, and as an app icon.
 *
 * Temporary page — pick a winner + color and it gets wired into
 * favicon, navbar, and splash.
 */

const GRAY_600 = '#6B7280'
const GRAY_400 = '#9CA3AF'
const BORDER = '#E5E7EB'

/** Palette candidates — primary for light bg, light for dark bg */
const PALETTES = [
  { name: 'Deep green', primary: '#1B7A4E', light: '#6EE7A8' },
  { name: 'Burnt orange', primary: '#E2552C', light: '#FDBA74' },
  { name: 'Teal', primary: '#0D9488', light: '#5EEAD4' },
  { name: 'Ink', primary: '#111827', light: '#D1D5DB' },
  { name: 'Indigo', primary: '#5B4AE6', light: '#A5B4FC' },
]

function BrandShowcaseScreen() {
  const [palette, setPalette] = useState(PALETTES[0])

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '56px 24px 80px' }}>
        {/* Page header */}
        <p style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: palette.primary, margin: 0 }}>
          Brand exploration · round 2
        </p>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: INK, margin: '8px 0 4px', letterSpacing: '-0.02em' }}>
          Nested — intertwined concepts
        </h1>
        <p style={{ fontSize: '15px', color: GRAY_600, margin: '0 0 24px', maxWidth: '560px', lineHeight: 1.6 }}>
          Interlocking marks with true over-under weave — connection made literal.
          Use the swatches to recolor everything live.
        </p>

        {/* Color switcher */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px',
          padding: '14px 18px', background: '#FFFFFF', border: `1px solid ${BORDER}`,
          borderRadius: '14px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: GRAY_400 }}>
            Color
          </span>
          {PALETTES.map(p => (
            <button
              key={p.name}
              onClick={() => setPalette(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 12px', borderRadius: '999px', cursor: 'pointer',
                border: p.name === palette.name ? `2px solid ${p.primary}` : `1px solid ${BORDER}`,
                background: p.name === palette.name ? '#FFFFFF' : '#FAFAFA',
                fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                color: p.name === palette.name ? INK : GRAY_600,
              }}
            >
              <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: p.primary, display: 'inline-block' }} />
              {p.name}
            </button>
          ))}
        </div>

        <ConceptSection
          letter="D"
          name="Linked Nests"
          rationale="Two rounded-square nests interlocked like chain links, woven over-under. Containment and connection in a single mark — partnership between equals. Pure geometry, redrawable from memory, holds at 16px."
          Mark={LinkedNestsMark}
          palette={palette}
        />

        <ConceptSection
          letter="E"
          name="Joined Rings"
          recommended
          rationale="Two rings interlocked, a dot nested in the shared space — two students connect, and what they build lives in the overlap. The dot gives it the 'something inside' nested read; the weave gives it the intertwined read."
          Mark={JoinedRingsMark}
          palette={palette}
        />

        <ConceptSection
          letter="F"
          name="Threaded Nest"
          rationale="A ring threading through the nest — a person woven into the structure. The most literal 'intertwined + nested' composition, and the most distinctive silhouette of the three."
          Mark={ThreadedNestMark}
          palette={palette}
        />

        {/* Footer note */}
        <div style={{
          marginTop: '48px', padding: '20px 24px', borderRadius: '16px',
          background: '#F3F4F6', border: `1px solid ${BORDER}`,
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: 1.6 }}>
            <strong>Next step:</strong> pick a winner + color and it gets wired into the
            favicon, the navbar (replacing the text-only NESTED), and the splash screen.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Labeled preview tile */
function Tile({ label, dark, span, children }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: GRAY_400, margin: '0 0 8px' }}>
        {label}
      </p>
      <div style={{
        background: dark ? INK : '#FAFAFA',
        border: dark ? 'none' : `1px solid ${BORDER}`,
        borderRadius: '14px', padding: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '96px',
      }}>
        {children}
      </div>
    </div>
  )
}

/** Replica of the real WebLayout header bar */
function NavbarSim({ accent, children }) {
  return (
    <div style={{
      width: '100%', background: '#FFFFFF', border: `1px solid ${BORDER}`,
      borderRadius: '12px', height: '60px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 20px',
    }}>
      {children}
      <div style={{ display: 'flex', gap: '24px', fontSize: '14px', fontWeight: 500, color: GRAY_600 }}>
        <span style={{ color: accent }}>Discover</span>
        <span>Events</span>
        <span>My Projects</span>
      </div>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        background: 'linear-gradient(135deg, #E5E7EB, #9CA3AF)',
      }} />
    </div>
  )
}

/** iOS-style app icon tile */
function AppIcon({ bg, children }) {
  return (
    <div style={{
      width: '72px', height: '72px', borderRadius: '18px', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: bg === '#FFFFFF' ? `1px solid ${BORDER}` : 'none',
      boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
    }}>
      {children}
    </div>
  )
}

const FAVICON_SIZES = [16, 24, 32, 64]

/** Full preview section for one concept */
function ConceptSection({ letter, name, recommended, rationale, Mark, palette }) {
  const { primary, light } = palette
  return (
    <section style={{
      background: '#FFFFFF', borderRadius: '20px', border: `1px solid ${BORDER}`,
      padding: '32px', marginBottom: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
        <span style={{
          fontSize: '13px', fontWeight: 700, color: '#FFFFFF', background: INK,
          borderRadius: '6px', padding: '2px 8px',
        }}>
          {letter}
        </span>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: INK, margin: 0, letterSpacing: '-0.01em' }}>
          {name}
        </h2>
        {recommended && (
          <span style={{
            fontSize: '12px', fontWeight: 600, color: primary, background: '#F3F4F6',
            borderRadius: '999px', padding: '3px 10px',
          }}>
            Recommended
          </span>
        )}
      </div>
      <p style={{ fontSize: '14px', color: GRAY_600, margin: '0 0 28px', maxWidth: '640px', lineHeight: 1.6 }}>
        {rationale}
      </p>

      {/* Hero lockup */}
      <div style={{
        background: '#FAFAFA', border: `1px solid ${BORDER}`, borderRadius: '14px',
        padding: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '20px',
      }}>
        <Lockup Mark={Mark} markSize={56} textHeight={44} color={primary} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '20px' }}>
        {/* Favicon strip — the brutal small-size test */}
        <Tile label="Favicon strip · 16 / 24 / 32 / 64">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
            {FAVICON_SIZES.map(s => (
              <div key={s} style={{ textAlign: 'center' }}>
                <Mark size={s} color={primary} />
                <p style={{ fontSize: '10px', color: GRAY_400, margin: '6px 0 0' }}>{s}px</p>
              </div>
            ))}
          </div>
        </Tile>

        {/* Dark inversion */}
        <Tile label="On dark" dark>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <Mark size={40} color="#FFFFFF" />
            <Lockup Mark={Mark} markSize={28} textHeight={22} color={light} ink="#FFFFFF" />
          </div>
        </Tile>
      </div>

      {/* Navbar simulation */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: GRAY_400, margin: '0 0 8px' }}>
          Navbar
        </p>
        <NavbarSim accent={primary}>
          <Lockup Mark={Mark} markSize={26} textHeight={19} color={primary} />
        </NavbarSim>
      </div>

      {/* App icons */}
      <Tile label="App icon" span={2}>
        <div style={{ display: 'flex', gap: '24px' }}>
          <AppIcon bg={primary}><Mark size={42} color="#FFFFFF" /></AppIcon>
          <AppIcon bg="#FFFFFF"><Mark size={42} color={primary} /></AppIcon>
          <AppIcon bg={INK}><Mark size={42} color={light} /></AppIcon>
        </div>
      </Tile>
    </section>
  )
}

export default BrandShowcaseScreen
