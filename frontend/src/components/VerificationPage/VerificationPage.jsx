import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../store/AuthContext";
import {
  getVerificationStatus,
  submitVerification,
  resubmitVerification,
  getAdminVerifications,
  getAdminVerificationDetail,
  approveVerification,
  rejectVerification,
  deleteVerificationDocument,
} from "../../http";
import classes from "./VerificationPage.module.css";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending Review" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

export default function VerificationPage() {
  const { user, isAdmin, updateVerificationStatus } = useAuth();

  // Student view states
  const [statusData, setStatusData] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [studentError, setStudentError] = useState("");
  const [studentSuccess, setStudentSuccess] = useState("");

  // Admin view states
  const [activeTab, setActiveTab] = useState("student"); // "student" | "admin"
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [indicatorReady, setIndicatorReady] = useState(false);
  const studentTabRef = useRef(null);
  const adminTabRef = useRef(null);
  const [adminSubmissions, setAdminSubmissions] = useState([]);
  const [adminFilter, setAdminFilter] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionMessage, setActionMessage] = useState({ type: "", text: "" });

  const fileInputRef = useRef(null);

  // Load student status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      const data = await getVerificationStatus();
      setStatusData(data);
      if (data?.status) {
        updateVerificationStatus(data.status);
      }
    } catch (err) {
      console.error(err);
      setStudentError(err.message || "Failed to load status.");
    } finally {
      setLoadingStatus(false);
    }
  }

  // Handle file selection
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setStudentError("Only JPEG and PNG images are allowed.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setStudentError("Image size must be less than 2MB.");
      return;
    }

    setStudentError("");
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  function handleDrop(e) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        setStudentError("Only JPEG and PNG images are allowed.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setStudentError("Image size must be less than 2MB.");
        return;
      }
      setStudentError("");
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  function handleClearFile() {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Handle student submit / resubmit
  async function handleSubmitID(isResubmission = false) {
    if (!selectedFile) {
      setStudentError("Please select an ID card image.");
      return;
    }

    setSubmitting(true);
    setStudentError("");
    setStudentSuccess("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const apiFn = isResubmission ? resubmitVerification : submitVerification;
      const res = await apiFn(formData);
      setStudentSuccess(res.message || "ID card submitted for review.");
      handleClearFile();
      await loadStatus();
    } catch (err) {
      setStudentError(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Admin functions
  useEffect(() => {
    if (isAdmin && activeTab === "admin") {
      loadAdminList();
    }
  }, [isAdmin, activeTab, adminFilter, adminSearch]);

  async function loadAdminList() {
    setAdminLoading(true);
    try {
      const params = {};
      if (adminFilter) params.status = adminFilter;
      if (adminSearch) params.search = adminSearch;
      const data = await getAdminVerifications(params);
      setAdminSubmissions(data.results || []);
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Failed to load verifications." });
    } finally {
      setAdminLoading(false);
    }
  }

  async function openDetailModal(id) {
    setDetailLoading(true);
    setSelectedDetail(null);
    setActionMessage({ type: "", text: "" });
    try {
      const data = await getAdminVerificationDetail(id);
      setSelectedDetail(data);
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Failed to load details." });
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleApprove(id) {
    setActionLoading(true);
    try {
      await approveVerification(id);
      setActionMessage({ type: "success", text: "Verification successfully approved." });
      await loadAdminList();
      if (selectedDetail && selectedDetail.id === id) {
        openDetailModal(id);
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Failed to approve." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(id) {
    if (!rejectReason.trim()) {
      setActionMessage({ type: "error", text: "Rejection reason is required." });
      return;
    }
    setActionLoading(true);
    try {
      await rejectVerification(id, rejectReason.trim());
      setActionMessage({ type: "success", text: "Verification rejected." });
      setShowRejectModal(false);
      setRejectReason("");
      await loadAdminList();
      if (selectedDetail && selectedDetail.id === id) {
        openDetailModal(id);
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Failed to reject." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteDoc(id) {
    if (!window.confirm("Are you sure you want to permanently delete this verification document from storage? This cannot be undone.")) {
      return;
    }
    setActionLoading(true);
    try {
      await deleteVerificationDocument(id);
      setActionMessage({ type: "success", text: "Document deleted from storage." });
      await loadAdminList();
      if (selectedDetail && selectedDetail.id === id) {
        openDetailModal(id);
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Failed to delete document." });
    } finally {
      setActionLoading(false);
    }
  }

  const updateIndicator = useCallback(() => {
    const activeEl = activeTab === "student" ? studentTabRef.current : adminTabRef.current;
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, [activeTab]);

  useEffect(() => {
    if (isAdmin) {
      updateIndicator();
      const timer = setTimeout(() => setIndicatorReady(true), 40);
      window.addEventListener("resize", updateIndicator);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", updateIndicator);
      };
    }
  }, [isAdmin, updateIndicator]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const targetEl = tab === "student" ? studentTabRef.current : adminTabRef.current;
    if (targetEl) {
      setIndicatorStyle({
        left: targetEl.offsetLeft,
        width: targetEl.offsetWidth,
      });
    }
  };

  const currentStatus = statusData?.status || user?.verification_status || "unverified";

  return (
    <div className={classes.pageContainer}>
      <header className={classes.header}>
        <h1 className={classes.title}>Student Verification</h1>
        <p className={classes.subtitle}>
          Verify your Jabalpur Engineering College enrollment to contribute question papers
        </p>

        {isAdmin && (
          <div className={classes.tabBar}>
            <div
              className={`${classes.tabIndicator} ${indicatorReady ? classes.tabIndicatorTransition : ""}`}
              style={{
                transform: `translateX(${indicatorStyle.left}px)`,
                width: `${indicatorStyle.width}px`,
                opacity: indicatorStyle.width ? 1 : 0,
              }}
            />
            <button
              ref={studentTabRef}
              className={`${classes.tabBtn} ${activeTab === "student" ? classes.activeTab : ""}`}
              onClick={() => handleTabChange("student")}
            >
              My Verification
            </button>
            <button
              ref={adminTabRef}
              className={`${classes.tabBtn} ${activeTab === "admin" ? classes.activeTab : ""}`}
              onClick={() => handleTabChange("admin")}
            >
              Admin Review Queue
            </button>
          </div>
        )}
      </header>

      {activeTab === "student" ? (
        <div className={classes.studentContent}>
          {loadingStatus ? (
            <div className={classes.loadingBox}>
              <div className={classes.spinner} />
              <span>Checking verification status...</span>
            </div>
          ) : (
            <>
              {/* Status Banner */}
              <div className={`${classes.statusCard} ${classes[currentStatus]}`}>
                <div className={classes.statusHeader}>
                  <span className={classes.statusBadge}>
                    {currentStatus === "verified" && (
                      <span className={classes.badgeWithIcon}>
                        <span className={classes.verifiedBadge}>
                          <svg
                            className={classes.badgeVerifiedIcon}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        Verified Student
                      </span>
                    )}
                    {currentStatus === "pending" && (
                      <span className={classes.badgeWithIcon}>
                        <span className={classes.pendingBadge}>
                          <svg
                            className={classes.badgePendingIcon}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </span>
                        Pending Review
                      </span>
                    )}
                    {currentStatus === "rejected" && (
                      <span className={classes.badgeWithIcon}>
                        <span className={classes.rejectedBadge}>
                          <svg
                            className={classes.badgeRejectedIcon}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        </span>
                        Verification Rejected
                      </span>
                    )}
                    {currentStatus === "unverified" && (
                      <span className={classes.badgeWithIcon}>
                        <span className={classes.lockBadge}>
                          <svg
                            className={classes.badgeLockIcon}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </span>
                        Action Required: Not Verified
                      </span>
                    )}
                  </span>
                  {statusData?.submitted_at && (
                    <span className={classes.statusDate}>
                      Submitted: {new Date(statusData.submitted_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className={classes.statusBody}>
                  {currentStatus === "verified" && (
                    <div className={classes.verifiedState}>
                      <p className={classes.stateText}>
                        Your student account is fully verified! You can upload and manage question papers.
                      </p>
                      <Link to="/upload" className={classes.primaryBtn}>
                        Go to Upload PYQ
                      </Link>
                    </div>
                  )}

                  {currentStatus === "pending" && (
                    <div className={classes.pendingState}>
                      <p className={classes.stateText}>
                        Your college ID card has been received and is currently under review by our administrators.
                      </p>
                      <div className={classes.pendingNoticeBox}>
                        <div className={classes.pendingNotice}>
                          <strong>Review Notice:</strong> Verifications are processed manually by an administrator to grant question paper upload privileges.
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStatus === "rejected" && (
                    <div className={classes.rejectedState}>
                      <p className={classes.stateText}>
                        Your verification was not approved. Please review the reason below and upload a clear, legible photo of your college ID card.
                      </p>
                      {statusData?.rejection_reason && (
                        <div className={classes.reasonBox}>
                          <span className={classes.reasonLabel}>Reason from reviewer:</span>
                          <p className={classes.reasonText}>{statusData.rejection_reason}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStatus === "unverified" && (
                    <div className={classes.unverifiedState}>
                      <p className={classes.stateText}>
                        To maintain academic integrity and prevent spam, PYQ uploads are reserved for verified Jabalpur Engineering College students. Please upload a clear photo or scan of your student ID card.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Form — Shown if unverified or rejected */}
              {(currentStatus === "unverified" || currentStatus === "rejected") && (
                <div className={classes.uploadSection}>
                  <h3 className={classes.sectionHeading}>
                    {currentStatus === "rejected" ? "Resubmit College ID Card" : "Upload College ID Card"}
                  </h3>

                  {studentError && <div className={classes.errorBox}>{studentError}</div>}
                  {studentSuccess && <div className={classes.successBox}>{studentSuccess}</div>}

                  <div
                    className={`${classes.dropZone} ${previewUrl ? classes.hasPreview : ""}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => !previewUrl && fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      accept="image/jpeg,image/png"
                      onChange={handleFileChange}
                    />

                    {previewUrl ? (
                      <div className={classes.previewContainer}>
                        <img src={previewUrl} alt="ID Card Preview" className={classes.previewImage} />
                        <div className={classes.previewOverlay}>
                          <button
                            type="button"
                            className={classes.clearBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearFile();
                            }}
                          >
                            ✕ Remove Image
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={classes.dropZonePrompt}>
                        <div className={classes.uploadIcon}>🪪</div>
                        <p className={classes.dropText}>
                          Drag & drop your ID card here, or <span className={classes.browseLink}>browse</span>
                        </p>
                        <span className={classes.fileLimits}>Supported: JPEG, PNG · Maximum 2MB</span>
                      </div>
                    )}
                  </div>

                  <div className={classes.requirementsList}>
                    <h4>Submission Guidelines:</h4>
                    <ul>
                      <li>Ensure your full name, roll number, and college name are sharp and clearly legible.</li>
                      <li>Avoid glare, blurry scans, heavy shadows, or clipped edges.</li>
                      <li>Both physical laminated cards and digital student ID screenshots are accepted.</li>
                    </ul>
                  </div>

                  <div className={classes.actionRow}>
                    <button
                      type="button"
                      className={classes.submitBtn}
                      disabled={!selectedFile || submitting}
                      onClick={() => handleSubmitID(currentStatus === "rejected")}
                    >
                      {submitting ? "Processing & Uploading..." : currentStatus === "rejected" ? "Resubmit ID for Review" : "Submit for Verification"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Admin Review View */
        <div className={classes.adminContent}>
          <div className={classes.adminToolbar}>
            <div className={classes.filterGroup}>
              <div className={classes.selectWrapper}>
                <span className={classes.selectLabel}>
                  {STATUS_FILTER_OPTIONS.find((opt) => opt.value === adminFilter)?.label || "All Statuses"}
                </span>
                <svg
                  className={classes.selectArrow}
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#EFEEE8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <select
                  className={classes.nativeSelect}
                  value={adminFilter}
                  onChange={(e) => setAdminFilter(e.target.value)}
                  aria-label="Filter status"
                >
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      style={{ background: "#181726", color: "#EFEEE8" }}
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={classes.searchGroup}>
              <input
                type="text"
                className={classes.searchInput}
                placeholder="Search by Roll No, Name, or Email..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
              />
            </div>
          </div>

          {actionMessage.text && (
            <div className={actionMessage.type === "error" ? classes.errorBox : classes.successBox}>
              {actionMessage.text}
            </div>
          )}

          {adminLoading ? (
            <div className={classes.loadingBox}>
              <div className={classes.spinner} />
              <span>Loading submissions...</span>
            </div>
          ) : adminSubmissions.length === 0 ? (
            <div className={classes.emptyState}>No verification submissions found matching filters.</div>
          ) : (
            <div className={classes.tableWrapper}>
              <table className={classes.table}>
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {adminSubmissions.map((sub) => (
                    <tr key={sub.id} className={classes.tableRow}>
                      <td className={classes.rnoCell}>{sub.user_rno}</td>
                      <td>{sub.user_name}</td>
                      <td>
                        <span className={`${classes.badge} ${classes[sub.status]}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td>{new Date(sub.submitted_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          className={classes.reviewBtn}
                          onClick={() => openDetailModal(sub.id)}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Admin Detail Modal */}
          {(selectedDetail || detailLoading) && (
            <div className={classes.modalBackdrop} onClick={() => setSelectedDetail(null)}>
              <div className={classes.modalContent} onClick={(e) => e.stopPropagation()}>
                <button
                  className={classes.closeModalBtn}
                  onClick={() => setSelectedDetail(null)}
                >
                  ✕
                </button>

                {detailLoading ? (
                  <div className={classes.loadingBox}>
                    <div className={classes.spinner} />
                    <span>Loading details...</span>
                  </div>
                ) : (
                  <div className={classes.modalBody}>
                    <h2 className={classes.modalTitle}>Verification Inspection: {selectedDetail.user_rno}</h2>

                    <div className={classes.sideBySide}>
                      {/* Left side: ID Card Image */}
                      <div className={classes.imageSide}>
                        <h4>Submitted ID Card</h4>
                        {selectedDetail.image_url ? (
                          <div className={classes.imageCard}>
                            <img
                              src={selectedDetail.image_url}
                              alt="Student ID Card"
                              className={classes.fullImage}
                            />
                            <a
                              href={selectedDetail.image_url}
                              target="_blank"
                              rel="noreferrer"
                              className={classes.openFullLink}
                            >
                              Open Full Size ↗
                            </a>
                          </div>
                        ) : (
                          <div className={classes.missingImage}>
                            {selectedDetail.image_error || "Document not available or already deleted from storage."}
                          </div>
                        )}

                        {selectedDetail.image_url && (
                          <div className={classes.deleteDocContainer}>
                            <button
                              className={classes.deleteDocBtn}
                              disabled={actionLoading}
                              onClick={() => handleDeleteDoc(selectedDetail.id)}
                            >
                              🗑️ Delete Document from Storage
                            </button>
                            <span className={classes.deleteHint}>
                              Permanently removes ID image from Cloudflare R2 while preserving verification metadata.
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right side: Student Data & Review Controls */}
                      <div className={classes.dataSide}>
                        <h4>Student Information</h4>

                        <div className={classes.infoGrid}>
                          <div className={classes.infoItem}>
                            <label>Registered Name:</label>
                            <span>{selectedDetail.user_name}</span>
                          </div>
                          <div className={classes.infoItem}>
                            <label>Registered Email:</label>
                            <span>{selectedDetail.user_email}</span>
                          </div>
                          <div className={classes.infoItem}>
                            <label>Registered Roll No:</label>
                            <span>{selectedDetail.user_rno}</span>
                          </div>
                          <div className={classes.infoItem}>
                            <label>Current Status:</label>
                            <span className={`${classes.badge} ${classes[selectedDetail.status]}`}>
                              {selectedDetail.status}
                            </span>
                          </div>
                        </div>

                        {/* Review Checklist */}
                        <div className={classes.reviewChecklist}>
                          <h5>Moderator Review Checklist</h5>
                          <ul className={classes.checklistItems}>
                            <li>Verify the college name on the ID matches <strong>Jabalpur Engineering College</strong>.</li>
                            <li>Verify the Roll Number matches <strong>{selectedDetail.user_rno}</strong>.</li>
                            <li>Check the student's name on the card matches <strong>{selectedDetail.user_name}</strong>.</li>
                            <li>Ensure the card is clear, legible, and unexpired.</li>
                          </ul>
                        </div>

                        {/* Admin Action Buttons */}
                        <div className={classes.modalActions}>
                          {selectedDetail.status === "pending" && (
                            <>
                              <button
                                className={classes.approveBtn}
                                disabled={actionLoading}
                                onClick={() => handleApprove(selectedDetail.id)}
                              >
                                ✓ Approve Student
                              </button>
                              <button
                                className={classes.rejectBtn}
                                disabled={actionLoading}
                                onClick={() => setShowRejectModal(true)}
                              >
                                ✕ Reject
                              </button>
                            </>
                          )}
                          {selectedDetail.status === "rejected" && (
                            <span className={classes.alreadyReviewed}>
                              Rejected with reason: {selectedDetail.rejection_reason}
                            </span>
                          )}
                          {selectedDetail.status === "verified" && (
                            <span className={classes.alreadyReviewed}>
                              Approved by {selectedDetail.reviewed_by_rno || "Admin"} on{" "}
                              {new Date(selectedDetail.reviewed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rejection Reason Modal */}
          {showRejectModal && (
            <div className={classes.modalBackdrop} style={{ zIndex: 1100 }}>
              <div className={classes.smallModal}>
                <h3>Reject Verification</h3>
                <p>Provide a clear reason for the student explaining why the ID card was rejected:</p>
                <textarea
                  className={classes.reasonTextarea}
                  rows={4}
                  placeholder="e.g. Roll number unreadable, institution name not matching, blurred photo..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <div className={classes.smallModalActions}>
                  <button
                    className={classes.cancelBtn}
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectReason("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className={classes.confirmRejectBtn}
                    disabled={actionLoading || !rejectReason.trim()}
                    onClick={() => handleReject(selectedDetail.id)}
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
