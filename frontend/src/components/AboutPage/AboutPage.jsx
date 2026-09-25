import { useState } from "react";
import { Link } from "react-router-dom";
import classes from "./AboutPage.module.css";

const FAQS = [
  {
    id: "what-is-getpyq",
    question: "What is GETPYQJEC and who can use it?",
    answer:
      "GETPYQJEC is a centralized previous year question paper archive built exclusively for students of Jabalpur Engineering College (JEC). It covers all engineering branches across semesters 1 to 8. Anyone can search, view, and download question papers completely free without needing to sign up or create an account.",
  },
  {
    id: "upload-guidelines",
    question: "What are the guidelines for uploading a question paper?",
    // Important guidelines only, presented in a crisp, high-impact bulleted format
    isGuidelines: true,
    guidelines: [
      {
        title: "Complete & In Order",
        desc: "Ensure all pages and questions of the exam paper are included in consecutive order.",
      },
      {
        title: "Clear & Legible",
        desc: "Upload well-lit, upright, and readable scans or photos. Avoid blurry, cropped, or shadow-covered images.",
      },
      {
        title: "Accepted Formats & Size",
        desc: "Upload a clean single PDF or crisp page images. Keep file size under respective constraint.",
      },
      {
        title: "Accurate Information",
        desc: "Select the correct semester, branch, subject name, subject code, and exam year/session.",
      },
      {
        title: "Official Semester Papers Only",
        desc: "Only official university end-semester exam question papers are accepted. Please do not upload mid-term tests or class notes.",
      },
    ],
  },
  {
    id: "student-verification",
    question: "Why is student verification required to upload papers?",
    answer:
      "To protect the repository from spam, duplicate files, and incorrect question papers, upload privileges are restricted to verified JEC students. Verification is quick and simple: just upload a clear photo of your official College ID card on the verification page. Once verified by an admin, you can contribute papers anytime.",
  },
  {
    id: "how-to-search",
    question: "How do I find and download question papers?",
    answer:
      "On the home page, select your semester and branch. The subject dropdown will automatically populate with the relevant curriculum subjects. Optionally select a specific exam year, then click 'Submit' to immediately access and download the papers.",
  },
  {
    id: "missing-subject",
    question: "What if my subject is not listed in the curriculum dropdown?",
    answer:
      "If you have an exam paper for a new elective or revised syllabus subject that is not listed, you can submit an 'Unlisted Subject' request during upload. Our team reviews the request and adds it to the catalog.",
  },
  {
    id: "is-it-free",
    question: "Is GETPYQJEC free to use?",
    answer:
      "Yes, 100% free forever. GETPYQJEC is an independent student community initiative. There are zero paywalls, no hidden subscriptions, and no advertisements.",
  },
  {
    id: "contact-support",
    question: "How do I report an incorrect paper or contact the team?",
    answer:
      "If you find an incorrectly tagged paper, duplicate upload, or a broken file, please email us directly at getpyqjec@gmail.com with the subject name, branch, semester and paper year. We will try to resolve the issue as soon as possible.",
  },
];

