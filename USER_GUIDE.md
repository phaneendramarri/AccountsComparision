# 📘 User Guide & Beginner's Code Walkthrough

Welcome! Whether you are using this app to reconcile financial records or you are learning how software works, this guide explains **everything in simple, everyday language**.

---

## Part 1: How to Use the Application (Step-by-Step)

Imagine you have two departments in your company:
- **File A**: Loan balances recorded by the Sales department.
- **File B**: Loan balances recorded by the Core Banking system.
- **Accounting File (Optional)**: Ledger entries showing billing or adjustment transactions.

Your goal is to check if **every loan account matches** between File A and File B.

### Step 1: Upload CSV Files
1. Click **Choose File** under **File A** and select your CSV file.
2. Click **Choose File** under **File B** and select your second CSV file.
3. (Optional) Upload an **Accounting File** if you want to verify against accounting rules.

> **Note**: Even if your CSV files are huge (over 1 Gigabyte), uploading is instant because the app only reads the top header row at first!

---

### Step 2: Select Key Column (Search & Match by Loan ID)
Every loan has a unique identifier (like `Loan Account Number` or `Application ID`).
- Use the searchable dropdowns to select the **Key Column** for File A, File B, and Accounting File.
- This tells the app: *"Group all rows that share the same Loan ID together."*

---

### Step 3: Select Column Pairs to Compare
Now choose which numbers you want to compare:
- **Simple Mode**: Compare one column in File A (e.g. `SanctionedAmount`) against one column in File B (e.g. `DisbursedAmount`).
- **Composite Mode**: Add or subtract multiple columns on either side!
  - Example: `File A: (+ Principal + Interest − Discount)  ↔  File B: (+ TotalPaid)`

Click **+ Add Pair** to save your comparison.

---

### Step 4: Accounting Rules & Filters (Optional)
If you uploaded an Accounting File:
- For each pair, select which Accounting columns to **Add (+)** or **Subtract (−)**.
- Add filter conditions (for example, only include rows where `TransactionType` equals `Billing`).

---

### Step 5: Run Reconciliation & Download Results
1. Click **Compare & Reconcile by Key**.
2. Watch the progress bars as the engine streams all files concurrently in parallel.
3. View the interactive results table:
   - **✓ Match**: `File A − File B` equals zero (or matches the Accounting sum).
   - **✗ Mismatch**: There is a discrepancy that needs your attention.
   - **! Missing in File A / B**: A loan appears in one file but not the other.
4. Click **Download CSV Report** to save the complete loan-by-loan report to Excel.

---

## Part 2: Save & Load Your Setup (JSON Settings)

Don't want to pick your columns and rules every time?
- Click **💾 Save Setup JSON** at the top of the app. It downloads a `.json` file containing all your settings.
- Next time you open the app, click **📥 Load Setup JSON** and pick that file. All your columns and rules are restored instantly!

---

## Part 3: Where is the Code Written? (For Students & Beginners)

If you are a student or a beginner programmer wanting to read the source code, here is a simple map of **where each feature lives**:

```
AccountsComparision/
│
├── src/App.jsx
│   └── What it does: This is the MAIN CONTROLLER. It manages the 5 steps on the screen,
│       holds the file uploads in state, and handles saving/loading JSON settings.
│
├── src/lib/engine.js
│   └── What it does: This is the CALCULATOR ENGINE. It streams large files chunk-by-chunk,
│       groups records by Loan Key, evaluates formula parts (+/−), and calculates Diff/Delta.
│
├── src/components/KeyColumnPicker.jsx
│   └── What it does: Renders Step 2 where the user searches & picks the Key Column.
│
├── src/components/PairBuilder.jsx
│   └── What it does: Renders Step 3 where the user builds Simple or Composite (+/−) column pairs.
│
├── src/components/RuleEditor.jsx
│   └── What it does: Renders Step 4 where the user adds (+) or subtracts (−) Accounting columns
│       and sets filter criteria.
│
└── src/components/LoanResults.jsx
    └── What it does: Renders Step 5 results table with status filters, search bar, and CSV export.
```

### How Does Streaming Work Without Crashing Memory?
Normally, reading 10 million rows into JavaScript memory takes 4 Gigabytes of RAM and crashes the browser.
Instead, `src/lib/engine.js` uses **Web Streams**:
1. It reads a tiny 64 Kilobyte chunk of text from disk.
2. It adds the numbers to a `Map<LoanKey, RunningTotal>`.
3. It throws away the raw chunk from memory immediately.
4. By the time it finishes reading the file, memory usage stays tiny and flat!
