import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Menu as MenuIcon, X } from "lucide-react";
import { IconButton } from "@/components/ui";
import { ContactSheet } from "@/features/contact/ContactSheet";
import { NewEnquiryDialog } from "@/features/intake/NewEnquiryDialog";
import { useContactSheet } from "@/hooks/useContactSheet";
import { cx } from "@/lib/cx";
import { Logo } from "./Logo";
import { ShellContext } from "./ShellContext";
import { Sidebar } from "./Sidebar";
import styles from "./AppShell.module.css";

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const { contactId, close } = useContactSheet();
  const location = useLocation();

  useEffect(() => setNavOpen(false), [location.pathname]);

  const shell = useMemo(() => ({ openIntake: () => setIntakeOpen(true) }), []);

  return (
    <ShellContext.Provider value={shell}>
      <div className={styles.shell}>
        <a href="#main" className={styles.skip}>
          Skip to content
        </a>

        <aside className={cx(styles.sidebar, navOpen && styles.sidebarOpen)} aria-label="Navigation">
          <Sidebar onNavigate={() => setNavOpen(false)} />
        </aside>
        {navOpen && <div className={styles.scrim} onClick={() => setNavOpen(false)} aria-hidden />}

        <div className={styles.main}>
          <header className={styles.mobileBar}>
            <IconButton label={navOpen ? "Close menu" : "Open menu"} onClick={() => setNavOpen((v) => !v)}>
              {navOpen ? <X /> : <MenuIcon />}
            </IconButton>
            <Logo />
            <span className={styles.mobileSpacer} />
          </header>
          <main id="main" className={styles.content} tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>

      <ContactSheet contactId={contactId} onClose={close} />
      <NewEnquiryDialog open={intakeOpen} onClose={() => setIntakeOpen(false)} />
    </ShellContext.Provider>
  );
}
