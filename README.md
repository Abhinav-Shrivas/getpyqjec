<div align="center">
  <h1>🎓 GetPYQJEC</h1>
  <p><strong>A Next-Generation Academic Resource Platform</strong></p>
  <p>Providing seamless, systematic, and intuitive access to Previous Year Questions (PYQs) for college students.</p>

  <p>
    <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" />
    <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
    <img src="https://img.shields.io/badge/Django_6-092E20?style=for-the-badge&logo=django&logoColor=white" alt="Django 6" />
    <img src="https://img.shields.io/badge/Cloudflare_R2-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare R2" />
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  </p>
</div>

<hr/>

## 📖 Table of Contents
1. [Overview](#-overview)
2. [Key Features](#-key-features)
3. [Architecture Diagram](#-architecture-diagram)
4. [Technology Stack](#-technology-stack)
5. [Local Setup Guide](#-local-setup-guide)
    - [Prerequisites](#prerequisites)
    - [Backend Setup](#backend-setup-django)
    - [Frontend Setup](#frontend-setup-react)
6. [Project Structure](#-project-structure)

---

## 🌟 Overview
**GetPYQJEC** is an advanced academic resource platform designed to centralize and organize college examination papers. It solves the chaotic spread of academic materials across messaging groups and drives by providing an ultra-fast, structured search, multi-year PDF compile-and-download system, and a verified community contribution workflow.

---

## ✨ Key Features

- 🚀 **Lightning-Fast Modern UI**: Powered by React 19 and Vite with sleek, responsive controls and unified `CustomSelect` dropdowns.
- ☁️ **Cloudflare R2 Cloud Storage**: Zero-egress-fee, S3-compatible cloud object storage via `boto3` for high-availability PDF and ID card hosting.
- 📑 **Dynamic PDF Merging**: On-the-fly multi-year question paper merging and streaming via `pikepdf` thread pools.
- 🎓 **Student Verification Workflow**: Contributor access is protected by an ID-card verification lifecycle, allowing administrators to inspect and verify students before granting paper upload rights.
- ⚡ **Dynamic Upload Filtering**: Upload forms automatically query existing papers and omit years and sessions where papers are already available to prevent duplicates.
- 🔐 **JWT Authentication & Moderation**: Secure cookie-managed token authentication, role-based permissions (`IsVerifiedStudent`, `IsAdminUser`), and admin review dashboards.

---

## 🏗 Architecture Diagram

```text
+-----------------------------------------------------------------------------------------+
|                               Client (React 19 + Vite SPA)                              |
|          - CustomSelect Dropdowns       - Dynamic Year/Session Filter                   |
|          - Student Verification Portal  - In-Browser Multi-Image to PDF                 |
+--------+----------------------------+-----------------------------+---------------------+
         |                            |                             |
         | HTTP / JSON                | HTTP / JSON                 | Multipart / Streams
         | Auth & Verification        | Query & Search              | Uploads & Downloads
         v                            v                             v
+--------------------+       +--------------------+        +--------------------+
|    Auth & Roles    |       |   PYQ Query Engine |        | PDF Merge Service  |
|   (Django / JWT)   |       |   (Django / DRF)   |        | (Django / pikepdf) |
|                    |       |                    |        |                    |
| * Contributor Auth |       | * Existing Options |        | * ThreadPool Merge |
| * ID Verification  |       | * Filter by Branch |        | * Stream Downloads |
| * Admin Moderation |       | * Semester/Subject |        | * In-Memory Memory |
+--------+-----------+       +--------+-----------+        +--------+-----------+
         |                            |                             |
         |                            v                             |
         |             +------------------------------+             |
         +------------>| Database (PostgreSQL/SQLite) |<------------+
                       | - Users & Permissions        |
                       | - PYQ Catalog Indexes        |
                       | - Student Verifications      |
                       +------------------------------+
                                      |
                                      v
                       +------------------------------+
                       |    Cloudflare R2 Storage     |
                       |                              |
                       |  Bucket: getpyqjec-pyqs      |
                       |  Bucket: getpyqjec-verif...  |
                       +------------------------------+
```

---

## 💻 Technology Stack

### Frontend
* **React 19**: Modern component-driven UI architecture.
* **Vite**: Rapid development tooling and production asset bundling.
* **React Router DOM**: Client-side single-page application routing.
* **Custom Design System**: Bespoke vanilla CSS tokens, responsive layouts, and unified select menus.

### Backend
* **Django 6.0 & Django REST Framework (DRF)**: High-performance RESTful API endpoints.
* **Simple JWT**: Token-based authentication with secure cookie handling.
* **Cloudflare R2 (`boto3`)**: Scalable object storage for papers and verification media.
* **Pikepdf**: Low-level high-speed PDF concatenation and generation.
* **WhiteNoise**: Direct static file serving for containerized environments.
* **PostgreSQL / SQLite**: Relational database with specialized composite indexes (`pyq_lookup_idx`).

---

## 🚀 Local Setup Guide

### Prerequisites
* [Python 3.10+](https://www.python.org/downloads/)
* [Node.js 18+](https://nodejs.org/) & npm
* [Git](https://git-scm.com/)

---

### Backend Setup (Django)

1. **Clone and enter the workspace**
   ```bash
   git clone https://github.com/hardikgaikwad/getpyqjec.git
   cd getpyqjec
   ```

2. **Create and activate a virtual environment**
   * Windows:
     ```powershell
     python -m venv venv
     venv\Scripts\activate
     ```
   * macOS / Linux:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up Environment Variables**
   Copy the provided `.env.example` template to `.env`:
   * Windows:
     ```powershell
     copy .env.example .env
     ```
   * macOS / Linux:
     ```bash
     cp .env.example .env
     ```
   *(Fill in your Cloudflare R2 bucket credentials and Django secret key.)*

5. **Apply database migrations**
   ```bash
   python manage.py migrate
   ```

6. **Create an administrator account**
   ```bash
   python manage.py createsuperuser
   ```

7. **Run the development server**
   ```bash
   python manage.py runserver
   ```
   *Backend running at `http://127.0.0.1:8000/`*

---

### Frontend Setup (React)

1. **Navigate to the frontend directory**
   ```bash
   cd frontend
   ```

2. **Install Node dependencies**
   ```bash
   npm install
   ```

3. **Start the Vite development server**
   ```bash
   npm run dev
   ```
   *Frontend running at `http://localhost:5173/`*

---

## 📂 Project Structure

```text
getpyqjec/
├── backend/               # Django project settings, WSGI, and root routing
├── core/                  # Main DRF app: models, views, serializers, tests, migrations
├── frontend/              # React single-page application
│   ├── src/               # React components, CustomSelect, AuthContext, HTTP layer
│   │   ├── components/    # DownloadPage, UploadPage, VerificationPage, CustomSelect, etc.
│   │   ├── store/         # Global authentication and verification state
│   │   └── http.js        # Centralized API fetch methods
│   └── package.json       # Frontend scripts and dependencies
├── utils/                 # Utilities: Cloudflare R2 storage client and pikepdf compiler
├── templates/             # Custom HTML templates and admin overrides
├── Dockerfile             # Production container image definition
├── render.yaml            # Render deployment blueprint
├── requirements.txt       # Backend Python dependencies
├── .env.example           # Environment variables template
└── manage.py              # Django management CLI
```
