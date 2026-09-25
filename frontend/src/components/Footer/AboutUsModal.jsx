import { useState, useEffect } from "react";
import classes from "./AboutUsModal.module.css";

export default function AboutUsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("creators"); // "creators" | "faqs" | "guidelines"

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={classes.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
    >
      <div className={classes.modalCard}>
        {/* Header */}
        <div className={classes.modalHeader}>
          <div className={classes.headerInfo}>
            <span className={classes.brandPill}>&gt;_ GETPYQ JEC</span>
            <h2 id="about-modal-title" className={classes.modalTitle}>
              About GETPYQ JEC
            </h2>
            <p className={classes.modalSubtitle}>
              An open-source, student-led academic initiative for Jabalpur Engineering College.
            </p>
          </div>
          <button
            type="button"
            id="about-modal-close"
            className={classes.closeBtn}
            onClick={onClose}
            aria-label="Close About Us dialog"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={classes.tabsBar} role="tablist">
          <button
            type="button"
            id="tab-creators"
            role="tab"
            aria-selected={activeTab === "creators"}
            className={`${classes.tabBtn} ${activeTab === "creators" ? classes.activeTab : ""}`}
            onClick={() => setActiveTab("creators")}
          >
            <span>👨‍💻 The Creators</span>
          </button>
          <button
            type="button"
            id="tab-faqs"
            role="tab"
            aria-selected={activeTab === "faqs"}
            className={`${classes.tabBtn} ${activeTab === "faqs" ? classes.activeTab : ""}`}
            onClick={() => setActiveTab("faqs")}
          >
            <span>💡 FAQs</span>
          </button>
          <button
            type="button"
            id="tab-guidelines"
            role="tab"
            aria-selected={activeTab === "guidelines"}
            className={`${classes.tabBtn} ${activeTab === "guidelines" ? classes.activeTab : ""}`}
            onClick={() => setActiveTab("guidelines")}
          >
            <span>📋 Upload Guidelines</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className={classes.modalBody}>
          {/* Creators Tab */}
          {activeTab === "creators" && (
            <div className={classes.creatorsSection}>
              <p className={classes.creatorsIntro}>
                GETPYQ JEC was conceived and developed by students from Jabalpur Engineering
                College to solve a common problem: question papers scattered across chaotic
                WhatsApp groups and lost drives. This platform is 100% free, community-driven, and
                open-source.
              </p>

              <div className={classes.creatorsGrid}>
                {/* Abhinav Shrivas */}
                <div className={classes.creatorCard}>
                  <div className={classes.creatorHeader}>
                    <div className={classes.creatorAvatar}>AS</div>
                    <div className={classes.creatorDetails}>
                      <h3 className={classes.creatorName}>Abhinav Shrivas</h3>
                      <span className={classes.creatorRole}>Co-Founder & Developer</span>
                      <span className={classes.creatorDept}>
                        Information Technology • JEC
                      </span>
                    </div>
                  </div>
                  <div className={classes.creatorLinks}>
                    <a
                      href="https://github.com/Abhinav-Shrivas"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={classes.profileBtn}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      GitHub Profile
                    </a>
                  </div>
                </div>

                {/* Hardik Gaikwad */}
                <div className={classes.creatorCard}>
                  <div className={classes.creatorHeader}>
                    <div className={classes.creatorAvatar}>HG</div>
                    <div className={classes.creatorDetails}>
                      <h3 className={classes.creatorName}>Hardik Gaikwad</h3>
                      <span className={classes.creatorRole}>Co-Founder & Developer</span>
                      <span className={classes.creatorDept}>
                        Information Technology • JEC
                      </span>
                    </div>
                  </div>
                  <div className={classes.creatorLinks}>
                    <a
                      href="https://github.com/hardikgaikwad"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={classes.profileBtn}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      GitHub Profile
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FAQs Tab */}
          {activeTab === "faqs" && (
            <div className={classes.faqSection}>
              <div className={classes.faqItem}>
                <h4 className={classes.faqQuestion}>
                  <span className={classes.faqQuestionMark}>Q.</span> Why is Student ID
                  Verification needed to upload?
                </h4>
                <p className={classes.faqAnswer}>
                  To prevent spam, low-quality scans, or malicious files, only verified Jabalpur
                  Engineering College students are authorized to upload question papers. You only
                  need to verify your college ID once for lifetime upload privileges.
                </p>
              </div>

              <div className={classes.faqItem}>
                <h4 className={classes.faqQuestion}>
                  <span className={classes.faqQuestionMark}>Q.</span> What should I do if a subject
                  is not listed in the dropdown?
                </h4>
                <p className={classes.faqAnswer}>
                  If you have a past curriculum paper or elective subject not currently present in
                  the dropdown, you can submit an &quot;Add Unlisted Subject&quot; request directly from
                  the Upload page. Once an admin reviews it, the subject is added to the curriculum
                  dropdown for everyone.
                </p>
              </div>

              <div className={classes.faqItem}>
                <h4 className={classes.faqQuestion}>
                  <span className={classes.faqQuestionMark}>Q.</span> Do I need an account to
                  download question papers?
                </h4>
                <p className={classes.faqAnswer}>
                  No! Browsing and downloading previous years&apos; question papers is 100% free and
                  open to all students without needing any sign-in or account.
                </p>
              </div>

              <div className={classes.faqItem}>
                <h4 className={classes.faqQuestion}>
                  <span className={classes.faqQuestionMark}>Q.</span> How are files stored and
                  served?
                </h4>
                <p className={classes.faqAnswer}>
                  Uploaded PDF question papers are securely hosted on Cloudflare R2 object storage
                  backed by global CDN edge caching, ensuring instant, zero-lag downloads.
                </p>
              </div>

              <div className={classes.faqItem}>
                <h4 className={classes.faqQuestion}>
                  <span className={classes.faqQuestionMark}>Q.</span> Is this platform officially
                  part of the JEC administration?
                </h4>
                <p className={classes.faqAnswer}>
                  No. GETPYQ JEC is an independent, student-run community project built by JEC
                  students for fellow students. It is not managed by or affiliated with college
                  administrative authorities.
                </p>
              </div>
            </div>
          )}

          {/* Guidelines Tab */}
          {activeTab === "guidelines" && (
            <div className={classes.guidelinesSection}>
              <div className={classes.guidelinesNotice}>
                <strong>Quality First:</strong> High-quality archives ensure students preparing for
                exams can read every formula, diagram, and question clearly. Please review these
                simple rules before uploading.
              </div>

              <div className={classes.guidelinesCards}>
                {/* Do's */}
                <div className={`${classes.rulesCard} ${classes.rulesCardDos}`}>
                  <div className={`${classes.rulesCardHeader} ${classes.dosHeader}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Recommended (Do&apos;s)</span>
                  </div>
                  <ul className={classes.rulesList}>
                    <li>Upload documents formatted as a clear, single PDF.</li>
                    <li>Use scanning apps (like Adobe Scan) with good natural lighting.</li>
                    <li>Ensure all pages are sequential and complete (Page 1 to the end).</li>
                    <li>Verify the subject code and examination year match the paper header.</li>
                    <li>Check that all text, diagrams, and formulas are fully legible.</li>
                  </ul>
                </div>

                {/* Don'ts */}
                <div className={`${classes.rulesCard} ${classes.rulesCardDonts}`}>
                  <div className={`${classes.rulesCardHeader} ${classes.dontsHeader}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span>Avoid (Don&apos;ts)</span>
                  </div>
                  <ul className={classes.rulesList}>
                    <li>Do not upload blurry, shadowed, or unreadable camera photos.</li>
                    <li>Do not upload personal notes, assignment sheets, or syllabi.</li>
                    <li>Do not upload papers stamped with heavy third-party coaching watermarks.</li>
                    <li>Do not upload duplicate papers that already exist in the archive.</li>
                    <li>Do not upload question papers from non-JEC universities or colleges.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
