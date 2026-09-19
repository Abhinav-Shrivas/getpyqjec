import classes from "./NavBar.module.css";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../store/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import userIcon from "../../assets/user.svg";

export default function NavBar() {
  const { isLoggedIn, user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  useEffect(() => {
    if (!showDropdown) return;
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  const vStatus = user?.verification_status || "unverified";

  return (
    <nav className={classes.navbar}>
      <NavLink to="" className={() => classes["download-link"]}>
        <span className={classes["navbar-title"]}>GETPYQJEC</span>
      </NavLink>
      <div className={classes["navbar-right"]}>
        <NavLink
          to="/"
          className={({ isActive }) =>
            `${classes["navbar-link"]} ${isActive ? classes.active : ""}`
          }
          end
        >
          PYQ
        </NavLink>

        <NavLink
          to="/upload"
          className={({ isActive }) =>
            `${classes["navbar-link"]} ${isActive ? classes.active : ""}`
          }
        >
          UPLOAD
        </NavLink>

        {isLoggedIn ? (
          <div ref={dropdownRef} className={classes["user-menu"]}>
            <div
              className={classes["user-trigger"]}
              onClick={() => setShowDropdown((prev) => !prev)}
            >
              <img
                src={userIcon}
                alt="User"
                className={classes["user-icon"]}
              />
              <span
                className={`${classes["status-dot"]} ${classes[vStatus]}`}
                title={`Verification status: ${vStatus}`}
              />
            </div>
            {showDropdown && (
              <div className={classes.dropdown}>
                <div className={classes["dropdown-header"]}>
                  <span className={classes["dropdown-name"]}>
                    {"Hi " + user?.name?.split(" ")[0]}
                  </span>
                  <span className={`${classes["status-badge"]} ${classes[vStatus]}`}>
                    {vStatus === "verified" ? "Verified" : vStatus === "pending" ? "Pending" : "Unverified"}
                  </span>
                </div>

                <NavLink
                  to="/verify"
                  className={classes["dropdown-item"]}
                  onClick={() => setShowDropdown(false)}
                >
                  Verification Status
                </NavLink>

                <button
                  onClick={handleLogout}
                  className={classes["dropdown-logout"]}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <NavLink
            to="profile?mode=login"
            className={({ isActive }) =>
              `${classes["navbar-link"]} ${classes["profile-link"]} ${
                isActive ? classes.active : ""
              }`
            }
          >
            <span>PROFILE</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}
