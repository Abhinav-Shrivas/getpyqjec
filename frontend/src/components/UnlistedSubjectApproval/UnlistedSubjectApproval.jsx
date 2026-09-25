import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import classes from "./UnlistedSubjectApproval.module.css";
import {
  getAdminSubjectRequests,
  approveSubjectRequest,
  rejectSubjectRequest,
} from "../../http";
import { branches, semesters } from "../../information";
import CustomSelect from "../CustomSelect/CustomSelect";

// Helper to format ISO timestamp into readable date and relative time
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

const STATUS_TABS = [
  { id: "pending", label: "Pending Review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All Requests" },
];

export default function UnlistedSubjectApproval() {
  // Filters & Search
  const [selectedStatus, setSelectedStatus] = useState("pending");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Data & Pagination
  const [requests, setRequests] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState({ type: "", text: "" });

  // Inline action loading state
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Reject modal state
  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    request: null,
    reason: "",
    isSubmitting: false,
  });

  // Sliding indicator state for segmented control
  const tabRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [indicatorReady, setIndicatorReady] = useState(false);

  const updateIndicator = useCallback(() => {
    const activeEl = tabRefs.current[selectedStatus];
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, [selectedStatus]);

  useEffect(() => {
    updateIndicator();
    const timer = setTimeout(() => setIndicatorReady(true), 40);
    window.addEventListener("resize", updateIndicator);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator]);

  const handleTabChange = (tabId) => {
    setSelectedStatus(tabId);
    setCurrentPage(1);
    const targetEl = tabRefs.current[tabId];
    if (targetEl) {
      setIndicatorStyle({
        left: targetEl.offsetLeft,
        width: targetEl.offsetWidth,
      });
    }
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load subject requests
  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminSubjectRequests({
        status: selectedStatus,
        branch: selectedBranch,
        semester: selectedSemester,
        search: debouncedSearch,
        page: currentPage,
        page_size: 15,
      });

      setRequests(data.results || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.total_pages || 1);

      // Keep pending count accurate if viewing pending
      if (selectedStatus === "pending") {
        setPendingCount(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load subject requests:", err);
      setActionMessage({
        type: "error",
        text: err.message || "Failed to load subject requests. Please refresh.",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedBranch, selectedSemester, debouncedSearch, currentPage]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Separate check for pending count badge if not currently on pending tab
  useEffect(() => {
    if (selectedStatus !== "pending") {
      getAdminSubjectRequests({ status: "pending", page_size: 1 })
        .then((res) => {
          if (res?.total !== undefined) {
            setPendingCount(res.total);
          }
        })
        .catch(() => {});
    }
  }, [selectedStatus]);

  // Reset filters
  const handleResetFilters = () => {
    setSelectedBranch("");
    setSelectedSemester("");
    setSearchInput("");
    setDebouncedSearch("");
    setCurrentPage(1);
  };

  // Approve action
  const handleApprove = async (item) => {
    setActionLoadingId(item.id);
    setActionMessage({ type: "", text: "" });
    try {
      const res = await approveSubjectRequest(item.id);
      setActionMessage({
        type: "success",
        text:
          res.message ||
          `Subject "${item.code} - ${item.name}" approved and added to curriculum. Student has been notified.`,
      });

      // Update state locally
      setRequests((prev) =>
        prev.map((r) =>
          r.id === item.id ? { ...r, status: "approved" } : r
        )
      );
      setPendingCount((prev) => Math.max(0, prev - 1));
      if (selectedStatus === "pending") {
        loadRequests();
      }
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to approve subject request.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open reject modal
  const handleOpenReject = (item) => {
    setRejectModal({
      isOpen: true,
      request: item,
      reason: "",
      isSubmitting: false,
    });
  };

  // Close reject modal
  const handleCloseReject = () => {
    if (rejectModal.isSubmitting) return;
    setRejectModal({
      isOpen: false,
      request: null,
      reason: "",
      isSubmitting: false,
    });
  };

  // Confirm rejection
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModal.reason.trim() || !rejectModal.request) return;

    setRejectModal((prev) => ({ ...prev, isSubmitting: true }));
    setActionMessage({ type: "", text: "" });
    try {
      const res = await rejectSubjectRequest(
        rejectModal.request.id,
        rejectModal.reason.trim()
      );
      setActionMessage({
        type: "success",
        text:
          res.message ||
          `Subject request for "${rejectModal.request.code}" was rejected and the student was notified.`,
      });

      const rejectedId = rejectModal.request.id;
      setRequests((prev) =>
        prev.map((r) =>
          r.id === rejectedId
            ? { ...r, status: "rejected", rejection_reason: rejectModal.reason.trim() }
            : r
        )
      );
      setPendingCount((prev) => Math.max(0, prev - 1));
      handleCloseReject();
      if (selectedStatus === "pending") {
        loadRequests();
      }
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to reject subject request.",
      });
      setRejectModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Close modal on Escape
  useEffect(() => {
    if (!rejectModal.isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !rejectModal.isSubmitting) {
        handleCloseReject();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rejectModal.isOpen, rejectModal.isSubmitting]);

  // Branch options for filter
  const branchOptions = useMemo(
    () => [
      { value: "ALL", label: "All Branches" },
      { value: "CommonForAllBranches", label: "Common (Sem 1 & 2)" },
      ...Object.entries(branches).map(([code, name]) => ({
        value: code,
        label: `${name} (${code})`,
      })),
    ],
    []
  );

  // Semester options for filter
  const semesterOptions = useMemo(
    () => [
      { value: "ALL", label: "All Semesters" },
      ...semesters.map((sem) => ({
        value: String(sem),
        label: `Semester ${sem}`,
      })),
    ],
    []
  );

  return (
    <div className={classes.pageContainer}>
      {/* Header */}
      <header className={classes.header}>
        <h1 className={classes.title}>Unlisted Subject Approvals</h1>
        <p className={classes.subtitle}>
          Review student requests to add past or unlisted subjects to curriculum dropdowns
        </p>

        {/* Status Tabs */}
        <div className={classes.tabBar}>
          <div
            className={`${classes.tabIndicator} ${indicatorReady ? classes.tabIndicatorTransition : ""}`}
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorStyle.width ? 1 : 0,
            }}
          />
          {STATUS_TABS.map((tab) => {
            const isActive = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => (tabRefs.current[tab.id] = el)}
                type="button"
                className={`${classes.tabBtn} ${isActive ? classes.activeTab : ""}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Notifications */}
      {actionMessage.text && (
        <div
          className={
            actionMessage.type === "error" ? classes.errorBox : classes.successBox
          }
        >
          <span>{actionMessage.text}</span>
          <button
            type="button"
            className={classes.alertCloseBtn}
            onClick={() => setActionMessage({ type: "", text: "" })}
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className={classes.toolbarCard}>
        <div className={classes.filtersGrid}>
          {/* Search Input */}
          <div className={classes.searchGroup}>
            <svg
              className={classes.searchIcon}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className={classes.searchInput}
              placeholder="Search code, name, roll no, email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                className={classes.clearSearchBtn}
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Branch Filter */}
          <div className={classes.filterItem}>
            <CustomSelect
              id="branch-filter"
              name="branch-filter"
              value={selectedBranch}
              placeholder="All Branches"
              options={branchOptions}
              onChange={(val) => {
                setSelectedBranch(val === "ALL" ? "" : val);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Semester Filter */}
          <div className={classes.filterItem}>
            <CustomSelect
              id="sem-filter"
              name="sem-filter"
              value={selectedSemester}
              placeholder="All Semesters"
              options={semesterOptions}
              onChange={(val) => {
                setSelectedSemester(val === "ALL" ? "" : val);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Reset Filters */}
          {(selectedBranch || selectedSemester || searchInput) && (
            <button
              type="button"
              className={classes.resetBtn}
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className={classes.tableContainer}>
        {loading ? (
          <div className={classes.loadingBox}>
            <div className={classes.spinner} />
            <span>Loading subject requests...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className={classes.emptyState}>
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <p>No subject requests found matching the current filters.</p>
          </div>
        ) : (
          <div className={classes.tableWrapper}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th>Subject Code</th>
                  <th>Subject Name</th>
                  <th>Curriculum</th>
                  <th>Requested By</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => {
                  const { formatted, relative } = formatDateTime(item.submitted_at);
                  const isPending = item.status === "pending";
                  const isApproved = item.status === "approved";
                  const isRejected = item.status === "rejected";
                  const isBusy = actionLoadingId === item.id;

                  return (
                    <tr key={item.id} className={classes.tableRow}>
                      <td>
                        <span className={classes.codeBadge}>{item.code}</span>
                      </td>
                      <td>
                        <div className={classes.subjectName} title={item.name}>
                          {item.name}
                        </div>
                      </td>
                      <td>
                        <span className={classes.branchSemBadge}>
                          {item.branch === "CommonForAllBranches"
                            ? "Common"
                            : item.branch}{" "}
                          · Sem {item.semester}
                        </span>
                      </td>
                      <td>
                        <div className={classes.studentInfo}>
                          <span className={classes.studentRno}>{item.user_rno}</span>
                          <span className={classes.studentSubtext} title={item.user_email}>
                            {item.user_name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={classes.dateInfo}>
                          <span className={classes.dateFormatted}>{formatted}</span>
                          {relative && (
                            <span className={classes.dateRelative}>{relative}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`${classes.statusBadge} ${
                            isApproved
                              ? classes.statusApproved
                              : isRejected
                              ? classes.statusRejected
                              : classes.statusPending
                          }`}
                        >
                          {isPending
                            ? "Pending"
                            : isApproved
                            ? "Approved"
                            : "Rejected"}
                        </span>
                      </td>
                      <td>
                        {isPending ? (
                          <div className={classes.actionGroup}>
                            <button
                              type="button"
                              className={classes.approveBtn}
                              disabled={isBusy}
                              onClick={() => handleApprove(item)}
                              title="Approve subject addition"
                            >
                              {isBusy ? (
                                <div className={classes.miniSpinner} />
                              ) : (
                                <>
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  <span>Approve</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              className={classes.rejectBtn}
                              disabled={isBusy}
                              onClick={() => handleOpenReject(item)}
                              title="Reject subject addition"
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <div className={classes.auditMeta}>
                            <span>
                              By: {item.reviewed_by_rno || "Admin"}
                            </span>
                            {isRejected && item.rejection_reason && (
                              <span
                                className={classes.reasonTooltip}
                                title={item.rejection_reason}
                              >
                                Reason: {item.rejection_reason}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalCount > 15 && (
          <div className={classes.paginationBar}>
            <span className={classes.paginationInfo}>
              Showing {(currentPage - 1) * 15 + 1}–
              {Math.min(currentPage * 15, totalCount)} of {totalCount} requests
            </span>
            <div className={classes.paginationControls}>
              <button
                type="button"
                className={classes.pageBtn}
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <span className={classes.pageIndicator}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className={classes.pageBtn}
                disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectModal.isOpen && (
        <div className={classes.modalBackdrop} onClick={handleCloseReject}>
          <div
            className={classes.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={classes.modalHeader}>
              <h3 className={classes.modalTitle}>Reject Subject Request</h3>
              <button
                type="button"
                className={classes.modalCloseBtn}
                onClick={handleCloseReject}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <p className={classes.modalDesc}>
              Please provide a clear reason for rejecting this subject request. This
              reason will be emailed directly to the requesting student.
            </p>

            {rejectModal.request && (
              <div style={{ marginBottom: "16px" }}>
                <span className={classes.subjectPreviewBadge}>
                  {rejectModal.request.code} — {rejectModal.request.name} (
                  {rejectModal.request.branch} Sem {rejectModal.request.semester})
                </span>
              </div>
            )}

            <form onSubmit={handleConfirmReject}>
              <textarea
                className={classes.reasonTextarea}
                placeholder="e.g. This course code does not exist in JEC syllabus, or equivalent to existing course..."
                value={rejectModal.reason}
                onChange={(e) =>
                  setRejectModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                required
                autoFocus
              />

              <div className={classes.modalActions}>
                <button
                  type="button"
                  className={classes.cancelBtn}
                  onClick={handleCloseReject}
                  disabled={rejectModal.isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={classes.confirmRejectBtn}
                  disabled={!rejectModal.reason.trim() || rejectModal.isSubmitting}
                >
                  {rejectModal.isSubmitting ? (
                    <>
                      <div className={classes.miniSpinner} />
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    "Confirm Rejection"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
