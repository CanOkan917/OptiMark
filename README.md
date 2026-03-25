# 🧠 OptiMark

> A Python-based Optical Mark Recognition (OMR) system for generating bubble sheets and reading marked answers from images.

<p align="center">
  <img src="https://img.shields.io/badge/status-in%20development-yellow" />
  <img src="https://img.shields.io/badge/python-3.11%2B-blue" />
  <img src="https://img.shields.io/badge/opencv-used-success" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

## ✨ Overview

**OptiMark** is an end-to-end OMR prototype that can:

* 📝 Generate printable bubble sheets
* 📸 Read marked answers from scanned or photographed sheets
* 🔍 Provide detailed debug outputs for every processing stage

It is designed to be **modular, inspectable, and extensible**.

---

## 🔄 Workflows

### 🧾 1. Sheet Generation

* Generate clean, printable answer sheets (PDF)
* Export matching template JSON for precise coordinate mapping

### 🤖 2. OMR Pipeline

* Detect corner markers
* Apply preprocessing (thresholding, morphology, etc.)
* Optionally warp sheet to top-down view
* Align template with detected markers
* Extract answers & Student ID
* Output structured JSON + debug visuals

---

## 🚀 Features

* ⚙️ Fully configurable sheet generation (`generator/`)
* 📐 Automatic layout computation & marker placement
* 🔢 Student ID grid generation & reading
* 🧩 Template JSON export for deterministic matching
* 🧠 OpenCV-based preprocessing pipeline
* 🧭 Sheet detection & perspective correction
* 🎯 Bubble detection with ambiguity handling
* 🧪 Rich debug artifacts for each pipeline step
* 🖨️ Printable-area debug box support

---

## 🛠 Tech Stack

* 🐍 Python 3.11+
* 👁️ OpenCV
* 🔢 NumPy
* 📄 ReportLab

---

## 📁 Project Structure

```text
OptiMark/
├── generate_sheet.py
├── main.py
├── generator/
│   ├── app.py
│   ├── config.py
│   ├── drawer.py
│   ├── helpers.py
│   ├── layout.py
│   ├── sheet_generator.py
│   └── template_exporter.py
├── omr/
│   ├── answer_reader.py
│   ├── marker_detector.py
│   ├── output_writer.py
│   ├── pipeline.py
│   ├── preprocessing.py
│   ├── sheet_detector.py
│   └── template.py
├── test_images/
├── output/
└── requirements.txt
```

---

## ⚙️ Installation

```bash
python -m venv .venv
```

### ▶️ Activate environment

**Windows**

```bash
.venv\Scripts\activate
```

**macOS / Linux**

```bash
source .venv/bin/activate
```

### 📦 Install dependencies

```bash
pip install -r requirements.txt
```

---

## ▶️ Usage

### 1️⃣ Generate sheet + template

```bash
python generate_sheet.py
```

📂 Outputs (in `output/`):

* `optimark_sheet_*.pdf`
* `optimark_sheet_*.json`

---

### 2️⃣ Run OMR pipeline

```bash
python main.py --image test_images/test_image_real9.jpg --output-dir output/_main
```

### 🔧 Optional: specify template

```bash
python main.py \
  --image test_images/test_image_real9.jpg \
  --template-json output/optimark_sheet_YYYYMMDD_HHMMSS.json
```

If not provided, OptiMark automatically uses the **latest template**.

---

## 📊 Example Outputs

After running the pipeline:

* 🧾 `08_closed.png` → final binary image
* 🎯 `markers_overlay.png` → detected markers
* 📍 `markers.json` → marker coordinates
* 🧭 `sheet_contour.png` → detected sheet boundary
* 🪄 `warped_color.png` → perspective-corrected image
* 📐 `a4_plane_overlay.png` → template alignment
* ✅ `answers.json` → extracted answers
* 🔍 `answer_debug_overlay.png` → debug visualization

---

## ⚠️ Notes

* 📷 Performance depends on lighting & camera quality
* 🧪 Thresholds may require calibration
* 🔄 Output formats may change during development
* ❗ Backward compatibility is not guaranteed (yet)

---

## 🗺️ Roadmap

* 🔧 More robust marker detection
* 🌗 Better performance under uneven lighting
* 🧠 Improved ambiguity resolution
* 📊 Enhanced debugging tools
* 🧩 More flexible layouts & configs

---

## 🤝 Contributing

Contributions, ideas, and feedback are welcome!
Feel free to open issues or submit pull requests.

---

## 📜 License

MIT License