export default function AboutPage() {
  // Track open FAQ accordion index (null = all collapsed, or number = open item)
  const [openFaqId, setOpenFaqId] = useState("what-is-getpyq");

  const toggleFaq = (id) => {
    setOpenFaqId((prev) => (prev === id ? null : id));
  };

  return (
    <div className={classes.aboutPage}>
      <div className={classes.container}>
        {/* Header Section */}
        <header className={classes.header}>
          <h1 className={classes.title}>About GETPYQJEC</h1>
          <p className={classes.subtitle}>
            An independent, student-curated academic archive dedicated to Jabalpur Engineering College.
          </p>
        </header>

        {/* Section 1: Description of Website */}
        <section className={classes.overviewCard} aria-labelledby="about-overview-title">
          <h2 id="about-overview-title" className={classes.sectionTitle}>
            Our Mission &amp; Purpose
          </h2>

          <div className={classes.overviewBody}>
            <p className={classes.paragraph}>
              <strong>GETPYQJEC</strong> was created to solve a problem every engineering student at
              Jabalpur Engineering College faces each semester: the chaotic scramble for previous year question papers.
            </p>
            <p className={classes.paragraph}>
              For years, exam papers were locked behind paid photocopies that too of low quality,
              unorganized WhatsApp groups, and expired Google Drive links. We built <strong>GETPYQJEC</strong> to
              replace that chaos with a single, lightning-fast, and community-driven digital library where students
              can not only search and download past papers, but also directly upload and contribute question papers
              after exams to help classmates and upcoming batches.
            </p>
            <p className={classes.paragraph}>
              By enabling verified students to upload and share exam papers semester after semester, <strong>GETPYQJEC</strong> turns
              individual efforts into a collective, ever-growing academic repository that remains accessible to everyone, completely free.
            </p>
          </div>

          {/* Pillars Grid */}
          <div className={classes.pillarsGrid}>
            <div className={classes.pillarItem}>
              <div className={classes.pillarIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <h3 className={classes.pillarTitle}>Structured Curriculum</h3>
              <p className={classes.pillarDesc}>
                Papers categorized strictly by official JEC branches, semesters, and course codes.
              </p>
            </div>

            <div className={classes.pillarItem}>
              <div className={classes.pillarIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3 className={classes.pillarTitle}>Student PYQ Uploads</h3>
              <p className={classes.pillarDesc}>
                Verified students can directly upload semester papers to expand the catalog for all branches.
              </p>
            </div>

            <div className={classes.pillarItem}>
              <div className={classes.pillarIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <h3 className={classes.pillarTitle}>100% Free &amp; Open</h3>
              <p className={classes.pillarDesc}>
                Zero subscription fees, zero advertisements, and zero paywalls for the student community.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Contributors */}
        <section className={classes.contributorsSection} aria-labelledby="about-contributors-title">
          <div className={classes.contributorsHeader}>
            <h2 id="about-contributors-title" className={classes.contributorsTitle}>
              Contributors
            </h2>
          </div>

          <div className={classes.contributorsGrid}>
            {/* Contributor 1: Abhinav Shrivas */}
            <div className={classes.contributorCard}>
              <div className={classes.avatarCircle}>A</div>
              <h3 className={classes.contributorName}>Abhinav Shrivas</h3>
              <span className={classes.contributorBranch}>Information Technology</span>
              <span className={classes.contributorSem}>7th Semester</span>
              <a
                href="https://www.linkedin.com/in/abhinav-shrivas"
                target="_blank"
                rel="noopener noreferrer"
                className={classes.linkedinBtn}
                aria-label="Abhinav Shrivas LinkedIn"
              >
                <svg className={classes.linkedinIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
                <span>LinkedIn</span>
              </a>
            </div>

            {/* Contributor 2: Hardik Gaikwad */}
            <div className={classes.contributorCard}>
              <div className={classes.avatarCircle}>H</div>
              <h3 className={classes.contributorName}>Hardik Gaikwad</h3>
              <span className={classes.contributorBranch}>Information Technology</span>
              <span className={classes.contributorSem}>7th Semester</span>
              <a
                href="https://www.linkedin.com/in/hardikgaikwad/"
                target="_blank"
                rel="noopener noreferrer"
                className={classes.linkedinBtn}
                aria-label="Hardik Gaikwad LinkedIn"
              >
                <svg className={classes.linkedinIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
                <span>LinkedIn</span>
              </a>
            </div>
          </div>
        </section>

        {/* Section 3: Frequently Asked Questions (Accordion) */}
        <section className={classes.faqSection} aria-labelledby="about-faqs-title">
          <div className={classes.faqHeader}>
            <h2 id="about-faqs-title" className={classes.sectionTitle}>
              Frequently Asked Questions
            </h2>
            <p className={classes.faqSubtitle}>
              Find answers to common questions about downloading, student verification, and uploading papers.
            </p>
          </div>

          <div className={classes.accordionList}>
            {FAQS.map((faq) => {
              const isOpen = openFaqId === faq.id;

              return (
                <div
                  key={faq.id}
                  className={`${classes.accordionItem} ${isOpen ? classes.accordionItemOpen : ""}`}
                >
                  <button
                    type="button"
                    className={classes.accordionTrigger}
                    onClick={() => toggleFaq(faq.id)}
                    aria-expanded={isOpen}
                    id={`faq-btn-${faq.id}`}
                  >
                    <span className={classes.faqQuestion}>{faq.question}</span>
                    <span className={`${classes.chevron} ${isOpen ? classes.chevronRotated : ""}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </button>

                  {isOpen && (
                    <div className={classes.accordionContent} id={`faq-content-${faq.id}`}>
                      {faq.isGuidelines ? (
                        <div className={classes.guidelinesContainer}>
                          <p className={classes.guidelinesIntro}>
                            Please follow these essential guidelines before uploading to ensure quick approval:
                          </p>
                          <ul className={classes.guidelinesList}>
                            {faq.guidelines.map((g, idx) => (
                              <li key={idx} className={classes.guidelineItem}>
                                <div className={classes.guidelineNumber}>{idx + 1}</div>
                                <div className={classes.guidelineText}>
                                  <strong>{g.title}:</strong> {g.desc}
                                </div>
                              </li>
                            ))}
                          </ul>
                          <div className={classes.guidelinesAction}>
                            <Link to="/upload" className={classes.guidelineLink}>
                              Ready to contribute? Upload a Paper &rarr;
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <p className={classes.faqAnswer}>{faq.answer}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
