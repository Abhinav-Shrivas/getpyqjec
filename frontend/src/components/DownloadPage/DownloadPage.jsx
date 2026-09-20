import { useState, useEffect, useCallback } from "react";
import FormPYQ from "./Form";
import DataArea from "./DataArea";
import { fetchUrls } from "../../http";
import ErrorPage from "../ErrorPage/Error";
import LoadingPage from "./LoadingPage";
import styles from "./DownloadPage.module.css";

export default function DownloadPage() {
  const [fetchedData, setFetchedData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFn = async (queryString) => {
    setIsLoading(true);
    setError(null);
    setFetchedData(null);
    try {
      const data = await fetchUrls(queryString);
      setFetchedData(data);
      setError(null);
      return data;
    } catch (err) {
      setError({ message: err.message || "Failed to fetch data" });
      setFetchedData(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = useCallback(() => {
    if (isLoading) return;
    setError(null);
    setFetchedData(null);
  }, [isLoading]);

  const isModalOpen = isLoading || Boolean(error) || Boolean(fetchedData);

  // Close on Escape key & lock body scrolling while modal is open (only when not loading)
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isLoading) {
        handleCloseModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isModalOpen, isLoading, handleCloseModal]);

  return (
    <div className={`download-page ${styles.downloadPage}`}>
      <FormPYQ fetchFn={fetchFn} />

      {/* Pop-up Modal Box for Loading, Error, and Download Result */}
      {isModalOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLoading) {
              handleCloseModal();
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.modalContainer}>
            {isLoading && <LoadingPage />}

            {!isLoading && error && (
              <ErrorPage
                message={error.message}
                onClose={handleCloseModal}
              />
            )}

            {!isLoading && !error && fetchedData && (
              <DataArea
                url={fetchedData}
                onClose={handleCloseModal}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

