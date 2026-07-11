# ⚡ Accounts Comparison & Per-Key Loan Reconciliation Engine

A modern, high-performance web application for **reconciling large financial CSV files (1GB+)** by unique **Loan Key** or **Account Number**.

Built using **React + Vite + Tailwind/DaisyUI**, the application uses **in-browser streaming** to process millions of records with near-zero memory overhead—no server upload required!

---

## 🌟 Key Features

1. **Per-Key Loan Reconciliation**: Group and sum millions of rows by unique Loan ID across **File A**, **File B**, and an optional **Accounting File**.
2. **O(1) Streaming Engine**: Reads CSV chunks sequentially (~64KB buffers) directly in your browser. Never loads the full 1GB file into RAM.
3. **Parallel Execution**: Streams File A, File B, and Accounting File **concurrently (`Promise.all`)** for blazing fast performance.
4. **Searchable Key Selection**: Easily search and pick Key Columns across files containing 100+ headers.
5. **Composite Multi-Column Formulas**: Compare simple 1-to-1 columns or create composite formulas like `(File A: +Col1 +Col2 -Col3) − (File B: +Col4)`.
6. **Multi-Part Accounting Rules**: Configure which Accounting columns to Add (`+`) or Subtract (`−`) along with filter criteria (e.g., `TransactionType = Billing`).
7. **Save & Load Setup JSON**: Export your entire setup (Key Columns, Pairs, Rules) to a JSON file and restore it anytime with one click.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for Production
```bash
npm run build
```

---

## 📂 Codebase Overview & Architecture

### Where is the code written?

```
AccountsComparision/
├── README.md                          # Project overview (this file)
├── USER_GUIDE.md                      # Beginner-friendly step-by-step user guide & code walkthrough
├── package.json                       # Project dependencies and npm scripts
└── src/
    ├── main.jsx                       # Application entry point
    ├── App.jsx                        # 5-step controller & JSON setup management
    ├── components/
    │   ├── Header.jsx                 # Top bar with theme toggle (Light / Dark)
    │   ├── FileUpload.jsx             # Step 1: Drag-and-drop CSV upload slots
    │   ├── KeyColumnPicker.jsx        # Step 2: Searchable Key Column selector
    │   ├── PairBuilder.jsx            # Step 3: Simple & Composite (+/−) Column Pair builder
    │   ├── RuleEditor.jsx             # Step 4: Accounting Rule & Filter editor per pair
    │   ├── LoanResults.jsx            # Step 5: Results table with status filters & CSV export
    │   ├── SearchableSelect.jsx       # Reusable searchable dropdown component
    │   └── Collapsible.jsx            # Accordion wrapper for UI steps
    └── lib/
        ├── engine.js                  # Core streaming engine & reconciliation formulas
        ├── csv.js                     # Low-level Web Streams CSV parser
        └── rules.js                   # Rule serialization & validation helpers
```

---

## 🧠 How the Reconciliation Engine Works

1. **Header Peeking**: When you select a CSV file, only the first line is read to extract column names instantly.
2. **Parallel Streaming**: When you click **Compare & Reconcile by Key**, the engine streams all files simultaneously.
3. **Per-Key Aggregation**: For each record, the engine looks up the `Key Column` (Loan Number) and updates the running sum for that loan.
4. **Formula & Filter Evaluation**:
   - `Diff = Sum(Side A Formula) − Sum(Side B Formula)`
   - `Delta = Diff − Accounting Rule Sum`
   - Loans are categorized into badges: `Match`, `Mismatch`, `Missing in File A/B`, or `Accounting Only`.

---

## 📖 Want a Beginner-Friendly Guide?
Check out **[USER_GUIDE.md](./USER_GUIDE.md)** for a simple, plain-English explanation written so clearly that anyone—even a 12th-grade student—can understand how the codebase works!
