import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import NavBar from "./NavBar.jsx";
import Background from "../Background/Background.jsx";
import Footer from "../Footer/Footer.jsx";

export default function RootLayout() {
  const location = useLocation();

  // Automatically scroll to the top of the window on route change
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTo(0, 0);
    document.body.scrollTop = 0;
  }, [location.pathname]);

  // Hide footer on student verification and subject verification pages
  const hiddenRoutes = ["/verify", "/admin/unlisted-subjects"];
  const isFooterHidden = hiddenRoutes.some(
    (route) => location.pathname === route || location.pathname.startsWith(`${route}/`)
  );

  return (
    <>
      <Background />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: "100vw",
          overflowX: "hidden",
        }}
      >
        <NavBar />
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: "calc(100vh - 58px)",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
          }}
        >
          <Outlet />
        </main>
        {!isFooterHidden && <Footer />}
      </div>
    </>
  );
}