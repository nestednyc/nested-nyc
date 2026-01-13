/**
 * MobileFrame Component
 * Wraps content in an iPhone-sized frame (390×844) for desktop preview
 * On actual mobile devices, it renders full-screen
 */

function MobileFrame({ children }) {
  return (
    <div className="mobile-frame">
      <div className="mobile-content">
        {children}
      </div>
    </div>
  )
}

export default MobileFrame

