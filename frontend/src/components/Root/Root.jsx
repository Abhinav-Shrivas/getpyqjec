import { Outlet } from "react-router-dom";
import NavBar from "./NavBar.jsx";
import Background from "../Background/Background.jsx";

export default function RootLayout() {
  return (
    <>
      <Background />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>
        <NavBar />
        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}