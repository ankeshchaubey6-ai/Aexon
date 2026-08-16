import { ToastProvider } from "../../primitives/Toast/Toast.jsx";

/**
 * Complete landing page shell.
 * Drop Navbar, Hero, Features, CTA, Footer etc. as children.
 */
export function LandingPage({ children, fontClassName = "" }) {
  return (
    <ToastProvider>
      <div className={`min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased ${fontClassName}`}>
        {children}
      </div>
    </ToastProvider>
  );
}
