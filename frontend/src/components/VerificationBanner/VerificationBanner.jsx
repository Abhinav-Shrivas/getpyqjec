import { Link } from "react-router-dom";
import { useAuth } from "../../store/AuthContext";
import classes from "./VerificationBanner.module.css";

export default function VerificationBanner({ inline = false }) {
  const { user, isVerified, isLoggedIn } = useAuth();

  if (!isLoggedIn || isVerified) {
    return null;
  }

  const status = user?.verification_status || "unverified";

  return (
    <div className={`${classes.banner} ${classes[status]} ${inline ? classes.inline : ""}`}>
      <div className={classes.content}>
        <div className={classes.iconArea}>
          {status === "pending" && <span className={classes.icon}>⏳</span>}
          {status === "rejected" && <span className={classes.icon}>⚠️</span>}
          {status === "unverified" && <span className={classes.icon}>🔒</span>}
        </div>
        <div className={classes.textContainer}>
          <h4 className={classes.title}>
            {status === "pending" && "Verification Under Review"}
            {status === "rejected" && "Verification Rejected"}
            {status === "unverified" && "Student Verification Required"}
          </h4>
          <p className={classes.message}>
            {status === "pending" &&
              "Your ID card has been received and is waiting for administrator approval. Uploads will be enabled once approved."}
            {status === "rejected" &&
              "Your previous submission was not approved. Please review the reason and resubmit a clear college ID."}
            {status === "unverified" &&
              "You must verify your student enrollment before you can upload question papers."}
          </p>
        </div>
      </div>
      <div className={classes.action}>
        <Link to="/verify" className={classes.verifyButton}>
          {status === "rejected" ? "Resubmit ID" : status === "pending" ? "Check Status" : "Verify Now"}
        </Link>
      </div>
    </div>
  );
}
