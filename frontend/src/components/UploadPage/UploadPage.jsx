import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import UploadForm from "./UploadForm";
import { uploadData } from "../../http";
import ErrorPage from "../ErrorPage/Error";
import VerificationBanner from "../VerificationBanner/VerificationBanner";
import { useAuth } from "../../store/AuthContext";
import classes from "./UploadForm.module.css";

export default function UploadDataPage() {
  const [error, setError] = useState();
  const { logout, user, isVerified, isAdmin, refreshVerificationStatus } = useAuth();
  const [checkingVerification, setCheckingVerification] = useState(false);

  // Refs for auto-scroll
  const errorRef = useRef(null);

  useEffect(() => {
    // Refresh verification status on mount in case it was updated recently
    setCheckingVerification(true);
    refreshVerificationStatus().finally(() => setCheckingVerification(false));
  }, [refreshVerificationStatus]);

  async function uploadDataFn(formData) {
    try {
      await uploadData(formData);
      setError(null);
    } catch (err) {
      setError(
        { message: err.message } || { message: "failed to upload data" },
      );
      if (err.message.includes("Session expired")) {
        alert("Session Expired! Please login again.");
        logout();
      }
      throw err;
    }
  }

  // Auto scroll when error happens
  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [error]);

  const canUpload = isVerified || isAdmin;

  return (
    <div className="upload-page">
      {!canUpload ? (
        <div className={classes.uploadPage} style={{ minHeight: "70vh" }}>
          <h1 className={classes.heading}>Upload PYQ</h1>
          <p className={classes.subtitle}>
            Share previous year question papers with fellow students
          </p>

          <VerificationBanner />

          <div className={classes.container} style={{ textAlign: "center", padding: "48px 30px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🔒</div>
            <h2 style={{ fontFamily: "Outfit Medium, sans-serif", fontSize: "1.5rem", marginBottom: "12px", color: "#EFEEE8" }}>
              Student Verification Required
            </h2>
            <p style={{ color: "rgba(239, 238, 232, 0.75)", maxWidth: "460px", margin: "0 auto 24px", lineHeight: "1.5" }}>
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
        <>
          <UploadForm uploadFn={uploadDataFn} />
          {error && (
            <div ref={errorRef}>
              <ErrorPage message={error.message} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
