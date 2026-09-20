import { useState, useEffect, useMemo, useCallback } from "react";
import classes from "./UploadHistory.module.css";
import { getAdminUploadHistory, getAdminPYQDownloadUrl } from "../../http";
import { branches, semesters } from "../../information";
import CustomSelect from "../CustomSelect/CustomSelect";


// Helper to format ISO timestamp into a readable date and relative time
function formatDateTime(isoString) {
  if (!isoString) return { formatted: "—", relative: "" };
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return { formatted: isoString, relative: "" };

    const formatted = date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Calculate relative time
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = "";
    if (diffSec < 60) {
      relative = "just now";
    } else if (diffMin < 60) {
      relative = `${diffMin}m ago`;
    } else if (diffHours < 24) {
      relative = `${diffHours}h ago`;
    } else if (diffDays === 1) {
      relative = "yesterday";
    } else if (diffDays < 30) {
      relative = `${diffDays}d ago`;
    } else {
      relative = date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    }

    return { formatted, relative };
  } catch {
    return { formatted: isoString, relative: "" };
  }
}

export default function UploadHistory() {
  // Filter & Sort States
  const [order, setOrder] = useState("recent"); // "recent" or "oldest"
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Data & Pagination States
  const [pyqs, setPyqs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // On-demand PDF fetcher loading state
  const [pdfLoadingId, setPdfLoadingId] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(1); // Reset page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset all filters
  const handleResetFilters = () => {
    setOrder("recent");
    setSelectedBranch("");
    setSelectedSemester("");
    setSelectedYear("");
    setSearchInput("");
    setDebouncedSearch("");
    setCurrentPage(1);
  };

  // Generate Year options: Current year + past 10 years (descending, matching other forms)
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => current - i);
  }, []);

  const sortOptions = useMemo(
    () => [
      { value: "recent", label: "Sort: Most Recent First", triggerLabel: "Sort: Most Recent" },
      { value: "oldest", label: "Sort: Oldest First", triggerLabel: "Sort: Oldest" },
    ],
    []
  );

  const branchOptions = useMemo(
    () => [
      { value: "", label: "All Branches", triggerLabel: "Branch: All" },
      { value: "CommonForAllBranches", label: "Common (Sem 1 & 2)", triggerLabel: "Branch: Common" },
      ...Object.keys(branches).map((code) => ({
        value: code,
        label: `${code} - ${branches[code]}`,
        triggerLabel: `Branch: ${code}`,
      })),
    ],
    []
  );

  const semesterOptions = useMemo(
    () => [
      { value: "", label: "All Semesters", triggerLabel: "Sem: All" },
      ...semesters.map((s) => ({
        value: String(s),
        label: `Semester ${s}`,
        triggerLabel: `Sem: ${s}`,
      })),
    ],
    []
  );

  const yearFilterOptions = useMemo(
    () => [
      { value: "", label: "All Years", triggerLabel: "Year: All" },
      ...yearOptions.map((y) => ({
        value: String(y),
        label: String(y),
        triggerLabel: `Year: ${y}`,
      })),
    ],
    [yearOptions]
  );

  // Fetch Upload History from API
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminUploadHistory({
        order,
        branch: selectedBranch,
        semester: selectedSemester,
        year: selectedYear,
        search: debouncedSearch,
        page: currentPage,
        page_size: 15,
      });

      setPyqs(data.results || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      setError(err.message || "Failed to load upload history.");
      setPyqs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [
    order,
    selectedBranch,
    selectedSemester,
    selectedYear,
    debouncedSearch,
    currentPage,
  ]);


  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Handle On-Demand View PDF
  const handleViewPdf = async (pyq) => {
    if (pdfLoadingId) return;
    setPdfLoadingId(pyq.id);
    try {
      const res = await getAdminPYQDownloadUrl(pyq.id);
      if (res && res.download_url) {
        window.open(res.download_url, "_blank", "noopener,noreferrer");
      } else {
        throw new Error("Download URL not found in response.");
      }
    } catch (err) {
      alert(`Could not open PDF: ${err.message}`);
    } finally {
      setPdfLoadingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / 15));
  const startIdx = totalCount === 0 ? 0 : (currentPage - 1) * 15 + 1;
  const endIdx = Math.min(currentPage * 15, totalCount);

  return (
    <div className={classes.pageContainer}>
      {/* Header */}
      <header className={classes.header}>
        <h1 className={classes.title}>PYQ Upload History</h1>
        <p className={classes.subtitle}>
          Audit and inspect all student-contributed question papers in order of upload
        </p>
      </header>


      {/* Filter & Sort Toolbar */}
      <section className={classes.toolbarCard}>
        <div className={classes.filtersGrid}>
          {/* Sort Order Selector */}
          <CustomSelect
            value={order}
            onChange={(val) => {
              setOrder(val);
              setCurrentPage(1);
            }}
            options={sortOptions}
            className={classes.filterItem}
            triggerClassName={classes.customTrigger}
            dropdownClassName={classes.customDropdown}
          />

          {/* Branch Filter */}
          <CustomSelect
            value={selectedBranch}
            onChange={(val) => {
              setSelectedBranch(val);
              setCurrentPage(1);
            }}
            options={branchOptions}
            className={classes.filterItem}
            triggerClassName={classes.customTrigger}
            dropdownClassName={classes.customDropdown}
          />

          {/* Semester Filter */}
          <CustomSelect
            value={selectedSemester}
            onChange={(val) => {
              setSelectedSemester(val);
              setCurrentPage(1);
            }}
            options={semesterOptions}
            className={classes.filterItem}
            triggerClassName={classes.customTrigger}
            dropdownClassName={classes.customDropdown}
          />

          {/* Year Filter */}
          <CustomSelect
            value={selectedYear}
            onChange={(val) => {
              setSelectedYear(val);
              setCurrentPage(1);
            }}
            options={yearFilterOptions}
            className={classes.filterItem}
            triggerClassName={classes.customTrigger}
            dropdownClassName={classes.customDropdown}
          />

          {/* Roll No / Subject Search Bar */}
          <div className={classes.searchWrapper}>
            <svg className={classes.searchIcon} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className={classes.searchInput}
              placeholder="Search Roll No, Subject Name, or Code..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search roll number, subject name, or code"
            />
          </div>

          {/* Reset Filters */}
          {(order !== "recent" || selectedBranch || selectedSemester || selectedYear || searchInput) && (
            <button
              type="button"
              className={classes.resetBtn}
              onClick={handleResetFilters}
              title="Reset all filters"
            >
              ✕ Reset
            </button>
          )}

        </div>
      </section>

      {/* Error Alert */}
      {error && (
        <div className={classes.errorBox}>
          <span>{error}</span>
          <button
            type="button"
            className={classes.dismissBtn}
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Table / Content */}
      {loading ? (
        <div className={classes.loadingBox}>
          <div className={classes.spinner} />
          <span>Loading upload history...</span>
        </div>
      ) : pyqs.length === 0 ? (
        <div className={classes.emptyState}>
          <div className={classes.emptyIcon}>📁</div>
          <p>No uploaded question papers found matching your filters.</p>
        </div>
      ) : (
        <>
          <div className={classes.tableWrapper}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th>Upload Date & Time</th>
                  <th>Branch & Sem</th>
                  <th>Subject</th>
                  <th>Session & Year</th>
                  <th>Uploaded By (Roll No)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pyqs.map((pyq) => {
                  const { formatted, relative } = formatDateTime(pyq.uploaded_at);
                  const isPdfLoading = pdfLoadingId === pyq.id;

                  return (
                    <tr key={pyq.id} className={classes.tableRow}>
                      {/* Date & Time */}
                      <td>
                        <div className={classes.dateCell}>
                          <span className={classes.dateMain}>{formatted}</span>
                          {relative && <span className={classes.dateRelative}>{relative}</span>}
                        </div>
                      </td>

                      {/* Branch & Semester */}
                      <td>
                        <span className={classes.branchBadge}>
                          {pyq.branch} · Sem {pyq.semester}
                        </span>
                      </td>

                      {/* Subject */}
                      <td>
                        <div className={classes.subjectGroup}>
                          <span className={classes.subjectName}>
                            {pyq.subject_name || pyq.subject_code}
                          </span>
                          <span className={classes.codeBadge}>{pyq.subject_code}</span>
                        </div>
                      </td>

                      {/* Session & Year */}
                      <td>
                        <span className={classes.sessionBadge}>
                          {pyq.year} · {pyq.exam_session}
                        </span>
                      </td>

                      {/* Contributor Roll Number Only */}
                      <td>
                        <span className={classes.rnoBadge}>
                          {pyq.uploaded_by_rno || "—"}
                        </span>
                      </td>

                      {/* Action */}
                      <td>
                        <button
                          type="button"
                          className={classes.viewPdfBtn}
                          onClick={() => handleViewPdf(pyq)}
                          disabled={isPdfLoading}
                          title="Generate presigned link & view PDF in new tab"
                        >
                          {isPdfLoading ? (
                            <>
                              <div className={classes.btnSpinner} />
                              <span>Opening...</span>
                            </>
                          ) : (
                            <>
                              <span>View PDF</span>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="7" y1="17" x2="17" y2="7" />
                                <polyline points="7 7 17 7 17 17" />
                              </svg>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Card */}
          <div className={classes.paginationCard}>
            <div className={classes.paginationInfo}>
              Showing {startIdx}–{endIdx} of {totalCount} papers
            </div>

            {totalPages > 1 && (
              <div className={classes.paginationControls}>
                <button
                  type="button"
                  className={classes.pageBtn}
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  ‹
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    // Show current page, first, last, and immediate neighbors
                    return (
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - currentPage) <= 1
                    );
                  })
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const hasGap = prev && p - prev > 1;

                    return (
                      <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        {hasGap && <span style={{ padding: "0 4px", opacity: 0.5 }}>…</span>}
                        <button
                          type="button"
                          className={`${classes.pageBtn} ${currentPage === p ? classes.activePage : ""}`}
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </button>
                      </span>
                    );
                  })}

                <button
                  type="button"
                  className={classes.pageBtn}
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
