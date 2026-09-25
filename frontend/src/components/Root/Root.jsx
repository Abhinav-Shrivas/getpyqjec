import { Outlet, useLocation } from "react-router-dom";
import NavBar from "./NavBar.jsx";
import Background from "../Background/Background.jsx";
import Footer from "../Footer/Footer.jsx";

export default function RootLayout() {
  const location = useLocation();

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
        }}
      >
        <NavBar />
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: "calc(100vh - 58px)",
          }}
        >
          <Outlet />
        </main>
        {!isFooterHidden && <Footer />}
      </div>
    </>
  );
}