import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./CustomSelect.module.css";

export default function CustomSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select Option",
  name,
  required = false,
  disabled = false,
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options into { value, label } array
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === "object" && opt !== null) {
      if (Array.isArray(opt)) {
        // [label, value] format e.g. from information.js subjects
        return { label: opt[0], value: opt[1] !== undefined ? String(opt[1]) : String(opt[0]) };
      }
      return {
        label: opt.label !== undefined ? opt.label : String(opt.value),
        value: String(opt.value),
      };
    }
    return { label: String(opt), value: String(opt) };
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === String(value));

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Scroll to selected item when dropdown opens
  useEffect(() => {
    if (isOpen && listRef.current && selectedOption) {
      const selectedIndex = normalizedOptions.findIndex((opt) => opt.value === selectedOption.value);
      if (selectedIndex >= 0) {
        const itemEl = listRef.current.children[selectedIndex];
        if (itemEl) {
          itemEl.scrollIntoView({ block: "nearest" });
        }
      }
    }
  }, [isOpen, selectedOption, normalizedOptions]);

  const handleSelect = useCallback(
    (optValue) => {
      if (onChange) {
        onChange(optValue);
      }
      setIsOpen(false);
    },
    [onChange]
  );

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = normalizedOptions.findIndex((opt) => opt.value === String(value));
        const nextIndex = Math.min(currentIndex + 1, normalizedOptions.length - 1);
        if (nextIndex >= 0) {
          handleSelect(normalizedOptions[nextIndex].value);
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = normalizedOptions.findIndex((opt) => opt.value === String(value));
        const prevIndex = Math.max(currentIndex - 1, 0);
        if (prevIndex >= 0) {
          handleSelect(normalizedOptions[prevIndex].value);
        }
      }
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={`${styles.wrapper} ${isOpen ? styles.open : ""} ${disabled ? styles.disabled : ""}`}
    >
      {/* Hidden input to guarantee native form submission works */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value || ""}
          required={required && !value}
        />
      )}

      {/* Main Trigger Box */}
      <button
        type="button"
        id={id}
        className={`${styles.trigger} ${!selectedOption ? styles.placeholder : ""}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={styles.selectedLabel}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className={`${styles.arrow} ${isOpen ? styles.arrowUp : ""}`}>
          ▾
        </span>
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && !disabled && (
        <div className={styles.dropdown}>
          <div ref={listRef} className={styles.list} role="listbox">
            {normalizedOptions.length === 0 ? (
              <div className={styles.emptyItem}>No options available</div>
            ) : (
              normalizedOptions.map((opt) => {
                const isSelected = selectedOption && selectedOption.value === opt.value;
                return (
                  <div
                    key={opt.value}
                    className={`${styles.item} ${isSelected ? styles.itemSelected : ""}`}
                    onClick={() => handleSelect(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className={styles.itemLabel}>{opt.label}</span>
                    {isSelected && <span className={styles.checkIcon}>✓</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
