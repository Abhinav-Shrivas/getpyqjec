import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import styles from "./UploadForm.module.css";
import {
  branches,
  subjects,
  semesters,
  ordinals,
} from "../../information";
import createPdfFromImages from "../../imgTopdf";
import CustomSelect from "../CustomSelect/CustomSelect";
import { fetchExistingPYQs } from "../../http";

// Generate current year + last 10 years (descending)
const currentYear = new Date().getFullYear();
const allYears = Array.from({ length: 11 }, (_, i) => currentYear - i);

const ALL_SESSIONS = [
  { value: "April", label: "April" },
  { value: "December", label: "December" },
];

const initialState = {
  semester: "",
  branch: "",
  session: "",
  subject: "",
  year: "",
  files: [], // can be 1 PDF or multiple images
};

export default function UploadFormPYQ({ uploadFn }) {
  const [selectedValues, setSelectedValues] = useState(initialState);
  const [errorMessage, setErrorMessage] = useState("");
  const [upload, setUpload] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [existingPYQs, setExistingPYQs] = useState([]);
  const fileInputRef = useRef(null);

  // Fetch existing papers whenever semester and branch change
  const refreshExisting = useCallback(() => {
    if (!selectedValues.semester || !selectedValues.branch) {
      setExistingPYQs([]);
      return;
    }
    fetchExistingPYQs(selectedValues.branch, selectedValues.semester).then((data) => {
      if (data?.existing) {
        setExistingPYQs(data.existing);
      }
    });
  }, [selectedValues.branch, selectedValues.semester]);

  useEffect(() => {
    refreshExisting();
  }, [refreshExisting]);

  // Existing records for currently selected subject
  const currentSubjectExisting = useMemo(() => {
    if (!selectedValues.subject) return [];
    return existingPYQs.filter(
      (item) => item.subject_code?.toUpperCase() === selectedValues.subject?.toUpperCase()
    );
  }, [existingPYQs, selectedValues.subject]);

  // Compute available Year options — omitting years that already have both sessions (or the selected session)
  const availableYearOptions = useMemo(() => {
    if (!selectedValues.subject) {
      return allYears.map((y) => ({ value: String(y), label: String(y) }));
    }

    return allYears
      .filter((year) => {
        const yearRecords = currentSubjectExisting.filter(
          (r) => Number(r.year) === Number(year)
        );
        const uploadedSessions = new Set(
          yearRecords.map((r) => r.exam_session?.trim().toLowerCase())
        );

        // If both april and december session pyq is present, the whole year will NOT be listed
        if (uploadedSessions.has("april") && uploadedSessions.has("december")) {
          return false;
        }

        // If session is already selected, omit this year if it already has that session
        if (selectedValues.session) {
          const hasSession = uploadedSessions.has(
            selectedValues.session.trim().toLowerCase()
          );
          return !hasSession;
        }

        return true;
      })
      .map((year) => ({ value: String(year), label: String(year) }));
  }, [selectedValues.subject, selectedValues.session, currentSubjectExisting]);

  // Compute available Session options — omitting sessions already uploaded for this (subject, year)
  const availableSessionOptions = useMemo(() => {
    if (!selectedValues.subject || !selectedValues.year) {
      return ALL_SESSIONS;
    }

    const selectedYearNum = Number(selectedValues.year);
    const existingSessionsForYear = new Set(
      currentSubjectExisting
        .filter((r) => Number(r.year) === selectedYearNum)
        .map((r) => r.exam_session?.trim().toLowerCase())
    );

    return ALL_SESSIONS.filter(
      (s) => !existingSessionsForYear.has(s.value.trim().toLowerCase())
    );
  }, [selectedValues.subject, selectedValues.year, currentSubjectExisting]);

  // Auto-clear year if selected year is no longer available
  useEffect(() => {
    if (selectedValues.year && availableYearOptions.length > 0) {
      const isYearValid = availableYearOptions.some(
        (opt) => opt.value === String(selectedValues.year)
      );
      if (!isYearValid) {
        setSelectedValues((prev) => ({ ...prev, year: "", session: "" }));
      }
    }
  }, [availableYearOptions, selectedValues.year]);

  // Auto-adjust session if selected session is no longer available for the year
  useEffect(() => {
    if (selectedValues.year && availableSessionOptions.length > 0) {
      const isSessionValid = availableSessionOptions.some(
        (opt) => opt.value === selectedValues.session
      );
      if (!isSessionValid) {
        if (availableSessionOptions.length === 1) {
          setSelectedValues((prev) => ({
            ...prev,
            session: availableSessionOptions[0].value,
          }));
        } else {
          setSelectedValues((prev) => ({ ...prev, session: "" }));
        }
      }
    }
  }, [availableSessionOptions, selectedValues.year, selectedValues.session]);

  // Detect file type from selected files
  const detectedType = useMemo(() => {
    if (selectedValues.files.length === 0) return null;
    if (selectedValues.files[0].type === "application/pdf") return "pdf";
    return "image";
  }, [selectedValues.files]);

  // Generate stable thumbnail URLs
  const thumbnailUrls = useMemo(() => {
    if (detectedType !== "image") return [];
    return selectedValues.files.map((file) => URL.createObjectURL(file));
  }, [selectedValues.files, detectedType]);

  // Revoke object URLs on change/unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      thumbnailUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [thumbnailUrls]);

  function handleDragStart(e, index) {
    setDragIndex(index);
  }

  function handleDrop(e, dropIndex) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;
    const reordered = [...selectedValues.files];
    const [dragged] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, dragged);
    setSelectedValues((prev) => ({ ...prev, files: reordered }));
    setDragIndex(null);
  }

  const subjectsToShow = [];
  if (selectedValues.semester && selectedValues.branch) {
    const sem = selectedValues.semester;
    const branch = selectedValues.branch;
    const branchSubjects =
      Number(sem) <= 2
        ? subjects.CommonForAllBranches?.[ordinals[sem]]
        : subjects[branch]?.[ordinals[sem]];
    if (branchSubjects) {
      subjectsToShow.push(...branchSubjects);
    }
  }

  // Handle file selection — auto-detect type
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setErrorMessage("");
    if (selectedFiles.length === 0) return;

    // Check if files are all the same type
    const hasPdf = selectedFiles.some((f) => f.type === "application/pdf");
    const hasImage = selectedFiles.some((f) => ["image/png", "image/jpeg"].includes(f.type));

    if (hasPdf && hasImage) {
      setErrorMessage("Cannot mix PDF and image files. Select one type.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (hasPdf) {
      // PDF mode
      if (selectedFiles.length > 1) {
        setErrorMessage("You can upload only 1 PDF file.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (selectedFiles[0].size > 5 * 1024 * 1024) {
        setErrorMessage("PDF size must be ≤ 5MB.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    } else if (hasImage) {
      // Image mode
      if (selectedFiles.length > 6) {
        setErrorMessage("You can upload up to 6 images only.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      for (const file of selectedFiles) {
        if (file.size > 2 * 1024 * 1024) {
          setErrorMessage(`${file.name} exceeds 2MB size limit.`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
        if (!["image/png", "image/jpeg"].includes(file.type)) {
          setErrorMessage(`${file.name} is not a supported format.`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
      }
    } else {
      setErrorMessage("Unsupported file type. Use PDF, PNG, or JPG.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedValues((prev) => ({
      ...prev,
      files: selectedFiles,
    }));
  };

  // Remove all files
  const handleRemoveFiles = () => {
    setSelectedValues((prev) => ({
      ...prev,
      files: [],
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setShowOverlay(false);
  };

  // Remove a single image by index
  const handleRemoveOne = (index) => {
    setSelectedValues((prev) => {
      const updated = prev.files.filter((_, i) => i !== index);
      if (updated.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = "";
        setShowOverlay(false);
      }
      return { ...prev, files: updated };
    });
  };

  // Handle submit
  async function handleSubmit(event) {
    event.preventDefault();
    if (selectedValues.files.length === 0) {
      alert("Please select a file to upload.");
      return;
    }
    setUpload(true);
    let finalFile = null;

    if (detectedType === "pdf") {
      finalFile = selectedValues.files[0]; // single PDF
    } else if (detectedType === "image") {
      finalFile = await createPdfFromImages(selectedValues.files); // merged PDF
    }

    const formData = new FormData();
    formData.append("branch", selectedValues.branch);
    formData.append("semester", selectedValues.semester);
    formData.append("exam_session", selectedValues.session);
    formData.append("subject_code", selectedValues.subject);
    formData.append("year", selectedValues.year);
    formData.append("file", finalFile);

    try {
      await uploadFn(formData);
      refreshExisting();
      setSelectedValues(initialState);
      event.target.reset();
      setUpload(false);
      alert("File Uploaded Successfully");
    } catch (error) {
      setSelectedValues(initialState);
      event.target.reset();
      setUpload(false);
    }
  }

  // Handle reset
  function handleReset(e) {
    e.preventDefault();
    setSelectedValues(initialState);
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    e.target.reset();
  }

  return (
    <div className={styles.uploadPage}>
      <h1 className={styles.heading}>Contribute Question Papers Instantly.</h1>
      <p className={styles.subtitle}>
        Help students access better resources by uploading verified PYQs
      </p>
      <div className={styles.container}>
        <form
          id="pyqForm"
          onSubmit={handleSubmit}
          onReset={handleReset}
          className={styles.form}
        >
          {/* Row 1: Semester, Branch, Subject */}
          {/* Row 1: Semester, Branch, Subject */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="semester" className={styles.label}>
                Semester
              </label>
              <CustomSelect
                id="semester"
                name="semester"
                value={selectedValues.semester}
                placeholder="Select Semester"
                options={semesters.map((sem) => ({
                  value: String(sem),
                  label: `Semester ${sem}`,
                }))}
                required
                onChange={(val) => {
                  if (Number(val) > 2) {
                    setSelectedValues((prev) => ({
                      ...prev,
                      semester: val,
                      branch: "",
                      subject: "",
                    }));
                  } else {
                    setSelectedValues((prev) => ({
                      ...prev,
                      semester: val,
                      branch: "CommonForAllBranches",
                      subject: "",
                    }));
                  }
                }}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="branch" className={styles.label}>
                Branch
              </label>
              <CustomSelect
                id="branch"
                name="branch"
                value={selectedValues.branch}
                placeholder="Select Branch"
                options={
                  selectedValues.semester === "1" || selectedValues.semester === "2"
                    ? [{ value: "CommonForAllBranches", label: "Common For All Branches" }]
                    : Object.entries(branches).map(([short, full]) => ({
                        value: short,
                        label: full,
                      }))
                }
                required
                disabled={!selectedValues.semester}
                onChange={(val) =>
                  setSelectedValues((prev) => ({
                    ...prev,
                    branch: val,
                    subject: "",
                  }))
                }
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="subject" className={styles.label}>
                Subject
              </label>
              <CustomSelect
                id="subject"
                name="subject"
                value={selectedValues.subject}
                placeholder={!selectedValues.branch ? "Select Branch First" : "Select Subject"}
                options={subjectsToShow.map((subject) => ({
                  value: subject[1],
                  label: subject[0],
                }))}
                required
                disabled={!selectedValues.branch}
                onChange={(val) =>
                  setSelectedValues((prev) => ({
                    ...prev,
                    subject: val,
                    year: "",
                    session: "",
                  }))
                }
              />
            </div>
          </div>

          {/* Row 2: Year, Session, Upload Papers */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Year</label>
              <CustomSelect
                name="year"
                value={selectedValues.year}
                placeholder={
                  !selectedValues.subject
                    ? "Select Subject First"
                    : availableYearOptions.length === 0
                    ? "All Years Uploaded"
                    : "Select Year"
                }
                options={availableYearOptions}
                required
                disabled={!selectedValues.subject || availableYearOptions.length === 0}
                onChange={(val) =>
                  setSelectedValues((prev) => ({
                    ...prev,
                    year: val,
                  }))
                }
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="session" className={styles.label}>
                Session
              </label>
              <CustomSelect
                id="session"
                name="session"
                value={selectedValues.session}
                placeholder={
                  !selectedValues.year
                    ? "Select Year First"
                    : availableSessionOptions.length === 0
                    ? "No Sessions Available"
                    : "Select Session"
                }
                options={availableSessionOptions}
                required
                disabled={!selectedValues.year || availableSessionOptions.length === 0}
                onChange={(val) => {
                  setSelectedValues((prev) => ({
                    ...prev,
                    session: val,
                  }));
                }}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Upload Papers</label>

              {selectedValues.files.length > 0 ? (
                <>
                  {detectedType === "pdf" ? (
                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>
                        {selectedValues.files[0].name}
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveFiles}
                        className={styles.removeBtn}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className={styles.fileSummary}>
                      <span className={styles.fileSummaryText}>
                        {selectedValues.files.length} image{selectedValues.files.length > 1 ? "s" : ""} selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowOverlay(true)}
                        className={styles.editBtn}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveFiles}
                        className={styles.removeBtn}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="file"
                    id="uploadFile"
                    style={{ display: "none" }}
                    name="uploadFile"
                    accept=".pdf,image/png,image/jpeg"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    className={styles.customFileInputBtn}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className={styles.uploadIconMini}>📁</span>
                    <span>Choose PDF or Images</span>
                  </button>
                </>
              )}

              {errorMessage && (
                <p style={{ color: "#ff6b6b", marginTop: "5px", fontSize: "13px" }}>{errorMessage}</p>
              )}
            </div>
          </div>

          {/* Note on lower side of box */}
          <div className={styles.dbNote}>
            <span className={styles.dbNoteIcon}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </span>
            <span>
              Note: If a year or session is not listed, it is already present in the database.
            </span>
          </div>
        </form>
      </div>
      <div className={styles.buttonGroup}>
        <button
          type="submit"
          form="pyqForm"
          className={styles.submitBtn}
          disabled={upload}
        >
          {upload ? "Uploading..." : "Submit"}
        </button>
        <button type="reset" form="pyqForm" className={styles.resetBtn} disabled={upload}>
          Reset
        </button>
      </div>

      {/* Uploading progress modal */}
      {upload && (
        <div className={styles.uploadOverlay}>
          <div className={styles.uploadCard}>
            <div className={styles.spinner} />
            <h3 className={styles.uploadTitle}>Uploading PYQ...</h3>
            <p className={styles.uploadSubtitle}>
              {detectedType === "image" && selectedValues.files.length > 1
                ? "Converting images to PDF & uploading, please wait"
                : "Uploading your question paper, please wait"}
            </p>
            <div className={styles.progressContainer}>
              <div className={styles.progressBar} />
            </div>
          </div>
        </div>
      )}

      {/* Image reorder overlay */}
      {showOverlay && detectedType === "image" && selectedValues.files.length > 0 && (
        <div className={styles.overlay} onClick={() => setShowOverlay(false)}>
          <div className={styles.overlayContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.overlayHeader}>
              <h2 className={styles.overlayTitle}>
                {selectedValues.files.length} image{selectedValues.files.length > 1 ? "s" : ""} — drag to reorder
              </h2>
              <button
                type="button"
                className={styles.overlayClose}
                onClick={() => setShowOverlay(false)}
              >
                ✕
              </button>
            </div>
            <div className={styles.overlayList}>
              {selectedValues.files.map((file, index) => (
                <div
                  key={file.name + index}
                  className={`${styles.imageItem} ${dragIndex === index ? styles.dragging : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <span className={styles.dragHandle}>☰</span>
                  <img
                    src={thumbnailUrls[index]}
                    alt={file.name}
                    className={styles.thumbnail}
                  />
                  <span className={styles.imageFileName}>
                    {index + 1}. {file.name}
                  </span>
                  <button
                    type="button"
                    className={styles.removeOneBtn}
                    onClick={() => handleRemoveOne(index)}
                    title="Remove this image"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.overlayFooter}>
              <button
                type="button"
                onClick={handleRemoveFiles}
                className={styles.removeBtn}
              >
                Remove All
              </button>
              <button
                type="button"
                onClick={() => setShowOverlay(false)}
                className={styles.overlayDoneBtn}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
