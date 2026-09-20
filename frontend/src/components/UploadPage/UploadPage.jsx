import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import UploadForm from "./UploadForm";
import { uploadData } from "../../http";
import { useAuth } from "../../store/AuthContext";
import classes from "./UploadForm.module.css";

export default function UploadDataPage() {
  const { logout, user, isVerified, isAdmin, refreshVerificationStatus } = useAuth();
  const [checkingVerification, setCheckingVerification] = useState(false);

  useEffect(() => {
    // Refresh verification status on mount in case it was updated recently
    setCheckingVerification(true);
    refreshVerificationStatus().finally(() => setCheckingVerification(false));
  }, [refreshVerificationStatus]);

  async function uploadDataFn(formData) {
    await uploadData(formData);
  }

  const canUpload = isVerified || isAdmin;

  return (
    <div className="upload-page">
      {!canUpload ? (
        <div className={classes.uploadPage} style={{ minHeight: "70vh" }}>
          <h1 className={classes.heading}>Upload PYQ</h1>
          <p className={classes.subtitle}>
            Share previous year question papers with fellow students
          </p>

          <div className={classes.container} style={{ textAlign: "center", padding: "48px 30px" }}>
            <div className={classes.lockIconWrapper}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "'Degular Medium', sans-serif", fontSize: "1.6rem", fontWeight: 500, marginBottom: "12px", color: "#EFEEE8", letterSpacing: "0.3px" }}>
              Student Verification Required
            </h2>
            <p style={{ fontFamily: "'Degular Regular', sans-serif", color: "rgba(239, 238, 232, 0.75)", maxWidth: "460px", margin: "0 auto 24px", lineHeight: "1.5" }}>
              To ensure the authenticity and quality of question papers uploaded to GetPYQ, uploading is restricted to verified Jabalpur Engineering College students.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/verify" className={classes.submitBtn} style={{ textDecoration: "none", display: "inline-block" }}>
                {user?.verification_status === "pending" ? "View Verification Status" : "Verify College ID Now"}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <UploadForm uploadFn={uploadDataFn} />
      )}
    </div>
  );
}
