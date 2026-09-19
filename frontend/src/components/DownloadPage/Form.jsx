import { useState, useMemo } from "react";
import styles from "./Form.module.css";
import {
  branches,
  subjects,
  semesters,
  ordinals,
} from "../../information";
import CustomSelect from "../CustomSelect/CustomSelect";

const initialState = {
  semester: "",
  branch: "",
  subject: "",
  fromYear: "",
  toYear: "",
};

// Generate current year + last 10 years (descending)
const currentYear = new Date().getFullYear();
const allYears = Array.from({ length: 11 }, (_, i) => currentYear - i);

export default function FormPYQ({ fetchFn }) {
  const [selectedValues, setSelectedValues] = useState(initialState);
  const [fetching, setFetching] = useState(false);

  // toYear options: only years >= fromYear
  const toYearOptions = useMemo(() => {
    if (!selectedValues.fromYear) return allYears;
    return allYears.filter((y) => y >= Number(selectedValues.fromYear));
  }, [selectedValues.fromYear]);

  const branchOptions = useMemo(() => {
    if (selectedValues.semester === "1" || selectedValues.semester === "2") {
      return [{ value: "CommonForAllBranches", label: "Common For All Branches" }];
    }
    return Object.entries(branches).map(([short, full]) => ({
      value: short,
      label: full,
    }));
  }, [selectedValues.semester]);

  const subjectsToShow = useMemo(() => {
    if (!selectedValues.semester || !selectedValues.branch) return [];
    const sem = selectedValues.semester;
    const branch = selectedValues.branch;
    const branchSubjects =
      Number(sem) <= 2
        ? subjects.CommonForAllBranches?.[ordinals[sem]]
        : subjects[branch]?.[ordinals[sem]];
    if (branchSubjects) {
      return [
        { value: "All", label: "ALL SUBJECTS" },
        ...branchSubjects.map((s) => ({ value: s[1], label: s[0] })),
      ];
    }
    return [];
  }, [selectedValues.semester, selectedValues.branch]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFetching(true);
    try {
      const fd = new FormData(event.target);
      const data = Object.fromEntries(fd.entries());
      const queryString = new URLSearchParams(data).toString();
      await fetchFn(queryString);
    } catch {
      // Retain user's selected values on error so they can adjust filters
    } finally {
      setFetching(false);
    }
  }

  function handleReset(e) {
    e.preventDefault();
    setSelectedValues(initialState);
  }

  return (
    <div className={styles.downloadPage}>
      <h1 className={styles.heading}>Find Previous Year Question Papers Instantly.</h1>
      <p className={styles.subtitle}>Curated engineering resources, filters by semester, branch & subject.</p>
      <div className={styles.container}>
        <form
          id="pyqForm"
          onSubmit={handleSubmit}
          onReset={handleReset}
          className={styles.form}
        >
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
                options={semesters.map((s) => ({ value: String(s), label: `Semester ${s}` }))}
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
                options={branchOptions}
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
                name="subject_code"
                value={selectedValues.subject}
                placeholder={!selectedValues.branch ? "Select Branch First" : "Select Subject"}
                options={subjectsToShow}
                required
                disabled={!selectedValues.branch}
                onChange={(val) =>
                  setSelectedValues((prev) => ({
                    ...prev,
                    subject: val,
                  }))
                }
              />
            </div>
          </div>

          {/* Row 2: From Year, To Year */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>From Year</label>
              <CustomSelect
                name="from_year"
                value={selectedValues.fromYear}
                placeholder="Select From Year"
                options={allYears.map((y) => ({ value: String(y), label: String(y) }))}
                required
                onChange={(val) =>
                  setSelectedValues((prev) => ({
                    ...prev,
                    fromYear: val,
                    toYear: prev.toYear && Number(prev.toYear) < Number(val) ? val : prev.toYear,
                  }))
                }
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>To Year</label>
              <CustomSelect
                name="to_year"
                value={selectedValues.toYear}
                placeholder="Select To Year"
                options={toYearOptions.map((y) => ({ value: String(y), label: String(y) }))}
                required
                onChange={(val) =>
                  setSelectedValues((prev) => ({
                    ...prev,
                    toYear: val,
                  }))
                }
              />
            </div>

            {/* Empty spacer to align with the 3-column row above */}
            <div className={styles.formGroup} style={{ visibility: "hidden" }}></div>
          </div>
        </form>
      </div>

      <div className={styles.buttonGroup}>
        <button
          type="submit"
          form="pyqForm"
          className={styles.submitBtn}
          disabled={fetching}
        >
          {fetching ? "Sending Request..." : "Submit"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className={styles.resetBtn}
          disabled={fetching}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
